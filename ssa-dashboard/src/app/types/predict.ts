export type ObjectClass = "payload" | "rocket_body" | "debris" | "unknown";
export type Region = "LEO" | "MEO" | "GEO" | "UNKNOWN";

export type PredictRequest = {
    id: number;
    line1: string;
    line2: string;
    /** Nombre del satélite para mejorar clasificación */
    satellite_name?: string;
    /** Umbral mínimo de confianza (si confidence < threshold → "unknown") */
    threshold?: number;
};

/** Información sobre la edad del TLE */
export type TleInfo = {
    epoch: string;
    age_hours: number;
    age_days: number;
    is_stale: boolean;
    warning?: string;
};

/** Datos de propagación SGP4 */
export type PropagationData = {
    position_km: { x: number; y: number; z: number };
    velocity_kms: { x: number; y: number; z: number };
    calculated_at: string;
};

export type PredictResponse = {
    object_id: number;
    satellite_name?: string;
    predicted_class: ObjectClass;
    classification_reason: string;
    orbital_stats: {
        altitude_km: number;
        velocity_kms: number;
    };
    confidence: number;
    region: Region;
    proba: Record<Exclude<ObjectClass, "unknown">, number>;
    tle_info?: TleInfo;
    propagation?: PropagationData;
    features?: Record<string, number>;
    metadata: {
        model_version: string;
        processing_time_ms: number;
    };
};


