import { motion } from "framer-motion";
import { Building2, User } from "lucide-react";

const UseCasesSection = () => {
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
          <span className="inline-block text-xs font-semibold text-teal tracking-[0.2em] uppercase mb-4">Casos de uso</span>
          <h2 className="text-3xl md:text-4xl font-extrabold text-foreground tracking-tight">
            Diseñado para ambos lados.
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card rounded-2xl p-8 group hover:shadow-xl hover:shadow-primary/[0.05] transition-all duration-500"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <Building2 className="h-6 w-6 text-primary" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-5">Para empresas</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              {[
                "Mejorar la precisión del proceso de selección",
                "Comparar candidatos con métricas objetivas",
                "Detectar talento oculto que los CVs no revelan",
              ].map((text) => (
                <li key={text} className="flex gap-3 items-start">
                  <span className="w-1 h-1 rounded-full bg-primary mt-2 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="glass-card rounded-2xl p-8 group hover:shadow-xl hover:shadow-teal/[0.05] transition-all duration-500"
          >
            <div className="w-12 h-12 rounded-xl bg-teal/10 border border-teal/20 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-500">
              <User className="h-6 w-6 text-teal" strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-5">Para candidatos</h3>
            <ul className="space-y-4 text-sm text-muted-foreground">
              {[
                "Conocer su perfil cognitivo y fortalezas",
                "Compartir resultados con reclutadores",
                "Experiencia única frente a tests tradicionales",
              ].map((text) => (
                <li key={text} className="flex gap-3 items-start">
                  <span className="w-1 h-1 rounded-full bg-teal mt-2 flex-shrink-0" />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;
