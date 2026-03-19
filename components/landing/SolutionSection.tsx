import { motion } from "framer-motion";
import { Gamepad2, Brain, BarChart3 } from "lucide-react";

const steps = [
  {
    num: "01",
    icon: Gamepad2,
    title: "El candidato juega",
    description: "Minijuegos diseñados con base en psicometría. Sin formularios, sin aburrimiento. El candidato revela su comportamiento natural mientras interactúa.",
    accent: "from-teal/20 to-teal/5",
    iconBg: "bg-teal/10 border-teal/20",
    iconColor: "text-teal",
  },
  {
    num: "02",
    icon: Brain,
    title: "Analizamos su comportamiento",
    description: "Cada clic, tiempo de reacción y patrón de decisión se procesa a través de modelos conductuales validados científicamente.",
    accent: "from-primary/20 to-primary/5",
    iconBg: "bg-primary/10 border-primary/20",
    iconColor: "text-primary",
  },
  {
    num: "03",
    icon: BarChart3,
    title: "Generamos insights accionables",
    description: "Los reclutadores reciben un perfil cognitivo completo con métricas comparables y recomendaciones basadas en datos.",
    accent: "from-metric-high/20 to-metric-high/5",
    iconBg: "bg-metric-high/10 border-metric-high/20",
    iconColor: "text-metric-high",
  },
];

const SolutionSection = () => {
  return (
    <section id="solucion" className="py-24 md:py-32 relative">
      {/* Subtle gradient divider */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-20"
        >
          <span className="inline-block text-xs font-semibold text-teal tracking-[0.2em] uppercase mb-4">Nuestra solución</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4 tracking-tight">
            Gamificación + Ciencia + <span className="gradient-text">Datos</span>
          </h2>
          <p className="text-muted-foreground text-lg">
            Un proceso de tres fases que transforma el juego en inteligencia de talento.
          </p>
        </motion.div>

        <div className="max-w-3xl mx-auto relative">
          {/* Connecting line */}
          <div className="absolute left-[30px] top-[60px] bottom-[60px] w-px bg-gradient-to-b from-teal/30 via-primary/30 to-metric-high/30 hidden md:block" />

          <div className="space-y-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="flex gap-8 items-start group"
              >
                <div className={`relative z-10 flex-shrink-0 w-[60px] h-[60px] rounded-2xl ${step.iconBg} border flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:shadow-lg`}>
                  <step.icon className={`h-6 w-6 ${step.iconColor}`} strokeWidth={1.5} />
                </div>
                <div className={`flex-1 rounded-2xl bg-gradient-to-r ${step.accent} p-8 border border-border/40 transition-all duration-500 group-hover:shadow-md`}>
                  <span className="font-mono text-[10px] font-bold tracking-[0.3em] text-muted-foreground">{step.num}</span>
                  <h3 className="text-xl font-bold text-foreground mt-1 mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default SolutionSection;
