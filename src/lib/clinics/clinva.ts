import type { ClinicConfig } from "./types";

/**
 * Clinva — the GENERIC, brandable clinic profile shipped with the standalone
 * desktop app. It carries no real clinic's identity: every clinic that installs
 * Clinva edits its own details from the dashboard. Copy here is intentionally
 * neutral placeholder text so a fresh install reads as "your clinic", not a
 * specific practice.
 */
export const clinva: ClinicConfig = {
  slug: "clinva",
  brand: { en: "Clinva", ar: "كلينڤا" },
  doctorName: { en: "Clinva Dental Suite", ar: "كلينڤا لإدارة العيادات" },
  role: { en: "Modern Dental Clinic Management", ar: "إدارة عيادات الأسنان الحديثة" },

  hero: {
    badge: { en: "All-in-one Clinic Software", ar: "برنامج إدارة العيادة المتكامل" },
    title1: { en: "Run Your Clinic with", ar: "أدِر عيادتك مع" },
    title2: { en: "Clinva", ar: "كلينڤا" },
    subtitle: {
      en: "Patients, appointments, treatments, revenue and follow-ups — one modern dashboard for your whole clinic, fully in Arabic.",
      ar: "المرضى والمواعيد والعلاجات والإيرادات والمتابعات — لوحة تحكم حديثة واحدة لعيادتك بالكامل وبالعربية.",
    },
    photo: "/clinva-mark.svg",
    figureName: { en: "Clinva", ar: "كلينڤا" },
    figureRole: { en: "Clinic Management", ar: "إدارة العيادات" },
    image: "/clinic/smile-1.jpg",
    hideStage: true,
  },

  about: {
    role: { en: "Everything Your Clinic Needs", ar: "كل ما تحتاجه عيادتك" },
    bio1: {
      en: "Clinva brings appointments, patient records, treatments, payments and doctor earnings together in one fast, Arabic-first dashboard.",
      ar: "يجمع كلينڤا المواعيد وملفات المرضى والعلاجات والمدفوعات وأرباح الأطباء في لوحة تحكم واحدة سريعة وبالعربية أولًا.",
    },
    bio2: {
      en: "It runs on your own computer — your data stays with you, works offline, and needs no monthly cloud fees.",
      ar: "يعمل على جهازك الخاص — بياناتك تبقى معك، ويعمل بدون إنترنت، وبدون رسوم شهرية للسحابة.",
    },
    point1: { en: "Patients & appointments in one place", ar: "المرضى والمواعيد في مكان واحد" },
    point2: { en: "Revenue, expenses & doctor earnings", ar: "الإيرادات والمصروفات وأرباح الأطباء" },
    point3: { en: "Works offline on your own PC", ar: "يعمل بدون إنترنت على جهازك" },
  },

  team: [
    { name: { en: "Your Clinic Team", ar: "فريق عيادتك" }, role: { en: "Dentists & Staff", ar: "الأطباء والفريق" }, photo: "/doctor.png" },
  ],

  gallery: {
    style: "grid",
    headline: { en: "Your Work, Showcased", ar: "أعمالك في واجهة أنيقة" },
    subtitle: {
      en: "Add your own before/after cases from the dashboard to show them here.",
      ar: "أضف حالات قبل/بعد الخاصة بك من لوحة التحكم لعرضها هنا.",
    },
    cases: [
      { src: "/clinic/case-gap.jpg", title: { en: "Cosmetic Case", ar: "حالة تجميلية" }, tag: { en: "Cosmetic", ar: "تجميلي" } },
      { src: "/clinic/case-fullmouth.jpg", title: { en: "Full-Mouth Case", ar: "حالة الفم الكامل" }, tag: { en: "Implants", ar: "زراعة" } },
      { src: "/clinic/case-veneers.jpg", title: { en: "Veneers Case", ar: "حالة عدسات" }, tag: { en: "Hollywood Smile", ar: "ابتسامة هوليوود" } },
    ],
  },

  theme: {
    primary: "#a87f2b",
    primaryDark: "#876419",
    accent: "#c9a24b",
    background: "#f7f5f1",
    surface: "#ffffff",
    surface2: "#f1ece3",
  },

  logo: "/clinva-mark.svg",

  contact: {
    phone: "+201000000000",
    phoneDisplay: "+20 100 000 0000",
    whatsapp: "201000000000",
    email: "info@clinva.app",
    address: { street: "", locality: "Cairo", region: "Cairo", country: "EG", postalCode: "" },
    addressDisplay: { en: "Your clinic address", ar: "عنوان عيادتك" },
    hours: { en: "Sat - Thu: 12:00 PM - 10:00 PM", ar: "السبت - الخميس: ١٢ ظهرًا - ١٠ مساءً" },
    geo: { lat: 30.0444, lng: 31.2357 },
    mapQuery: "Cairo, Egypt",
    social: [],
  },

  seo: {
    description:
      "Clinva — modern, Arabic-first dental clinic management. Patients, appointments, treatments, revenue and doctor earnings in one offline desktop app.",
    descriptionAr:
      "كلينڤا — إدارة عيادات أسنان حديثة وبالعربية أولًا. المرضى والمواعيد والعلاجات والإيرادات وأرباح الأطباء في تطبيق سطح مكتب يعمل بدون إنترنت.",
    keywords: [
      "dental clinic software",
      "clinic management",
      "Clinva",
      "برنامج إدارة عيادات",
      "إدارة عيادة أسنان",
      "كلينڤا",
    ],
  },

  dbFile: "clinva.db",
};
