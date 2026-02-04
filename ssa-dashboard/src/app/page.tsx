"use client";

import { useMemo, useState } from "react";

type Proba = { payload: number; rocket_body: number; debris: number };
type Prediction = {
  predicted_class: "payload" | "rocket_body" | "debris" | "unknown";
  confidence: number;
  region: "LEO" | "MEO" | "GEO" | "UNKNOWN";
  proba: Proba;
};

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
  const [result, setResult] = useState<Prediction | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lines = useMemo(() => {
    return tle
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }, [tle]);

  function validateTLE(ls: string[]) {
    if (ls.length !== 2) return "Pegá exactamente 2 líneas (line1 y line2).";
    if (!ls[0].startsWith("1 ")) return "La primera línea debe empezar con '1 '.";
    if (!ls[1].startsWith("2 ")) return "La segunda línea debe empezar con '2 '.";
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

    // Mock: simulamos una respuesta del backend (FastAPI) para armar la UI.
    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 450));

      // Probabilidades dummy (solo para UI)
      const p: Proba = { payload: 0.12, rocket_body: 0.18, debris: 0.70 };
      const max = Math.max(p.payload, p.rocket_body, p.debris);
      const predicted =
        max === p.debris ? "debris" : max === p.rocket_body ? "rocket_body" : "payload";

      const predicted_class = max < threshold ? "unknown" : predicted;

      setResult({
        predicted_class,
        confidence: max,
        region: "LEO",
        proba: p,
      });
    } catch (e) {
      setError("Falló la predicción (mock).");
    } finally {
      setLoading(false);
    }
  }

  const banner =
    result?.predicted_class === "unknown"
      ? { label: "UNKNOWN", style: "bg-yellow-500/15 text-yellow-300 border-yellow-500/30" }
      : result
        ? { label: result.predicted_class.toUpperCase(), style: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" }
        : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            🛰️ SSA Dashboard (MVP UI)
          </h1>
          <p className="mt-2 text-zinc-400">
            Pegá un TLE y obtené la clasificación: <span className="text-zinc-200">payload</span>,{" "}
            <span className="text-zinc-200">rocket_body</span>,{" "}
            <span className="text-zinc-200">debris</span> (o <span className="text-zinc-200">unknown</span> por baja confianza).
          </p>
        </header>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Input */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 shadow-sm">
            <h2 className="text-lg font-medium">📥 Input TLE</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Dos líneas. Después lo conectamos a FastAPI.
            </p>

            <textarea
              className="mt-4 h-36 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-950/40 p-3 font-mono text-sm text-zinc-100 outline-none focus:border-zinc-600"
              value={tle}
              onChange={(e) => setTle(e.target.value)}
              spellCheck={false}
            />

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={onPredict}
                disabled={loading}
                className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-white disabled:opacity-50"
              >
                {loading ? "Predicting..." : "Predict (mock)"}
              </button>

              <div className="flex items-center gap-2">
                <label className="text-sm text-zinc-400">Umbral unknown</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.05}
                  value={threshold}
                  onChange={(e) => setThreshold(clamp01(Number(e.target.value)))}
                  className="w-20 rounded-lg border border-zinc-800 bg-zinc-950/40 px-2 py-1 text-sm outline-none focus:border-zinc-600"
                />
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
                {error}
              </div>
            )}
          </section>

          {/* Output */}
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-5 shadow-sm">
            <h2 className="text-lg font-medium">📤 Output</h2>
            <p className="mt-1 text-sm text-zinc-400">
              Resultado y probabilidades por clase.
            </p>

            {!result ? (
              <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950/30 p-6 text-sm text-zinc-400">
                Aún no hay predicción. Pegá un TLE y apretá <span className="text-zinc-200">Predict</span>.
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {banner && (
                  <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${banner.style}`}>
                    <span className="font-semibold">{banner.label}</span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-zinc-300">conf: {result.confidence.toFixed(2)}</span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-zinc-300">región: {result.region}</span>
                  </div>
                )}

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                  <h3 className="text-sm font-medium text-zinc-200">Probabilidades</h3>
                  <div className="mt-3 space-y-3">
                    {(
                      [
                        ["payload", result.proba.payload],
                        ["rocket_body", result.proba.rocket_body],
                        ["debris", result.proba.debris],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-3">
                        <div className="w-24 text-xs text-zinc-400">{k}</div>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-800">
                          <div
                            className="h-full rounded-full bg-zinc-200"
                            style={{ width: `${Math.round(v * 100)}%` }}
                          />
                        </div>
                        <div className="w-10 text-right text-xs text-zinc-300">
                          {Math.round(v * 100)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-zinc-800 bg-zinc-950/30 p-4">
                  <h3 className="text-sm font-medium text-zinc-200">Notas</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-400">
                    <li>Ahora es mock. Después el botón llama a <code className="text-zinc-200">/predict</code>.</li>
                    <li>El umbral te habilita la clase <code className="text-zinc-200">unknown</code>.</li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        </div>

        <footer className="mt-10 text-xs text-zinc-500">
          SSA Object Classifier · MVP UI
        </footer>
      </div>
    </main>
  );
}
