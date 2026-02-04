from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone
import time
import math

# SGP4 para propagación orbital
from sgp4.api import Satrec, jday

app = FastAPI(title="SSA Classifier API")

# CORS para Next.js
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PredictRequest(BaseModel):
    id: int
    line1: str
    line2: str
    satellite_name: Optional[str] = None  # Nombre del satélite para clasificación
    threshold: Optional[float] = 0.6


class OrbitalStats(BaseModel):
    altitude_km: float
    velocity_kms: float


class PropagationData(BaseModel):
    """Datos de propagación SGP4 (posición actual)"""
    position_km: dict  # {"x": float, "y": float, "z": float}
    velocity_kms: dict  # {"x": float, "y": float, "z": float}
    calculated_at: str  # ISO timestamp


class TleInfo(BaseModel):
    """Información del TLE"""
    epoch: str  # ISO timestamp del epoch del TLE
    age_hours: float  # Edad del TLE en horas
    age_days: float  # Edad del TLE en días
    is_stale: bool  # True si > 3 días
    warning: Optional[str] = None


class Metadata(BaseModel):
    model_version: str
    processing_time_ms: float


class PredictResponse(BaseModel):
    object_id: int
    satellite_name: Optional[str] = None
    predicted_class: str
    classification_reason: str  # Razón de la clasificación
    orbital_stats: OrbitalStats
    confidence: float
    region: str
    proba: dict
    tle_info: Optional[TleInfo] = None
    propagation: Optional[PropagationData] = None
    features: Optional[dict] = None
    metadata: Metadata


def parse_tle_epoch(line1: str) -> datetime:
    """
    Extrae el epoch del TLE de la línea 1.
    Formato: YYDDD.DDDDDDDD (año de 2 dígitos + día del año decimal)
    """
    try:
        epoch_str = line1[18:32].strip()
        year_2d = int(epoch_str[:2])
        day_decimal = float(epoch_str[2:])
        
        # Convertir año de 2 dígitos a 4 dígitos
        if year_2d >= 57:
            year = 1900 + year_2d
        else:
            year = 2000 + year_2d
        
        # Calcular fecha desde día del año
        epoch = datetime(year, 1, 1, tzinfo=timezone.utc)
        epoch = epoch + __import__('datetime').timedelta(days=day_decimal - 1)
        
        return epoch
    except Exception as e:
        print(f"Error parsing epoch: {e}")
        return datetime.now(timezone.utc)


def calculate_tle_age(epoch: datetime) -> tuple[float, float, bool, Optional[str]]:
    """Calcula la edad del TLE y genera warning si es viejo."""
    now = datetime.now(timezone.utc)
    age = now - epoch
    age_hours = age.total_seconds() / 3600
    age_days = age_hours / 24
    
    is_stale = age_days > 3
    warning = None
    
    if age_days > 7:
        warning = f"⚠️ TLE muy viejo ({age_days:.1f} días). Posición MUY poco confiable."
    elif age_days > 3:
        warning = f"⚠️ TLE viejo ({age_days:.1f} días). Posición poco confiable."
    elif age_hours > 24:
        warning = f"TLE de {age_days:.1f} días. Considere actualizar."
    
    return age_hours, age_days, is_stale, warning


def propagate_sgp4(line1: str, line2: str) -> Optional[PropagationData]:
    """
    Propaga el TLE usando SGP4 para obtener posición actual.
    """
    try:
        # Crear objeto satélite desde TLE
        satellite = Satrec.twoline2rv(line1, line2)
        
        # Obtener fecha/hora actual como Julian Date
        now = datetime.now(timezone.utc)
        jd, fr = jday(now.year, now.month, now.day, 
                      now.hour, now.minute, now.second + now.microsecond/1e6)
        
        # Propagar
        error, position, velocity = satellite.sgp4(jd, fr)
        
        if error != 0:
            print(f"SGP4 propagation error: {error}")
            return None
        
        return PropagationData(
            position_km={"x": round(position[0], 3), 
                        "y": round(position[1], 3), 
                        "z": round(position[2], 3)},
            velocity_kms={"x": round(velocity[0], 6), 
                         "y": round(velocity[1], 6), 
                         "z": round(velocity[2], 6)},
            calculated_at=now.isoformat()
        )
    except Exception as e:
        print(f"SGP4 error: {e}")
        return None


def parse_tle_mean_motion(line2: str) -> float:
    """Extrae mean motion (rev/day) de la línea 2 del TLE."""
    try:
        return float(line2[52:63].strip())
    except:
        return 15.0


def calculate_orbital_params(mean_motion: float) -> tuple[float, float, str]:
    """Calcula altitud, velocidad y región orbital."""
    MU = 398600.4418
    R_EARTH = 6371.0
    
    period_sec = 86400.0 / mean_motion
    a = (MU * (period_sec / (2 * math.pi)) ** 2) ** (1/3)
    altitude_km = a - R_EARTH
    velocity_kms = math.sqrt(MU / a)
    
    if altitude_km < 2000:
        region = "LEO"
    elif altitude_km < 35786:
        region = "MEO"
    else:
        region = "GEO"
    
    return altitude_km, velocity_kms, region


def classify_object(name: str, altitude_km: float, eccentricity: float = 0.0) -> tuple[str, float, dict, str]:
    """
    Clasifica el objeto espacial usando:
    1. Patrones en el nombre (DEB, R/B, ROCKET, etc.)
    2. Características orbitales (altitud, excentricidad)
    
    Returns: (clase, confianza, probabilidades, razon)
    """
    name_upper = name.upper() if name else ""
    
    # Patrones de nombre para debris
    debris_patterns = ["DEB", "DEBRIS", " DEB ", "/DEB", "-DEB"]
    rocket_patterns = ["R/B", "ROCKET", "ROCKET BODY", " RB", "/RB", "FREGAT", "BRIZ", "CENTAUR", "DELTA"]
    payload_patterns = ["STARLINK", "ONEWEB", "IRIDIUM", "GPS", "GLONASS", "GALILEO", "BEIDOU", "COSMOS", "INTELSAT"]
    
    # Clasificación por nombre (alta confianza)
    for pattern in debris_patterns:
        if pattern in name_upper:
            return "debris", 0.95, {"payload": 0.02, "rocket_body": 0.03, "debris": 0.95}, f"Nombre contiene '{pattern}'"
    
    for pattern in rocket_patterns:
        if pattern in name_upper:
            return "rocket_body", 0.90, {"payload": 0.05, "rocket_body": 0.90, "debris": 0.05}, f"Nombre contiene '{pattern}'"
    
    for pattern in payload_patterns:
        if pattern in name_upper:
            return "payload", 0.92, {"payload": 0.92, "rocket_body": 0.05, "debris": 0.03}, f"Constelación conocida: {pattern}"
    
    # Si el nombre no da pistas, usar características orbitales
    # Payloads típicamente están en órbitas más controladas
    # Debris tiende a estar en órbitas más excéntricas o altitudes inusuales
    
    if altitude_km < 300:
        # Órbita muy baja - probablemente debris en decaimiento
        return "debris", 0.70, {"payload": 0.15, "rocket_body": 0.15, "debris": 0.70}, "Altitud muy baja (<300km) - posible decaimiento"
    
    elif altitude_km >= 300 and altitude_km < 600:
        # LEO común para payloads
        return "payload", 0.65, {"payload": 0.65, "rocket_body": 0.20, "debris": 0.15}, "Altitud típica de payloads LEO (300-600km)"
    
    elif altitude_km >= 600 and altitude_km < 1000:
        # Zona mixta
        return "payload", 0.55, {"payload": 0.55, "rocket_body": 0.25, "debris": 0.20}, "Altitud LEO media - probablemente payload"
    
    elif altitude_km >= 1000 and altitude_km < 2000:
        # LEO alta - más debris histórico aquí
        return "debris", 0.50, {"payload": 0.30, "rocket_body": 0.20, "debris": 0.50}, "LEO alta (1000-2000km) - zona con mucho debris"
    
    elif altitude_km >= 35000 and altitude_km < 36500:
        # GEO - casi siempre payloads
        return "payload", 0.85, {"payload": 0.85, "rocket_body": 0.10, "debris": 0.05}, "Órbita GEO - típicamente satélites de comunicaciones"
    
    else:
        # MEO u otras - sin suficiente info
        return "unknown", 0.40, {"payload": 0.40, "rocket_body": 0.30, "debris": 0.30}, "Órbita atípica - clasificación incierta"


@app.post("/predict", response_model=PredictResponse)
def predict(request: PredictRequest):
    start_time = time.time()
    
    # Parsear epoch y calcular edad del TLE
    epoch = parse_tle_epoch(request.line1)
    age_hours, age_days, is_stale, warning = calculate_tle_age(epoch)
    
    tle_info = TleInfo(
        epoch=epoch.isoformat(),
        age_hours=round(age_hours, 2),
        age_days=round(age_days, 2),
        is_stale=is_stale,
        warning=warning
    )
    
    # Propagar con SGP4
    propagation = propagate_sgp4(request.line1, request.line2)
    
    # Calcular parámetros orbitales clásicos
    mean_motion = parse_tle_mean_motion(request.line2)
    altitude_km, velocity_kms, region = calculate_orbital_params(mean_motion)
    
    # Si tenemos propagación, usar altitud real
    if propagation:
        pos = propagation.position_km
        real_altitude = math.sqrt(pos["x"]**2 + pos["y"]**2 + pos["z"]**2) - 6371.0
        altitude_km = real_altitude
    
    # Clasificar usando nombre y altitud
    predicted_class, confidence, proba, reason = classify_object(
        name=request.satellite_name or "",
        altitude_km=altitude_km
    )
    
    if confidence < request.threshold:
        predicted_class = "unknown"
        reason = f"Confianza ({confidence:.0%}) menor al umbral ({request.threshold:.0%})"
    
    processing_time_ms = (time.time() - start_time) * 1000
    
    return PredictResponse(
        object_id=request.id,
        satellite_name=request.satellite_name,
        predicted_class=predicted_class,
        classification_reason=reason,
        orbital_stats=OrbitalStats(
            altitude_km=round(altitude_km, 2),
            velocity_kms=round(velocity_kms, 3)
        ),
        confidence=round(confidence, 4),
        region=region,
        proba={k: round(v, 4) for k, v in proba.items()},
        tle_info=tle_info,
        propagation=propagation,
        features={
            "mean_motion": round(mean_motion, 6),
            "altitude_km": round(altitude_km, 2),
            "tle_age_days": round(age_days, 2)
        },
        metadata=Metadata(
            model_version="heuristic-v1.0",
            processing_time_ms=round(processing_time_ms, 2)
        )
    )


# ============================================
# Endpoint para obtener TLEs de CelesTrak
# ============================================

import httpx
import json
from pathlib import Path

# Cache file para TLEs
CACHE_FILE = Path(__file__).parent / "tle_cache.json"
CACHE_MAX_AGE_HOURS = 2  # Re-fetch si el cache tiene más de 2 horas


class SatelliteInfo(BaseModel):
    norad_id: str
    name: str
    line1: str
    line2: str
    epoch: str
    age_hours: float
    age_days: float
    is_stale: bool


def load_cache() -> Optional[dict]:
    """Carga el cache de TLEs si existe y no es viejo."""
    if not CACHE_FILE.exists():
        return None
    
    try:
        with open(CACHE_FILE, "r") as f:
            cache = json.load(f)
        
        cached_at = datetime.fromisoformat(cache.get("cached_at", "2000-01-01"))
        age_hours = (datetime.now(timezone.utc) - cached_at.replace(tzinfo=timezone.utc)).total_seconds() / 3600
        
        if age_hours > CACHE_MAX_AGE_HOURS:
            return None
        
        return cache
    except:
        return None


def save_cache(satellites: list):
    """Guarda los TLEs en cache."""
    cache = {
        "cached_at": datetime.now(timezone.utc).isoformat(),
        "satellites": [s.dict() for s in satellites]
    }
    with open(CACHE_FILE, "w") as f:
        json.dump(cache, f)


def parse_tle_epoch_simple(line1: str) -> datetime:
    """Parsea epoch de TLE."""
    try:
        epoch_str = line1[18:32].strip()
        year_2d = int(epoch_str[:2])
        day_decimal = float(epoch_str[2:])
        year = 2000 + year_2d if year_2d < 57 else 1900 + year_2d
        from datetime import timedelta
        epoch = datetime(year, 1, 1, tzinfo=timezone.utc) + timedelta(days=day_decimal - 1)
        return epoch
    except:
        return datetime.now(timezone.utc)


@app.get("/satellites", response_model=list[SatelliteInfo])
async def get_satellites(limit: int = 100):
    """
    Obtiene lista de satélites activos desde CelesTrak.
    Usa cache local para evitar llamadas excesivas.
    """
    # Intentar cache primero
    cache = load_cache()
    if cache:
        satellites = [SatelliteInfo(**s) for s in cache["satellites"]]
        if limit:
            return satellites[:limit]
        return satellites
    
    # Fetch desde CelesTrak
    url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()
            content = response.text
    except Exception as e:
        # Si falla, intentar devolver cache viejo si existe
        if CACHE_FILE.exists():
            with open(CACHE_FILE, "r") as f:
                cache = json.load(f)
            return [SatelliteInfo(**s) for s in cache["satellites"][:limit]]
        raise Exception(f"Error fetching from CelesTrak: {e}")
    
    # Parsear TLEs (formato: nombre\nline1\nline2\n...)
    lines = [l.strip() for l in content.strip().split("\n") if l.strip()]
    
    satellites = []
    now = datetime.now(timezone.utc)
    
    i = 0
    while i < len(lines) - 2:
        name = lines[i]
        line1 = lines[i + 1]
        line2 = lines[i + 2]
        
        # Verificar formato válido
        if not line1.startswith("1 ") or not line2.startswith("2 "):
            i += 1
            continue
        
        # Extraer NORAD ID
        norad_id = line1[2:7].strip()
        
        # Calcular epoch y edad
        epoch = parse_tle_epoch_simple(line1)
        age = now - epoch
        age_hours = age.total_seconds() / 3600
        age_days = age_hours / 24
        is_stale = age_days > 3
        
        satellites.append(SatelliteInfo(
            norad_id=norad_id,
            name=name,
            line1=line1,
            line2=line2,
            epoch=epoch.isoformat(),
            age_hours=round(age_hours, 2),
            age_days=round(age_days, 2),
            is_stale=is_stale
        ))
        
        i += 3
    
    # Guardar en cache
    save_cache(satellites)
    
    if limit:
        return satellites[:limit]
    return satellites


@app.get("/health")
def health():
    return {"status": "ok"}
