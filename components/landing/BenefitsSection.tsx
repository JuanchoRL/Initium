import { motion } from "framer-motion";
import { Target, Lightbulb, Sparkles, BrainCircuit, Timer } from "lucide-react";

const benefits = [
  { icon: Target, title: "Evaluación objetiva", desc: "Métricas estandarizadas que eliminan sesgos cognitivos del proceso." },
  { icon: Lightbulb, title: "Insights accionables", desc: "Recomendaciones claras basadas en modelos conductuales validados." },
  { icon: Sparkles, title: "Experiencia memorable", desc: "Los candidatos disfrutan el proceso y perciben una marca innovadora." },
  { icon: BrainCircuit, title: "Análisis profundo", desc: "Miles de data points por sesión capturan el perfil real del candidato." },
  { icon: Timer, title: "Decisiones rápidas", desc: "Reduce el time-to-hire un 40% con comparación automática de perfiles." },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

const BenefitsSection = () => {
  return (
    <section id="beneficios" className="py-24 md:py-32 relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block text-xs font-semibold text-teal tracking-[0.2em] uppercase mb-4">Beneficios</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Por qué los equipos eligen <span className="gradient-text">Initium+</span>.
          </h2>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto"
        >
          {benefits.map((b) => (
            <motion.div
              key={b.title}
              variants={item}
              className="group p-6 rounded-2xl glass-card hover:shadow-lg hover:shadow-primary/[0.05] transition-all duration-500 hover:-translate-y-1"
            >
              <div className="w-10 h-10 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-500">
                <b.icon className="h-5 w-5 text-teal" strokeWidth={1.5} />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default BenefitsSection;
