import { Button } from "@/components/ui/button";
import InitiumLogo from "./InitiumLogo";
import { useState, useEffect } from "react";
import { LandingButton } from "./LandingButton";

const Navbar = ({ onRequestDemo }: { onRequestDemo?: () => void }) => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
      scrolled ? "glass-nav shadow-sm" : "bg-transparent"
    }`}>
      <div className="container mx-auto flex items-center justify-between h-16 px-6">
        <InitiumLogo size="sm" />
        <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
          {["Problema", "Solución", "Dashboard", "Beneficios"].map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}
              className="relative hover:text-foreground transition-colors duration-300 after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-teal after:transition-all after:duration-300 hover:after:w-full"
            >
              {item}
            </a>
          ))}
        </div>
        <LandingButton variant="hero" size="sm" onClick={onRequestDemo}>Solicitar demo</LandingButton>
      </div>
    </nav>
  );
};

export default Navbar;
