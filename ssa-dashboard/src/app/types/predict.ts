export type ObjectClass = "payload" | "rocket_body" | "debris" | "unknown";
export type Region = "LEO" | "MEO" | "GEO" | "UNKNOWN";

export type PredictRequest = {
    line1: string;
    line2: string;
    threshold?: number;
};

export type PredictResponse = {
    predicted_class: ObjectClass;
    confidence: number;
    region: Region;
    proba: Record<Exclude<ObjectClass, "unknown">, number>;
    features?: Record<string, number>;
    explanation?: unknown;
};
