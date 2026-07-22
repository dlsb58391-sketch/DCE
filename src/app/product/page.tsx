import type { Metadata } from "next";
import { ProductPitch } from "@/components/ProductPitch";

export const metadata: Metadata = {
  title: "Clinva — Clinic management on WhatsApp",
  description:
    "Clinva turns WhatsApp into your clinic's front desk: patients book and confirm by chat, you manage the day from one dashboard, and every treatment, payment and follow-up is tracked automatically. Bilingual (Arabic/English).",
  alternates: { canonical: "/product" },
  icons: { icon: "/clinva-mark.svg", shortcut: "/clinva-mark.svg", apple: "/clinva-mark.svg" },
  openGraph: {
    title: "Clinva — Clinic management on WhatsApp",
    description:
      "Bookings, patients, operations & payments in one bilingual dashboard. Book a live demo.",
    url: "/product",
    type: "website",
  },
};

export default function ProductPage() {
  return <ProductPitch />;
}
