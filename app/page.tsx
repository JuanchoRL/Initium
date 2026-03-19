'use client'
import BenefitsSection from "@/components/landing/BenefitsSection";
import CandidateSection from "@/components/landing/CandidateSection";
import CtaSection from "@/components/landing/CtaSection";
import DashboardSection from "@/components/landing/DashboardSection";
import DemoFormModal from "@/components/landing/DemoFormModal";
import Footer from "@/components/landing/Footer";
import HeroSection from "@/components/landing/HeroSection";
import Navbar from "@/components/landing/Navbar";
import ProblemSection from "@/components/landing/ProblemSection";
import SolutionSection from "@/components/landing/SolutionSection";
import UseCasesSection from "@/components/landing/UseCasesSection";
import { useEffect, useState } from "react";

export default function Page() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const STORAGE_KEY = "landing_restore_hash";
    const storedHash = sessionStorage.getItem(STORAGE_KEY);
    if (!storedHash) return;

    // Only restore when the user is back on the landing page.
    if (window.location.pathname !== "/") return;

    // If a hash already exists in the URL, don't override it.
    if (window.location.hash) return;

    if (!storedHash.startsWith("#")) return;
    const targetId = storedHash.slice(1);
    const el = document.getElementById(targetId);
    if (!el) return;

    // Restore URL + scroll so the user actually "comes back" to the same section.
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}${storedHash}`);

    // Account for the fixed navbar height.
    const NAVBAR_OFFSET_PX = 72;
    const top = el.getBoundingClientRect().top + window.scrollY - NAVBAR_OFFSET_PX;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });

    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar onRequestDemo={openDemo} />
      <HeroSection onRequestDemo={openDemo} />
      <ProblemSection />
      <SolutionSection />
      <CandidateSection />
      <DashboardSection />
      <BenefitsSection />
      <UseCasesSection />
      <CtaSection onRequestDemo={openDemo} />
      <Footer />
      <DemoFormModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
};
