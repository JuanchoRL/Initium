import { useState } from "react";
import { motion } from "framer-motion";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const candidates = [
  {
    name: "Ana García",
    role: "Product Manager",
    match: 92,
    data: [
      { s: "Decisión", v: 90 }, { s: "Liderazgo", v: 85 }, { s: "Resolución", v: 88 },
      { s: "Atención", v: 75 }, { s: "Estrategia", v: 92 }, { s: "Presión", v: 80 },
    ],
  },
  {
    name: "Carlos Ruiz",
    role: "Tech Lead",
    match: 87,
    data: [
      { s: "Decisión", v: 78 }, { s: "Liderazgo", v: 92 }, { s: "Resolución", v: 70 },
      { s: "Atención", v: 88 }, { s: "Estrategia", v: 75 }, { s: "Presión", v: 90 },
    ],
  },
  {
    name: "Laura Méndez",
    role: "UX Designer",
    match: 74,
    data: [
      { s: "Decisión", v: 65 }, { s: "Liderazgo", v: 70 }, { s: "Resolución", v: 85 },
      { s: "Atención", v: 92 }, { s: "Estrategia", v: 68 }, { s: "Presión", v: 72 },
    ],
  },
];

const getMatchColor = (match: number) => {
  if (match >= 85) return "text-metric-high";
  if (match >= 70) return "text-metric-mid";
  return "text-metric-low";
};

const getMatchBg = (match: number) => {
  if (match >= 85) return "bg-metric-high/10";
  if (match >= 70) return "bg-metric-mid/10";
  return "bg-metric-low/10";
};

const DashboardSection = () => {
  const [active, setActive] = useState(0);
  const current = candidates[active];

  const sortedDesc = [...current.data].sort((a, b) => b.v - a.v);
  const sortedAsc = [...current.data].sort((a, b) => a.v - b.v);

  return (
    <section id="dashboard" className="py-24 md:py-32 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block text-xs font-semibold text-teal tracking-[0.2em] uppercase mb-4">Dashboard para reclutadores</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4 tracking-tight">
            De intuición a <span className="gradient-text">datos</span>.
          </h2>
          <p className="text-muted-foreground text-lg">
            Compara candidatos en tiempo real con perfiles cognitivos interactivos.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-4xl mx-auto glass-card gradient-border rounded-2xl overflow-hidden"
        >
          <div className="grid md:grid-cols-[280px_1fr]">
            {/* Candidate list */}
            <div className="border-b md:border-b-0 md:border-r border-border/40 p-6">
              <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-5">Candidatos</p>
              <div className="space-y-2">
                {candidates.map((c, i) => (
                  <button
                    key={c.name}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    className={`w-full text-left px-4 py-3.5 rounded-xl transition-all duration-300 flex items-center justify-between group ${
                      active === i
                        ? "bg-primary/5 border border-primary/20 shadow-sm"
                        : "hover:bg-accent/60 border border-transparent"
                    }`}
                  >
                    <div>
                      <span className={`text-sm font-semibold block transition-colors duration-300 ${active === i ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                        {c.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono">{c.role}</span>
                    </div>
                    <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-full ${getMatchColor(c.match)} ${getMatchBg(c.match)}`}>
                      {c.match}%
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-5 border-t border-border/40 space-y-3">
                <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Top competencias</p>
                {sortedDesc.slice(0, 2).map((d) => (
                  <div key={d.s} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{d.s}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-metric-high"
                          initial={{ width: 0 }}
                          animate={{ width: `${d.v}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                      <span className="font-mono font-bold text-metric-high w-8 text-right">{d.v}%</span>
                    </div>
                  </div>
                ))}
                {sortedAsc.slice(0, 1).map((d) => (
                  <div key={d.s} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{d.s}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full bg-border overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-metric-low"
                          initial={{ width: 0 }}
                          animate={{ width: `${d.v}%` }}
                          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                      <span className="font-mono font-bold text-metric-low w-8 text-right">{d.v}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Radar chart */}
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-base font-bold text-foreground">{current.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{current.role}</p>
                </div>
                <span className={`font-mono text-xs font-bold px-3 py-1 rounded-full ${getMatchColor(current.match)} ${getMatchBg(current.match)}`}>
                  {current.match}% match
                </span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={current.data}>
                  <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <PolarAngleAxis
                    dataKey="s"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: '"JetBrains Mono", monospace' }}
                  />
                  <Radar
                    name={current.name}
                    dataKey="v"
                    stroke="hsl(var(--teal))"
                    fill="hsl(var(--teal))"
                    fillOpacity={0.1}
                    strokeWidth={2}
                    animationDuration={600}
                    animationEasing="ease-out"
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default DashboardSection;
