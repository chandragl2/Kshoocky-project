import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";
import {
  HeroSection,
  ServicesSection,
  WhyUsSection,
  HowToBuySection,
  CtaSection,
} from "@/components/sections";

export default function HomePage() {
  return (
    <main>
      <Navbar />
      <HeroSection />
      <ServicesSection />
      <WhyUsSection />
      <HowToBuySection />
      <CtaSection />
      <Footer />
    </main>
  );
}
