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
import { useState } from "react";

export default function Page() {
  const [demoOpen, setDemoOpen] = useState(false);
  const openDemo = () => setDemoOpen(true);

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
