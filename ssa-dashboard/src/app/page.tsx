"use client";

import { useMemo, useState } from "react";
import { predict } from "./lib/api";
import { PredictRequest, PredictResponse } from "./types/predict";
import SatelliteSelector from "./components/SatelliteSelector";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

export default function Home() {
  const [tle, setTle] = useState<string>(
    `1 25544U 98067A   24035.54791667  .00016717  00000+0  10270-3 0  9991
2 25544  51.6426  35.3018 0004741  73.4112  44.2787 15.49815361439567`
  );

  const [threshold, setThreshold] = useState<number>(0.6);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState<string | null>(null);

  function handleSatelliteSelect(line1: string, line2: string, name: string) {
    setTle(`${line1}\n${line2}`);
    setSelectedSatellite(name);
    setResult(null);
    setError(null);
  }

  const lines = useMemo(() => {
    return tle
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [tle]);

  function validateTLE(ls: string[]) {
    if (ls.length !== 2) return "Pegá exactamente 2 líneas.";
    if (!ls[0].startsWith("1 ")) return "Línea 1 debe empezar con '1 '.";
    if (!ls[1].startsWith("2 ")) return "Línea 2 debe empezar con '2 '.";
    return null;
  }

  async function onPredict() {
    setError(null);
    setResult(null);

    const msg = validateTLE(lines);
    if (msg) {
      setError(msg);
      return;
    }

    const request: PredictRequest = {
      id: Date.now(),
      line1: lines[0],
      line2: lines[1],
      satellite_name: selectedSatellite || undefined,
      threshold,
    };

    setLoading(true);

    try {
      const response = await predict(request);
      setResult(response);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error en predicción.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-900 text-white p-8">
      <h1 className="text-3xl font-bold mb-6">🛰️ SSA Classifier</h1>

      {/* Selector de satélites */}
      <SatelliteSelector onSelect={handleSatelliteSelect} />

      {selectedSatellite && (
        <div className="mb-4 p-3 bg-purple-900 border border-purple-500 rounded text-lg">
          ✅ Satélite seleccionado: <strong>{selectedSatellite}</strong>
        </div>
      )}

      {/* TLE Input */}
      <div className="mb-6">
        <label className="block text-xl mb-2">
          TLE (2 líneas):
          <a
            href="https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-3 text-blue-400 hover:text-blue-300 underline text-lg"
          >
            📡 Obtener TLEs de CelesTrak
          </a>
        </label>
        <textarea
          className="w-full max-w-2xl h-32 p-4 text-lg font-mono bg-gray-800 border border-gray-600 rounded"
          value={tle}
          onChange={(e) => setTle(e.target.value)}
          spellCheck={false}
        />
      </div>

      {/* Threshold */}
      <div className="mb-6 flex items-center gap-4">
        <label className="text-lg">Umbral:</label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          value={threshold}
          onChange={(e) => setThreshold(clamp01(Number(e.target.value)))}
          className="w-24 p-2 text-lg bg-gray-800 border border-gray-600 rounded"
        />
      </div>

      {/* Button */}
      <button
        onClick={onPredict}
        disabled={loading}
        className="px-6 py-3 text-xl font-bold bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
      >
        {loading ? "Prediciendo..." : "Predecir"}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-6 p-4 text-lg bg-red-900 border border-red-600 rounded max-w-2xl">
          ❌ {error}
        </div>
      )}

      {/* Resultado */}
      {result && (
        <div className="mt-8 max-w-2xl">
          {/* Warning de TLE viejo */}
          {result.tle_info?.warning && (
            <div className={`mb-4 p-4 rounded text-lg font-semibold ${result.tle_info.is_stale
              ? "bg-red-900 border border-red-500 text-red-200"
              : "bg-yellow-900 border border-yellow-500 text-yellow-200"
              }`}>
              {result.tle_info.warning}
            </div>
          )}

          {/* Resultado principal */}
          <div className="p-6 bg-gray-800 border border-gray-600 rounded">
            {result.satellite_name && (
              <p className="text-xl text-gray-300 mb-2">
                🛰️ {result.satellite_name}
              </p>
            )}

            <p className="text-3xl font-bold mb-4">
              Clasificación: <span className={
                result.predicted_class === "payload" ? "text-green-400" :
                  result.predicted_class === "debris" ? "text-red-400" :
                    result.predicted_class === "rocket_body" ? "text-orange-400" :
                      "text-gray-400"
              }>{result.predicted_class.toUpperCase()}</span>
            </p>

            <p className="text-lg text-gray-300 italic mb-4">
              💡 {result.classification_reason}
            </p>

            <div className="grid grid-cols-2 gap-4 text-lg">
              <div>
                <span className="text-gray-400">Confianza:</span>
                <span className="ml-2 font-semibold">{(result.confidence * 100).toFixed(0)}%</span>
              </div>
              <div>
                <span className="text-gray-400">Región:</span>
                <span className="ml-2 font-semibold">{result.region}</span>
              </div>
              <div>
                <span className="text-gray-400">Altitud:</span>
                <span className="ml-2 font-semibold">{result.orbital_stats.altitude_km.toFixed(0)} km</span>
              </div>
              <div>
                <span className="text-gray-400">Velocidad:</span>
                <span className="ml-2 font-semibold">{result.orbital_stats.velocity_kms.toFixed(2)} km/s</span>
              </div>
            </div>

            {/* Probabilidades */}
            <div className="mt-4 pt-4 border-t border-gray-600">
              <p className="text-lg font-semibold mb-2">Probabilidades:</p>
              <div className="flex gap-4">
                <span className="text-green-400">Payload: {(result.proba.payload * 100).toFixed(0)}%</span>
                <span className="text-orange-400">Rocket: {(result.proba.rocket_body * 100).toFixed(0)}%</span>
                <span className="text-red-400">Debris: {(result.proba.debris * 100).toFixed(0)}%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mapa de Satélites Embebido */}
      <div className="mt-10">
        <h2 className="text-2xl font-bold mb-4">🗺️ Mapa de Satélites en Tiempo Real</h2>
        <iframe
          src="https://satellitemap.space/"
          className="w-full h-[700px] rounded border border-gray-600"
          title="Satellite Map"
          allowFullScreen
        />
        <p className="text-gray-400 mt-4">
          Si no carga, probá estos visualizadores alternativos:
          <a href="https://keeptrack.space/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline ml-2">KeepTrack</a>
          <a href="https://www.n2yo.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline ml-2">N2YO</a>
          <a href="https://platform.leolabs.space/visualization" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline ml-2">LeoLabs</a>
        </p>
      </div>
    </main>
  );
}

