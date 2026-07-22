import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Services } from "@/components/Services";
import { ImplantShowcase } from "@/components/ImplantShowcase";
import { About } from "@/components/About";
import { Offers } from "@/components/Offers";
import { ResultsGallery } from "@/components/ResultsGallery";
import { VideoShowcase } from "@/components/VideoShowcase";
import { Team } from "@/components/Team";
import { Testimonials } from "@/components/Testimonials";
import { BookingSection } from "@/components/BookingSection";
import { LocationMap } from "@/components/LocationMap";
import { Footer } from "@/components/Footer";
import { ThemeApplier } from "@/components/ThemeApplier";
import { OfferPopup } from "@/components/OfferPopup";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";

export default function Home() {
  return (
    <>
      <ThemeApplier />
      <Navbar />
      <main className="flex-1">
        <Hero />
        <Services />
        <ImplantShowcase />
        <About />
        <Offers />
        <ResultsGallery />
        <VideoShowcase />
        <Team />
        <Testimonials />
        <BookingSection />
        <LocationMap />
      </main>
      <Footer />
      <OfferPopup />
      <WhatsAppFloat />
    </>
  );
}
