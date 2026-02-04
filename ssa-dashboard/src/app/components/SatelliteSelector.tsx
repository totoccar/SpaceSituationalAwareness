"use client";

import { useState, useEffect, useMemo } from "react";

type Satellite = {
    norad_id: string;
    name: string;
    line1: string;
    line2: string;
    epoch: string;
    age_hours: number;
    age_days: number;
    is_stale: boolean;
};

type Props = {
    onSelect: (line1: string, line2: string, name: string) => void;
};

export default function SatelliteSelector({ onSelect }: Props) {
    const [satellites, setSatellites] = useState<Satellite[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [ageFilter, setAgeFilter] = useState<"all" | "fresh" | "recent" | "stale">("all");
    const [isOpen, setIsOpen] = useState(false);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    async function fetchSatellites() {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/satellites?limit=500`);
            if (!res.ok) throw new Error("Error cargando satélites");
            const data = await res.json();
            setSatellites(data);
        } catch (e) {
            setError(e instanceof Error ? e.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        if (isOpen && satellites.length === 0) {
            fetchSatellites();
        }
    }, [isOpen]);

    const filtered = useMemo(() => {
        let result = satellites;

        // Filtrar por búsqueda
        if (search) {
            const s = search.toLowerCase();
            result = result.filter(
                (sat) =>
                    sat.name.toLowerCase().includes(s) ||
                    sat.norad_id.includes(s)
            );
        }

        // Filtrar por edad
        if (ageFilter === "fresh") {
            result = result.filter((sat) => sat.age_hours < 12);
        } else if (ageFilter === "recent") {
            result = result.filter((sat) => sat.age_days < 1);
        } else if (ageFilter === "stale") {
            result = result.filter((sat) => sat.is_stale);
        }

        return result;
    }, [satellites, search, ageFilter]);

    function handleSelect(sat: Satellite) {
        onSelect(sat.line1, sat.line2, sat.name);
        setIsOpen(false);
    }

    function getAgeColor(sat: Satellite) {
        if (sat.is_stale) return "text-red-400";
        if (sat.age_days > 1) return "text-yellow-400";
        return "text-green-400";
    }

    return (
        <div className="mb-6">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded text-lg font-semibold"
            >
                {isOpen ? "❌ Cerrar Lista" : "📡 Seleccionar Satélite de CelesTrak"}
            </button>

            {isOpen && (
                <div className="mt-4 p-4 bg-gray-800 border border-gray-600 rounded max-w-2xl">
                    {/* Controles */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        <input
                            type="text"
                            placeholder="🔍 Buscar por nombre o NORAD ID..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="flex-1 min-w-[200px] p-2 bg-gray-900 border border-gray-600 rounded text-white"
                        />
                        <select
                            value={ageFilter}
                            onChange={(e) => setAgeFilter(e.target.value as typeof ageFilter)}
                            className="p-2 bg-gray-900 border border-gray-600 rounded text-white"
                        >
                            <option value="all">Todos</option>
                            <option value="fresh">🟢 Frescos (&lt;12h)</option>
                            <option value="recent">🟡 Recientes (&lt;1 día)</option>
                            <option value="stale">🔴 Viejos (&gt;3 días)</option>
                        </select>
                        <button
                            onClick={fetchSatellites}
                            disabled={loading}
                            className="px-3 py-2 bg-blue-600 hover:bg-blue-500 rounded disabled:opacity-50"
                        >
                            {loading ? "⏳" : "🔄"}
                        </button>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-900 border border-red-600 rounded text-red-200">
                            ❌ {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="text-center py-8 text-gray-400">
                            ⏳ Cargando satélites de CelesTrak...
                        </div>
                    ) : (
                        <>
                            <div className="text-sm text-gray-400 mb-2">
                                Mostrando {filtered.length} de {satellites.length} satélites
                            </div>

                            {/* Lista de satélites */}
                            <div className="max-h-80 overflow-y-auto space-y-1">
                                {filtered.slice(0, 100).map((sat) => (
                                    <button
                                        key={sat.norad_id}
                                        onClick={() => handleSelect(sat)}
                                        className="w-full text-left p-3 bg-gray-900 hover:bg-gray-700 rounded border border-gray-700 hover:border-purple-500 transition-colors"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <span className="font-semibold text-white">{sat.name}</span>
                                                <span className="ml-2 text-gray-400 text-sm">#{sat.norad_id}</span>
                                            </div>
                                            <span className={`text-sm ${getAgeColor(sat)}`}>
                                                {sat.age_days < 1
                                                    ? `${sat.age_hours.toFixed(1)}h`
                                                    : `${sat.age_days.toFixed(1)}d`}
                                            </span>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 font-mono truncate">
                                            {sat.line1.substring(0, 50)}...
                                        </div>
                                    </button>
                                ))}

                                {filtered.length > 100 && (
                                    <div className="text-center py-2 text-gray-500 text-sm">
                                        ... y {filtered.length - 100} más. Usá el buscador para filtrar.
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
