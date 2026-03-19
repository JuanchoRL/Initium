import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { LandingButton } from "./LandingButton";

const CtaSection = ({ onRequestDemo }: { onRequestDemo?: () => void }) => {
  return (
    <section className="py-24 md:py-32 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* Background glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[300px] rounded-full bg-primary/[0.04] blur-[100px]" />
      </div>

      <div className="container mx-auto px-6 relative">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-2xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold text-foreground mb-6 tracking-tight">
            El futuro del recruiting{" "}
            <span className="gradient-text">es conductual</span>.
          </h2>
          <p className="text-muted-foreground text-lg mb-10 max-w-lg mx-auto">
            Únete a los equipos que ya transformaron su proceso de selección con ciencia de datos y gamificación.
          </p>
          <LandingButton variant="hero" size="xl" onClick={onRequestDemo}>
            Solicitar demo <ArrowRight className="ml-2 h-4 w-4" />
          </LandingButton>
        </motion.div>
      </div>
    </section>
  );
};

export default CtaSection;
