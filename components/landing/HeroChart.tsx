import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const data = [
  { subject: "Decisión", A: 85 },
  { subject: "Liderazgo", A: 72 },
  { subject: "Resolución", A: 90 },
  { subject: "Atención", A: 68 },
  { subject: "Estrategia", A: 82 },
  { subject: "Presión", A: 76 },
];

const HeroChart = () => {
  return (
    <div className="relative glass-card gradient-border rounded-2xl p-6 pulse-glow">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.2em]">Perfil cognitivo</p>
          <p className="text-sm font-semibold text-foreground mt-1">Candidato #2847</p>
        </div>
        <span className="inline-flex items-center rounded-full bg-metric-high/10 px-3 py-1 font-mono text-[10px] font-semibold text-metric-high tracking-wide">
          87% match
        </span>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))", fontFamily: '"JetBrains Mono", monospace' }}
          />
          <Radar
            name="Competencias"
            dataKey="A"
            stroke="hsl(var(--teal))"
            fill="hsl(var(--teal))"
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-3 gap-3 mt-3 pt-4 border-t border-border/60">
        {[
          { label: "T. reacción", value: "340ms", color: "text-metric-high" },
          { label: "Consistencia", value: "92%", color: "text-metric-high" },
          { label: "Riesgo", value: "Moderado", color: "text-metric-mid" },
        ].map((m) => (
          <div key={m.label} className="text-center">
            <p className="font-mono text-[10px] text-muted-foreground tracking-wide">{m.label}</p>
            <p className={`font-mono text-sm font-bold ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HeroChart;
