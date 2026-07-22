import type { ClinicConfig } from "./types";

/** Badawi Dental Implant Center — Maadi, Cairo (the original clinic). */
export const badawi: ClinicConfig = {
  slug: "badawi",
  brand: { en: "BDIC", ar: "BDIC" },
  doctorName: { en: "Badawi Dental Implant Center", ar: "مركز بدوي لزراعة الأسنان" },
  role: { en: "Dental Implant Specialists · Maadi, Cairo", ar: "متخصصون في زراعة الأسنان · المعادي، القاهرة" },

  hero: {
    badge: { en: "100% Patient Recommended · Maadi, Cairo", ar: "يوصي به ١٠٠٪ من المرضى · المعادي، القاهرة" },
    title1: { en: "Rebuild Your Smile with", ar: "استعد ابتسامتك مع" },
    title2: { en: "Expert Dental Implants", ar: "خبراء زراعة الأسنان" },
    subtitle: {
      en: "At Badawi Dental Implant Center we replace missing teeth with world-class implant technology — for a confident, natural smile that lasts a lifetime.",
      ar: "في مركز بدوي لزراعة الأسنان نعوّض الأسنان المفقودة بأحدث تقنيات الزراعة العالمية — لابتسامة طبيعية وواثقة تدوم مدى الحياة.",
    },
    photo: "/bdic-logo.jpg",
    lineup: [
      { photo: "/clinic/team/person-1.png" },
      { photo: "/clinic/team/person-3.png" },
      { photo: "/clinic/team/person-5.png" },
      { photo: "/clinic/team/person-2.png" },
      { photo: "/clinic/team/person-4.png" },
    ],
    lineupLabel: { en: "Badawi Dental Team", ar: "فريق بدوي للأسنان" },
    tagline: {
      en: "Team members are auto-highlighted in sequence",
      ar: "يتم إبراز أعضاء الفريق تلقائيًا بالتتابع",
    },
    video: { src: "/clinic/videos/case-video-1.mp4", poster: "/clinic/smile-1.jpg" },
  },

  about: {
    role: { en: "A Dedicated Dental Implant Center in Cairo", ar: "مركز متخصص في زراعة الأسنان بالقاهرة" },
    bio1: {
      en: "BDIC — Badawi Dental Implant Center is a specialized dental center in Cairo focused on restoring missing teeth with advanced implant techniques and full-mouth rehabilitation.",
      ar: "مركز بدوي لزراعة الأسنان (BDIC) مركز متخصص في القاهرة يهتم بتعويض الأسنان المفقودة بأحدث تقنيات الزراعة وإعادة تأهيل الفم بالكامل.",
    },
    bio2: {
      en: "Our team combines international expertise with modern, fully-sterilized facilities to deliver pain-free treatment and natural-looking results in a calm, welcoming environment.",
      ar: "يجمع فريقنا بين الخبرة الدولية والتجهيزات الحديثة المعقّمة بالكامل لتقديم علاج خالٍ من الألم ونتائج طبيعية في بيئة هادئة ومريحة.",
    },
    point1: { en: "Specialized dental implant experts", ar: "خبراء متخصصون في زراعة الأسنان" },
    point2: { en: "Pain-free, modern techniques", ar: "تقنيات حديثة بلا ألم" },
    point3: { en: "Fully sterilized, modern facility", ar: "تجهيزات حديثة ومعقّمة بالكامل" },
  },

  team: [
    { name: { en: "Dr. Mohamed Badawi", ar: "د. محمد بدوي" }, role: { en: "Founder & Implant Specialist", ar: "المؤسس وأخصائي زراعة الأسنان" }, photo: "/clinic/doctor-badawi.jpg" },
    { name: { en: "BDIC Dental Team", ar: "فريق BDIC الطبي" }, role: { en: "Implant & Cosmetic Dentistry", ar: "زراعة وتجميل الأسنان" }, photo: "/clinic/doctor-2.jpg" },
  ],

  gallery: {
    style: "grid",
    headline: { en: "Real Patient Results", ar: "نتائج حقيقية لمرضانا" },
    subtitle: {
      en: "Real cases treated at Badawi Dental Implant Center — implants, crowns and smile makeovers.",
      ar: "حالات حقيقية تم علاجها في مركز بدوي لزراعة الأسنان — زراعة وتركيبات وتجميل الابتسامة.",
    },
    cases: [
      { src: "/clinic/case-gap.jpg", title: { en: "Closing Gaps with Crowns", ar: "إغلاق الفراغات بالتركيبات" }, tag: { en: "Cosmetic", ar: "تجميلي" } },
      { src: "/clinic/case-fullmouth.jpg", title: { en: "Full-Mouth Rehabilitation", ar: "إعادة تأهيل الفم بالكامل" }, tag: { en: "Implants", ar: "زراعة" } },
      { src: "/clinic/case-gum.jpg", title: { en: "Smile Design & Veneers", ar: "تصميم الابتسامة والعدسات" }, tag: { en: "Cosmetic", ar: "تجميلي" } },
      { src: "/clinic/case-veneers.jpg", title: { en: "Porcelain Veneers", ar: "عدسات البورسلين" }, tag: { en: "Hollywood Smile", ar: "ابتسامة هوليوود" } },
      { src: "/clinic/case-bridge.jpg", title: { en: "Fixed Bridge Restoration", ar: "ترميم بجسر ثابت" }, tag: { en: "Restoration", ar: "ترميم" } },
      { src: "/clinic/smile-1.jpg", title: { en: "Natural White Smile", ar: "ابتسامة بيضاء طبيعية" }, tag: { en: "Hollywood Smile", ar: "ابتسامة هوليوود" } },
    ],
  },

  videos: [
    { src: "/clinic/videos/case-video-1.mp4", title: { en: "Inside Our Clinic", ar: "من داخل عيادتنا" }, tag: { en: "Reel", ar: "ريـل" }, duration: "0:20", rotate: true },
    { src: "/clinic/videos/case-video-2.mp4", title: { en: "Patient Journey", ar: "رحلة المريض" }, tag: { en: "Showcase", ar: "عرض" }, duration: "0:31", orientation: "landscape", ratio: "1080 / 719" },
  ],
  videosIntro: {
    en: "A closer look at the care Badawi Dental Implant Center provides — real moments from our clinic.",
    ar: "نظرة أقرب على رعاية مركز بدوي لزراعة الأسنان — لحظات حقيقية من داخل عيادتنا.",
  },

  theme: {
    primary: "#a87f2b",
    primaryDark: "#876419",
    accent: "#d9b659",
    background: "#f7f5f1",
    surface: "#ffffff",
    surface2: "#f1ece3",
  },

  contact: {
    phone: "+201222156274",
    phoneDisplay: "+20 122 215 6274",
    whatsapp: "201222156274",
    email: "info@bdic.clinic",
    address: { street: "3/3 El Laselky St.", locality: "Maadi", region: "Cairo", country: "EG", postalCode: "11431" },
    addressDisplay: { en: "3/3 El Laselky St., Maadi, Cairo, Egypt", ar: "٣/٣ شارع اللاسلكي، المعادي، القاهرة، مصر" },
    hours: { en: "Sat - Thu: 12:00 PM - 10:00 PM", ar: "السبت - الخميس: ١٢ ظهرًا - ١٠ مساءً" },
    geo: { lat: 29.9602, lng: 31.2569 },
    mapQuery: "Badawi Dental Implant Center El Laselky Maadi Cairo",
    social: [
      "https://www.facebook.com/badawidentalcenter",
      "https://instagram.com/badawi_implant_center",
      "https://wa.me/201222156274",
    ],
  },

  seo: {
    description:
      "Badawi Dental Implant Center (BDIC) — a specialized dental implant center in Maadi, Cairo. Replace missing teeth with world-class implants for a confident, natural smile. Book your appointment today.",
    descriptionAr:
      "مركز بدوي لزراعة الأسنان (BDIC) — مركز متخصص في زراعة الأسنان بالمعادي، القاهرة. عوّض أسنانك المفقودة بأحدث تقنيات الزراعة العالمية لابتسامة طبيعية وواثقة. احجز موعدك اليوم.",
    keywords: [
      "dental implants Cairo",
      "dentist Maadi",
      "Badawi Dental",
      "Hollywood smile Egypt",
      "teeth whitening Cairo",
      "orthodontics Maadi",
      "زراعة الأسنان",
      "طبيب أسنان المعادي",
      "ابتسامة هوليوود",
      "مركز أسنان القاهرة",
    ],
  },

  dbFile: "dev.db",
};
