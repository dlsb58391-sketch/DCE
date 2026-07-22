import type { ClinicConfig } from "./types";

/**
 * Dental Center of Egypt — Heliopolis, Cairo.
 *
 * Founded 1987; one of Egypt's largest specialised dental centers — 20
 * specialised clinics covering every branch of dentistry plus a dedicated
 * pediatric wing, 45+ specialist doctors & consultants, accepted by 55+ medical
 * insurance companies, with branches across Greater Cairo. Institution-first
 * (center) branding: the hero leads with the DCE heritage key visual (no
 * person-cutout stage) and a royal-blue theme drawn from the real logo.
 *
 * All imagery here is the client's OWN brand material (logo, heritage flag,
 * real before/after cases and videos) extracted from their Instagram/Facebook,
 * saved under public/dce/.
 */
export const dce: ClinicConfig = {
  slug: "dce",
  brand: { en: "Dental Center of Egypt", ar: "دينتال سنتر أوف إيجيبت" },
  doctorName: { en: "Dental Center of Egypt", ar: "دينتال سنتر أوف إيجيبت" },
  role: {
    en: "An integrated dental system since 1987 · 20 specialised clinics",
    ar: "منظومة أسنان متكاملة منذ ١٩٨٧ · ٢٠ عيادة متخصصة",
  },

  hero: {
    badge: {
      en: "Since 1987 · 39 Years of Trust",
      ar: "منذ عام ١٩٨٧ · ٣٩ سنة من الثقة",
    },
    title1: { en: "With You in Every Smile —", ar: "معاكم في كل ابتسامة —" },
    title2: { en: "Dental Center of Egypt", ar: "دينتال سنتر أوف إيجيبت" },
    subtitle: {
      en: "Since 1987 we have operated as one integrated dental system: 20 specialised clinics under one umbrella, 45+ specialists and consultants, a dedicated pediatric wing, and advanced protocols built around safe, precise, family-first care.",
      ar: "منذ عام ١٩٨٧ ونحن نعمل كمنظومة أسنان متكاملة: ٢٠ عيادة متخصصة تحت مظلة واحدة، وأكثر من ٤٥ أخصائيًا واستشاريًا، وجناح مخصص للأطفال، وبروتوكولات علاج متقدمة تركز على الأمان والدقة وراحة العائلة.",
    },
    photo: "/dce/logo.png",
    hideStage: true,
    image: "/dce/hero-heritage.jpg",
    lineupLabel: { en: "Our Specialists", ar: "نخبة المتخصصين" },
    tagline: {
      en: "من ١٩٨٧… معاكم في كل ابتسامة — ٣٩ سنة من الثقة",
      ar: "من ١٩٨٧… معاكم في كل ابتسامة — ٣٩ سنة من الثقة",
    },
    stats: [
      { value: "39", label: { en: "Years of Trust", ar: "عامًا من الثقة" } },
      { value: "45+", label: { en: "Specialist Doctors", ar: "طبيبًا متخصصًا" } },
      { value: "55+", label: { en: "Insurance Partners", ar: "شركة تأمين" } },
    ],
  },

  about: {
    role: { en: "Egypt's Largest Specialised Dental Center", ar: "أكبر مركز أسنان متخصص في مصر" },
    bio1: {
      en: "Founded in 1987, Dental Center of Egypt has grown into one of the country's largest and most trusted dental systems — 20 specialised clinics covering every branch of dentistry, a dedicated wing for children, and a team of 45+ specialist doctors and consultants.",
      ar: "تأسس مركز دينتال سنتر أوف إيجيبت عام ١٩٨٧، وأصبح واحدًا من أكبر وأوثق منظومات طب الأسنان في مصر — ٢٠ عيادة متخصصة تغطي كل فروع طب الأسنان، وجناح مخصص للأطفال، وفريق من أكثر من ٤٥ طبيبًا واستشاريًا متخصصًا.",
    },
    bio2: {
      en: "For nearly four decades we've built trust before any treatment. With branches across Greater Cairo, acceptance by 55+ medical insurance companies and flexible installment plans, we make world-class dentistry easy for the whole family — natural smiles that last a lifetime.",
      ar: "على مدى أربعة عقود تقريبًا نبني الثقة قبل أي علاج. بفروعنا في أنحاء القاهرة الكبرى، والتعامل مع أكثر من ٥٥ شركة تأمين طبي، وأنظمة تقسيط مريحة، نجعل طب الأسنان العالمي في متناول العائلة كلها — ابتسامات طبيعية تدوم مدى الحياة.",
    },
    point1: { en: "20 specialised clinics — every branch of dentistry", ar: "٢٠ عيادة متخصصة — كل فروع طب الأسنان" },
    point2: { en: "45+ specialist doctors & consultants, plus a pediatric wing", ar: "أكثر من ٤٥ طبيبًا واستشاريًا، وجناح لأسنان الأطفال" },
    point3: { en: "Accepted by 55+ insurers · flexible installments · 5 branches", ar: "أكثر من ٥٥ شركة تأمين · تقسيط مريح · ٥ فروع" },
  },

  credentials: [
    { en: "Established 1987 — 39 Years of Care", ar: "تأسس عام ١٩٨٧ — ٣٩ عامًا من الرعاية" },
    { en: "20 Specialised Clinics + Pediatric Wing", ar: "٢٠ عيادة متخصصة + جناح للأطفال" },
    { en: "45+ Specialist Doctors & Consultants", ar: "أكثر من ٤٥ طبيبًا واستشاريًا" },
    { en: "Accepted by 55+ Insurance Companies", ar: "معتمد لدى أكثر من ٥٥ شركة تأمين" },
    { en: "Branches Across Greater Cairo", ar: "فروع في أنحاء القاهرة الكبرى" },
    { en: "Flexible Installment Plans", ar: "أنظمة تقسيط مريحة" },
  ],

  team: [],

  gallery: {
    style: "grid",
    headline: { en: "Real Patient Results", ar: "نتائج حقيقية لمرضانا" },
    subtitle: {
      en: "A glimpse of the smiles crafted at Dental Center of Egypt — veneers, crowns, orthodontics and more, by our specialist team.",
      ar: "لمحة من الابتسامات التي صنعناها في دينتال سنتر أوف إيجيبت — عدسات وتيجان وتقويم والمزيد، على يد فريقنا المتخصص.",
    },
    cases: [
      { src: "/dce/cases/ba-veneers-2.jpg", title: { en: "Hollywood Smile", ar: "ابتسامة هوليوود" }, tag: { en: "E-Max Veneers", ar: "عدسات إيماكس" } },
      { src: "/dce/cases/ba-veneers-1.jpg", title: { en: "Cosmetic Veneers", ar: "عدسات تجميلية" }, tag: { en: "Smile Restoration", ar: "ترميم الابتسامة" } },
      { src: "/dce/cases/ba-veneers-3.jpg", title: { en: "Crowns & Veneers", ar: "تيجان وعدسات" }, tag: { en: "Zirconium", ar: "زيركون" } },
      { src: "/dce/cases/ba-whitening.jpg", title: { en: "Smile Makeover", ar: "تجميل الابتسامة" }, tag: { en: "Veneers", ar: "عدسات" } },
      { src: "/dce/cases/ba-smile-1.jpg", title: { en: "Smile Alignment", ar: "تنسيق الابتسامة" }, tag: { en: "Orthodontics", ar: "تقويم" } },
      { src: "/dce/cases/ba-braces.jpg", title: { en: "Orthodontic Braces", ar: "تقويم بالأسلاك" }, tag: { en: "Orthodontics", ar: "تقويم" } },
    ],
  },
  videosIntro: {
    en: "Real moments from inside Dental Center of Egypt: treatment workflows, precision steps, and quality standards in daily practice.",
    ar: "لحظات حقيقية من داخل دينتال سنتر أوف إيجيبت: خطوات العلاج، دقة التنفيذ، ومعايير الجودة في العمل اليومي.",
  },
  videos: [
    {
      src: "/dce/videos/dce-work-1.mp4",
      title: { en: "Inside Our Clinical Workflow", ar: "من داخل رحلة العلاج" },
      tag: { en: "Clinical Work", ar: "عمل العيادة" },
      duration: "0:30",
      orientation: "portrait",
    },
    {
      src: "/dce/videos/dce-work-2.mp4",
      title: { en: "Accuracy You Can See", ar: "دقة تشوفها بعينك" },
      tag: { en: "Clinical Work", ar: "عمل العيادة" },
      duration: "0:12",
      orientation: "portrait",
    },
  ],
  testimonialVideosIntro: {
    en: "Voices of real clients sharing their experience with our clinics, doctors, and care journey.",
    ar: "آراء عملاء حقيقيين بيحكوا تجربتهم مع العيادة والأطباء ورحلة العلاج.",
  },
  testimonialVideos: [
    {
      src: "/dce/videos/dce-client-1.mp4",
      title: { en: "A Complete Care Experience", ar: "مش بس علاج... دي تجربة" },
      tag: { en: "Client Voice", ar: "رأي عميل" },
      duration: "0:49",
      orientation: "portrait",
    },
    {
      src: "/dce/videos/dce-client-2.mp4",
      title: { en: "A Happy Patient Story", ar: "البيشنت اللذيذ رزق" },
      tag: { en: "Client Voice", ar: "رأي عميل" },
      duration: "0:34",
      orientation: "portrait",
    },
    {
      src: "/dce/videos/dce-client-3.mp4",
      title: { en: "Generations of Trust", ar: "جيل بيسلم جيل" },
      tag: { en: "Client Voice", ar: "رأي عميل" },
      duration: "0:44",
      orientation: "portrait",
    },
    {
      src: "/dce/videos/dce-client-4.mp4",
      title: { en: "One Place for the Whole Family", ar: "مكان واحد للعيلة كلها" },
      tag: { en: "Client Voice", ar: "رأي عميل" },
      duration: "0:40",
      orientation: "portrait",
    },
  ],

  theme: {
    primary: "#1b5fd6",
    primaryDark: "#123a86",
    accent: "#2f97e0",
    background: "#f3f7fd",
    surface: "#ffffff",
    surface2: "#e7eefb",
    onPrimary: "#ffffff",
  },

  logo: "/dce/logo.png",

  contact: {
    phone: "+201003940003",
    phoneDisplay: "+20 100 394 0003",
    whatsapp: "201003940003",
    email: "dental.center.egypt@gmail.com",
    address: { street: "67 Abu Bakr El Sadik St, Safir Square", locality: "Heliopolis", region: "Cairo", country: "EG", postalCode: "11341" },
    addressDisplay: {
      en: "67 Abu Bakr El Sadik St, Safir Square, next to Bastawisi, Heliopolis, Cairo",
      ar: "٦٧ شارع أبو بكر الصديق، ميدان سفير، بجوار بستاويسي، مصر الجديدة، القاهرة",
    },
    hours: { en: "Open daily — call or WhatsApp to book your visit", ar: "مفتوح يوميًا — اتصل أو راسلنا واتساب لحجز موعدك" },
    geo: { lat: 30.0989, lng: 31.339 },
    mapQuery: "Dental Center of Egypt, Abu Bakr El Sadik, Safir Square, Heliopolis, Cairo",
    social: [
      "https://www.facebook.com/dentalcenter.medhatbasseem",
      "https://www.instagram.com/dentalcenter_medhatbasseem",
      "https://wa.me/201003940003",
    ],
  },

  seo: {
    description:
      "Dental Center of Egypt — trusted since 1987 in Heliopolis, Cairo. 20 specialised clinics, 45+ specialist doctors, a pediatric wing, EMax veneers, implants, clear aligners and whitening. Accepted by 55+ insurers with flexible installments. Book today.",
    descriptionAr:
      "دينتال سنتر أوف إيجيبت — ثقة منذ عام ١٩٨٧ في مصر الجديدة، القاهرة. ٢٠ عيادة متخصصة، أكثر من ٤٥ طبيبًا، جناح للأطفال، عدسات إيماكس، زراعة، تقويم شفاف وتبييض. معتمد لدى أكثر من ٥٥ شركة تأمين مع تقسيط مريح. احجز اليوم.",
    keywords: [
      "Dental Center of Egypt",
      "dentist Heliopolis",
      "cosmetic dentist Cairo",
      "veneers Egypt",
      "EMax veneers",
      "Hollywood smile Cairo",
      "dental implants Egypt",
      "clear aligners Cairo",
      "pediatric dentistry Cairo",
      "dental insurance Egypt",
      "مركز أسنان مصر الجديدة",
      "دينتال سنتر",
      "عدسات الأسنان",
      "ابتسامة هوليوود",
      "زراعة الأسنان",
      "تقويم شفاف",
      "أسنان الأطفال",
      "تأمين طبي أسنان",
    ],
  },

  dbFile: "dce.db",
};
