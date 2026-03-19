'use client'	
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import HeroChart from "./HeroChart";
import { useRouter } from "next/navigation";
import { LandingButton } from "./LandingButton";

const HeroSection = ({ onRequestDemo }: { onRequestDemo?: () => void }) => {

  const router = useRouter();

  return (
    <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
      {/* Subtle grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
        backgroundSize: '40px 40px',
      }} />
      
      {/* Gradient orbs */}
      <div className="absolute top-20 left-[-200px] w-[500px] h-[500px] rounded-full bg-primary/[0.06] blur-[120px]" />
      <div className="absolute bottom-0 right-[-150px] w-[400px] h-[400px] rounded-full bg-teal/[0.06] blur-[120px]" />

      <div className="container mx-auto px-6 relative">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-16 items-center">
          <div>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal/10 border border-teal/20 mb-8"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse" />
              <span className="text-xs font-medium text-teal-dark tracking-wide">Evaluación conductual de talento</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold leading-[1.08] text-foreground mb-6 tracking-tight"
            >
              Evaluar talento{" "}
              <span className="gradient-text">ya no es</span>{" "}
              un formulario.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="text-lg text-muted-foreground leading-relaxed max-w-lg mb-10"
            >
              Transformamos patrones de comportamiento en decisiones de reclutamiento más inteligentes mediante experiencias gamificadas.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col sm:flex-row gap-4"
            >
              <LandingButton variant="hero" size="xl" onClick={onRequestDemo}>
                Solicitar demo <ArrowRight className="ml-1 h-4 w-4" />
              </LandingButton>
              <LandingButton variant="hero-outline" size="xl" onClick={() => router.push('/play')}>
                <Play className="mr-1 h-4 w-4" /> Quiero probar
              </LandingButton>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95, x: 30 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="hidden lg:block"
          >
            <div className="float-animation">
              <HeroChart />
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
