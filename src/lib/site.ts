/**
 * Single source of truth for clinic identity used by SEO (metadata, JSON-LD,
 * sitemap, Open Graph) and anywhere else that needs canonical business data.
 * Identity fields are derived from the ACTIVE clinic config (src/lib/clinics);
 * generic settings (hours, price range, service list) are shared here.
 */
import { activeClinic } from "./clinics";

const clinic = activeClinic();

export const site = {
  name: clinic.doctorName.en,
  shortName: clinic.brand.en,
  nameAr: clinic.doctorName.ar,
  /** SEO title (default) + template, derived from the active clinic. */
  titleDefault: `${clinic.doctorName.en} — ${clinic.role.en}`,
  titleTemplate: `%s | ${clinic.brand.en}`,
  /** Public base URL — override per environment via NEXT_PUBLIC_SITE_URL. */
  url: process.env.NEXT_PUBLIC_SITE_URL || process.env.APP_URL || "http://localhost:3000",
  description: clinic.seo.description,
  descriptionAr: clinic.seo.descriptionAr,
  locale: "en_US",
  localeAlt: "ar_EG",
  keywords: clinic.seo.keywords,
  phone: clinic.contact.phone,
  phoneDisplay: clinic.contact.phoneDisplay,
  /**
   * WhatsApp number patients message to confirm/book (digits only, no +).
   * Comes from the active clinic config; NEXT_PUBLIC_CLINIC_WHATSAPP can still
   * override it per environment.
   */
  whatsapp: process.env.NEXT_PUBLIC_CLINIC_WHATSAPP || clinic.contact.whatsapp,
  email: clinic.contact.email,
  address: {
    street: clinic.contact.address.street,
    locality: clinic.contact.address.locality,
    region: clinic.contact.address.region,
    country: clinic.contact.address.country,
    postalCode: clinic.contact.address.postalCode,
  },
  /** Approximate geo (update with exact clinic coordinates). */
  geo: { lat: clinic.contact.geo.lat, lng: clinic.contact.geo.lng },
  /** Sat–Thu 12:00–22:00 (Friday closed). */
  openingHours: [
    {
      days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"],
      opens: "12:00",
      closes: "22:00",
    },
  ],
  priceRange: "$$",
  logo: clinic.logo || "/bdic-logo.jpg",
  ogImage: "/opengraph-image",
  social: clinic.contact.social,
  services: [
    "Dental Implants",
    "Hollywood Smile / Veneers",
    "Orthodontics",
    "Teeth Whitening",
    "Root Canal Treatment",
    "Crowns & Bridges",
    "Pediatric Dentistry",
    "Full-Mouth Rehabilitation",
  ],
} as const;

/** Google-Maps directions link for the active clinic. */
export function mapUrl(): string {
  return `https://maps.google.com/?q=${encodeURIComponent(clinic.contact.mapQuery)}`;
}

/**
 * Build a wa.me link that opens WhatsApp with a prefilled message FROM the
 * customer TO the clinic. This is the "free trick": because the customer sends
 * the first message, it opens WhatsApp's free 24-hour service window, so the
 * clinic's confirmation reply costs nothing on the official Meta Cloud API.
 */
export function confirmOnWhatsAppLink(opts: { code?: string | null; lang: "ar" | "en"; service?: string; when?: string }): string {
  const { code, lang, service, when } = opts;
  const text =
    lang === "ar"
      ? `مرحبًا، أريد تأكيد حجزي في ${site.nameAr}` +
        (service ? `\nالخدمة: ${service}` : "") +
        (when ? `\nالموعد: ${when}` : "") +
        (code ? `\nكود الحجز: ${code}` : "")
      : `Hi, I'd like to confirm my booking at ${site.name}` +
        (service ? `\nService: ${service}` : "") +
        (when ? `\nWhen: ${when}` : "") +
        (code ? `\nBooking code: ${code}` : "");
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
}

/** Build the schema.org JSON-LD for the clinic (Dentist + LocalBusiness). */
export function clinicJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Dentist",
    "@id": `${site.url}/#clinic`,
    name: site.name,
    alternateName: site.nameAr,
    description: site.description,
    url: site.url,
    telephone: site.phone,
    email: site.email,
    image: `${site.url}${site.logo}`,
    logo: `${site.url}${site.logo}`,
    priceRange: site.priceRange,
    address: {
      "@type": "PostalAddress",
      streetAddress: site.address.street,
      addressLocality: site.address.locality,
      addressRegion: site.address.region,
      postalCode: site.address.postalCode,
      addressCountry: site.address.country,
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: site.geo.lat,
      longitude: site.geo.lng,
    },
    openingHoursSpecification: site.openingHours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: h.days,
      opens: h.opens,
      closes: h.closes,
    })),
    sameAs: site.social,
    areaServed: { "@type": "City", name: "Cairo" },
    makesOffer: site.services.map((s) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: s },
    })),
  };
}
