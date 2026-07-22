import type { ClinicConfig } from "./types";

/**
 * THE BOSS Dental Clinic — Hadayek El Ahram, Giza.
 * Clinic-first branding; Dr. Ibrahim Salah Gadallah is the founder & lead
 * cosmetic/implant dentist. Real identity, contacts and cases sourced from the
 * clinic's Facebook page and marketing material.
 */
export const ibrahim: ClinicConfig = {
  slug: "ibrahim",
  brand: { en: "THE BOSS Dental Clinic", ar: "THE BOSS Dental Clinic" },
  doctorName: { en: "THE BOSS Dental Clinic", ar: "ذا بوس لطب الأسنان" },
  role: { en: "Cosmetic & Implant Dentistry · Hadayek El Ahram", ar: "تجميل وزراعة الأسنان · حدائق الأهرام" },

  hero: {
    badge: { en: "THE BOSS Dental Clinic · Hadayek El Ahram, Giza", ar: "ذا بوس لطب الأسنان · حدائق الأهرام، الجيزة" },
    title1: { en: "Start Your Perfect Smile Journey at", ar: "ابدأ رحلة ابتسامتك المثالية في" },
    title2: { en: "THE BOSS Dental Clinic", ar: "ذا بوس لطب الأسنان" },
    subtitle: {
      en: "Led by Dr. Ibrahim Salah — veneers, dental implants, orthodontics and complete smile makeovers, with flexible bank installment plans and a gentle, precise touch.",
      ar: "بقيادة د. إبراهيم صلاح — عدسات، زراعة أسنان، تقويم، وتجميل الابتسامة الكامل، مع تقسيط مريح على كبرى البنوك ولمسة دقيقة ولطيفة.",
    },
    photo: "/doctor-ibrahim.png",
    figureName: { en: "Dr. Ibrahim Salah", ar: "د. إبراهيم صلاح" },
    figureRole: { en: "Founder & Consultant Cosmetic Dentist", ar: "المؤسس واستشاري تجميل الأسنان" },
    tagline: { en: "Crafting confident, natural smiles", ar: "نصنع ابتسامات طبيعية وواثقة" },
    video: { src: "/ibrahim/videos/hero.mp4", seamless: true },
  },

  about: {
    role: { en: "Founder · Consultant Cosmetic & Implant Dentist", ar: "المؤسس · استشاري تجميل وزراعة الأسنان" },
    bio1: {
      en: "THE BOSS Dental Clinic in Hadayek El Ahram is led by Dr. Ibrahim Salah Gadallah, a consultant dentist dedicated to crafting natural, confident smiles — from porcelain veneers and smile design to dental implants and full-mouth rehabilitation.",
      ar: "عيادة ذا بوس لطب الأسنان في حدائق الأهرام بقيادة د. إبراهيم صلاح جاد الله، استشاري أسنان متخصص في تصميم الابتسامات الطبيعية والواثقة — من عدسات البورسلين وتصميم الابتسامة إلى زراعة الأسنان وإعادة تأهيل الفم بالكامل.",
    },
    bio2: {
      en: "The clinic combines international expertise with modern, fully-sterilized facilities and flexible bank installment plans — delivering pain-free treatment and natural-looking results in a calm, welcoming environment.",
      ar: "تجمع العيادة بين الخبرة الدولية والتجهيزات الحديثة المعقّمة بالكامل وحلول التقسيط المريحة مع كبرى البنوك — لتقديم علاج خالٍ من الألم ونتائج طبيعية في بيئة هادئة ومريحة.",
    },
    point1: { en: "Cosmetic, veneers & smile-design experts", ar: "خبراء تجميل وعدسات وتصميم الابتسامة" },
    point2: { en: "Implants, orthodontics & pediatric care", ar: "زراعة وتقويم ورعاية أسنان الأطفال" },
    point3: { en: "Flexible installments with major banks", ar: "تقسيط مريح مع كبرى البنوك" },
    profile: {
      name: { en: "Dr. Ibrahim Salah Gadallah", ar: "د. إبراهيم صلاح جاد الله" },
      title: {
        en: "Consultant Cosmetic & Implant Dentist · Founder of THE BOSS Dental Clinic",
        ar: "استشاري تجميل وزراعة الأسنان · مؤسس عيادة ذا بوس لطب الأسنان",
      },
      languages: { en: "Arabic · English", ar: "العربية · الإنجليزية" },
    },
  },

  credentials: [
    { en: "Member, American Dental Association (ADA)", ar: "عضو الجمعية الأمريكية لطب الأسنان (ADA)" },
    { en: "Fellow, Leeds College — United Kingdom", ar: "زميل ليدز كوليدج — المملكة المتحدة" },
    { en: "Implants & Cosmetic Dentistry", ar: "زراعة وتجميل الأسنان" },
  ],

  team: [
    { name: { en: "Dr. Ibrahim Salah", ar: "د. إبراهيم صلاح" }, role: { en: "Founder & Consultant Cosmetic Dentist", ar: "المؤسس واستشاري تجميل الأسنان" }, photo: "/doctor-ibrahim.png" },
    { name: { en: "Dr. Mennatullah Moamen", ar: "د. منة الله مؤمن" }, role: { en: "Orthodontics Specialist", ar: "أخصائية تقويم الأسنان" }, photo: "/ibrahim/cases/pediatric.png" },
  ],

  gallery: {
    style: "slider",
    headline: { en: "Real Patient Results", ar: "نتائج حقيقية لمرضانا" },
    subtitle: {
      en: "Drag the handle to reveal real before-and-after results from THE BOSS Dental Clinic.",
      ar: "حرّك المؤشر لتكشف نتائج حقيقية قبل وبعد من عيادة ذا بوس.",
    },
    cases: [
      { before: "/ibrahim/cases/restoration-before.png", after: "/ibrahim/cases/restoration-after.png", title: { en: "Implants & Full-Mouth Restoration", ar: "زراعة وترميم كامل للفم" }, tag: { en: "Implants", ar: "زراعة" } },
      { before: "/ibrahim/cases/ortho-before.png", after: "/ibrahim/cases/ortho-after.png", title: { en: "Orthodontics", ar: "تقويم الأسنان" }, tag: { en: "Braces", ar: "تقويم" } },
      { before: "/ibrahim/cases/bimax-before.png", after: "/ibrahim/cases/bimax-after.png", title: { en: "Bimaxillary Correction", ar: "تصحيح بروز الفكين" }, tag: { en: "Orthodontics", ar: "تقويم" }, aspect: "aspect-[4/5]" },
    ],
  },

  videos: [
    { src: "/ibrahim/videos/intro.mp4", title: { en: "Meet Dr. Ibrahim", ar: "تعرّف على د. إبراهيم" }, tag: { en: "Reel", ar: "ريـل" }, duration: "0:49", orientation: "portrait" },
    { src: "/ibrahim/videos/case.mp4", title: { en: "Real Case", ar: "حالة حقيقية" }, tag: { en: "Showcase", ar: "عرض" }, duration: "0:24", orientation: "portrait" },
  ],
  videosIntro: {
    en: "A closer look at the care at THE BOSS Dental Clinic — real moments with Dr. Ibrahim Salah.",
    ar: "نظرة أقرب على الرعاية في عيادة ذا بوس — لحظات حقيقية مع د. إبراهيم صلاح.",
  },

  theme: {
    primary: "#a87f2b",
    primaryDark: "#876419",
    accent: "#d9b659",
    background: "#f7f5f1",
    surface: "#ffffff",
    surface2: "#f1ece3",
  },

  logo: "/doctor-ibrahim.png",

  contact: {
    phone: "+201066385892",
    phoneDisplay: "+20 106 638 5892",
    whatsapp: "201066385892",
    email: "dribrahimsalah41@gmail.com",
    address: { street: "Gardenia 32G, New Gate 2 (Ahmes)", locality: "Hadayek El Ahram", region: "Giza", country: "EG", postalCode: "" },
    addressDisplay: {
      en: "Gardenia 32G, New Gate 2 (Ahmes), Hadayek El Ahram, Giza",
      ar: "حدائق الأهرام – البوابة 2 الجديدة (أحمس) – جاردينيا ٣٢ج",
    },
    hours: { en: "Open daily — call to book your visit", ar: "مفتوح يوميًا — اتصل لحجز موعدك" },
    geo: { lat: 29.9762, lng: 31.1468 },
    mapQuery: "THE BOSS Dental Clinic Hadayek El Ahram Gardenia",
    social: [
      "https://www.facebook.com/profile.php?id=61577819443580",
      "https://wa.me/201066385892",
    ],
  },

  seo: {
    description:
      "THE BOSS Dental Clinic in Hadayek El Ahram, Giza — led by Dr. Ibrahim Salah. Veneers, dental implants, orthodontics and complete smile makeovers, with flexible bank installments. Book your appointment today.",
    descriptionAr:
      "عيادة ذا بوس لطب الأسنان في حدائق الأهرام، الجيزة — بقيادة د. إبراهيم صلاح. عدسات، زراعة أسنان، تقويم، وتجميل الابتسامة الكامل، مع تقسيط مريح على البنوك. احجز موعدك اليوم.",
    keywords: [
      "THE BOSS Dental Clinic",
      "dentist Hadayek El Ahram",
      "cosmetic dentist Giza",
      "veneers Egypt",
      "Hollywood smile Cairo",
      "dental implants Egypt",
      "Dr Ibrahim Salah",
      "طبيب اسنان حدائق الاهرام",
      "تجميل الأسنان",
      "عدسات الأسنان",
      "ابتسامة هوليوود",
      "زراعة الأسنان",
      "تقويم الأسنان",
    ],
  },

  dbFile: "ibrahim.db",
};
