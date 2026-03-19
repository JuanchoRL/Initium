import { motion } from "framer-motion";
import { FileText, Users, ClipboardList } from "lucide-react";

const problems = [
  {
    icon: FileText,
    title: "CVs que mienten",
    description: "El 78% de los candidatos exagera competencias que nunca se validan. Los currículos no reflejan habilidades reales.",
    stat: "78%",
    statLabel: "exageran competencias",
  },
  {
    icon: Users,
    title: "Entrevistas subjetivas",
    description: "Las decisiones basadas en «feeling» generan sesgos sistemáticos que cuestan millones en rotación temprana.",
    stat: "3x",
    statLabel: "más rotación",
  },
  {
    icon: ClipboardList,
    title: "Tests obsoletos",
    description: "Las evaluaciones tradicionales son aburridas, poco predictivas y no capturan comportamiento real bajo presión.",
    stat: "12%",
    statLabel: "valor predictivo",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } },
};

const ProblemSection = () => {
  return (
    <section id="problema" className="py-24 md:py-32 relative">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <span className="inline-block text-xs font-semibold text-teal tracking-[0.2em] uppercase mb-4">El problema</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground mb-4 tracking-tight">
            El reclutamiento está roto.
          </h2>
          <p className="text-muted-foreground text-lg">
            Los métodos tradicionales fallan en predecir el desempeño real.
          </p>
        </motion.div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid md:grid-cols-3 gap-6"
        >
          {problems.map((p) => (
            <motion.div
              key={p.title}
              variants={item}
              className="group glass-card rounded-2xl p-8 hover:shadow-xl hover:shadow-primary/[0.06] transition-all duration-500 hover:-translate-y-1"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="w-11 h-11 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center group-hover:bg-primary/10 transition-colors duration-300">
                  <p.icon className="h-5 w-5 text-primary" strokeWidth={1.5} />
                </div>
                <div className="text-right">
                  <p className="font-mono text-2xl font-bold text-metric-low">{p.stat}</p>
                  <p className="font-mono text-[10px] text-muted-foreground tracking-wide">{p.statLabel}</p>
                </div>
              </div>
              <h3 className="text-lg font-bold text-foreground mb-3">{p.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{p.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default ProblemSection;
