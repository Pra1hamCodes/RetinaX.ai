import CTASection from "@/components/landing/CTASection";
import HeroSection from "@/components/landing/HeroSection";
import OurSystem from "@/components/landing/OurSystem";
import WhatIsDR from "@/components/landing/WhatIsDR";
import PageWrapper from "@/components/layout/PageWrapper";

export default function LandingPage() {
  return (
    <PageWrapper fullBleed>
      <HeroSection />
      <WhatIsDR />
      <OurSystem />
      <CTASection />
    </PageWrapper>
  );
}
