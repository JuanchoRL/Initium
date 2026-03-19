import { motion } from "framer-motion";
import { Eye, Crown, Puzzle, Zap } from "lucide-react";

const games = [
  {
    icon: Eye,
    title: "Atención y memoria",
    description: "Secuencias visuales que miden capacidad de retención, enfoque sostenido y resistencia a distractores.",
    metric: "Precisión: 94%",
    color: "text-metric-high",
    gradient: "from-teal/10 to-transparent",
  },
  {
    icon: Crown,
    title: "Liderazgo y priorización",
    description: "Escenarios de recursos limitados donde el candidato debe asignar, delegar y decidir bajo restricciones temporales.",
    metric: "Efectividad: 78%",
    color: "text-metric-mid",
    gradient: "from-primary/10 to-transparent",
  },
  {
    icon: Puzzle,
    title: "Resolución de problemas",
    description: "Rompecabezas lógicos adaptativos que ajustan dificultad en tiempo real según el rendimiento del candidato.",
    metric: "Velocidad: 420ms",
    color: "text-metric-high",
    gradient: "from-metric-high/10 to-transparent",
  },
  {
    icon: Zap,
    title: "Decisiones bajo riesgo",
    description: "Simulaciones probabilísticas que revelan tolerancia al riesgo, aversión a la pérdida y estilo decisorio.",
    metric: "Consistencia: 86%",
    color: "text-metric-high",
    gradient: "from-primary-light/10 to-transparent",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, scale: 0.95, y: 16 },
  show: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

const CandidateSection = () => {
  return (
    <section className="py-24 md:py-32 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block text-xs font-semibold text-teal tracking-[0.2em] uppercase mb-4">Experiencia del candidato</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4 tracking-tight">
            Minijuegos que revelan <span className="gradient-text">talento real</span>.
          </h2>
          <p className="text-muted-foreground text-lg">
            Cada interacción genera cientos de puntos de datos conductuales invisibles para el candidato.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto"
        >
          {games.map((g) => (
            <motion.div
              key={g.title}
              variants={item}
              className="group glass-card rounded-2xl p-7 hover:shadow-xl hover:shadow-primary/[0.05] transition-all duration-500 hover:-translate-y-1 overflow-hidden relative"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${g.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              <div className="relative z-10">
                <div className="flex items-start justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                    <g.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <span className={`font-mono text-[10px] font-bold tracking-wide ${g.color} bg-background/60 backdrop-blur-sm rounded-full px-3 py-1`}>
                    {g.metric}
                  </span>
                </div>
                <h3 className="text-base font-bold text-foreground mb-2">{g.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{g.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default CandidateSection;
