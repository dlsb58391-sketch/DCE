"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { type Appointment, seedAppointments } from "./dashboard";
import { activeClinic } from "./clinics";

const clinic = activeClinic();

export type Bilingual = { en: string; ar: string };

export type Offer = {
  id: string;
  title: Bilingual;
  desc: Bilingual;
  badge: Bilingual; // e.g. "25% OFF" / "خصم ٢٥٪"
  color: string; // hex accent
  icon: string; // key into offerIcons
  active: boolean;
};

export type SiteCase = {
  id: string;
  before: string; // url or dataURL
  after: string;
  label: Bilingual;
};

export type Theme = {
  primary: string;
  primaryDark: string;
  accent: string;
  background: string;
  surface: string;
  surface2: string;
  onPrimary?: string;
};

export type SiteSettings = {
  photo: string;
  doctorName: Bilingual;
  role: Bilingual;
  heroTitle1: Bilingual;
  heroTitle2: Bilingual;
  subtitle: Bilingual;
  theme: Theme;
  offers: Offer[];
  cases: SiteCase[];
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  message: string;
  offerId: string | null;
  offerTitle: Bilingual | null;
  serviceId?: string | null;
  serviceLabel?: Bilingual | null;
  dayOffset?: number | null;
  start?: string | null; // "HH:MM"
  appointmentId?: string | null;
  trackCode?: string | null; // server booking code for /track/[code]
  createdAt: number; // epoch ms
  status: "new" | "seen";
};

/* ---------------- Offer icon set ---------------- */
export const offerIcons: Record<string, string> = {
  sparkle: "M12 3l1.8 5L19 9.8 13.8 12 12 17l-1.8-5L5 9.8 10.2 8z",
  tooth: "M12 4.5c-2-1.4-5-1.6-6.3.3-1.2 1.8-.6 4.3 0 6.6.5 1.9.3 3 .8 5.2.3 1.4.7 2.9 1.6 2.9 1.1 0 1.1-2 1.6-3.6.3-1 .8-1.7 1.3-1.7s1 .7 1.3 1.7c.5 1.6.5 3.6 1.6 3.6.9 0 1.3-1.5 1.6-2.9.5-2.2.3-3.3.8-5.2.6-2.3 1.2-4.8 0-6.6C17 2.9 14 3.1 12 4.5Z",
  gift: "M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7S10.5 3 8 3a2 2 0 0 0 0 4M12 7s1.5-4 4-4a2 2 0 0 1 0 4",
  star: "M12 3l2.5 5.5L20 9.3l-4 4 1 5.7L12 16l-5 3 1-5.7-4-4 5.5-.8z",
  percent: "M19 5 5 19M8.5 7a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm10 10a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z",
  crown: "M4 17 2 7l6 4 4-7 4 7 6-4-2 10z",
};

/* ---------------- Defaults ---------------- */
export const DEFAULT_THEME: Theme = { ...clinic.theme };

export const defaultSettings: SiteSettings = {
  photo: clinic.hero.photo,
  doctorName: clinic.doctorName,
  role: clinic.role,
  heroTitle1: clinic.hero.title1,
  heroTitle2: clinic.hero.title2,
  subtitle: clinic.hero.subtitle,
  theme: DEFAULT_THEME,
  offers: [
    {
      id: "of-hollywood",
      title: { en: "Hollywood Smile Offer", ar: "عرض الهوليوود سمايل" },
      desc: {
        en: "Complete smile makeover with premium veneers at a special price.",
        ar: "تجميل كامل للابتسامة بعدسات بريميوم بسعر خاص.",
      },
      badge: { en: "25% OFF", ar: "خصم ٢٥٪" },
      color: clinic.theme.primary,
      icon: "sparkle",
      active: true,
    },
    {
      id: "of-checkup",
      title: { en: "Free Check-up & Cleaning", ar: "كشف وتنظيف مجاني" },
      desc: {
        en: "Book any treatment this month and get your first check-up and cleaning free.",
        ar: "احجز أي علاج هذا الشهر واحصل على أول كشف وتنظيف مجانًا.",
      },
      badge: { en: "FREE", ar: "مجانًا" },
      color: "#10b981",
      icon: "gift",
      active: true,
    },
    {
      id: "of-whitening",
      title: { en: "Teeth Whitening Special", ar: "عرض تبييض الأسنان" },
      desc: {
        en: "Brighten your smile several shades with our laser whitening session.",
        ar: "اجعل ابتسامتك أكثر إشراقًا بعدة درجات مع جلسة التبييض بالليزر.",
      },
      badge: { en: "30% OFF", ar: "خصم ٣٠٪" },
      color: clinic.theme.accent,
      icon: "star",
      active: true,
    },
  ],
  cases: [
    {
      id: "case-1",
      before: "/cases/before-1-v4.png",
      after: "/cases/after-1-v4.png",
      label: { en: "Discolored tooth treatment", ar: "علاج تغير لون الأسنان" },
    },
    {
      id: "case-2",
      before: "/cases/before-2-v4.png",
      after: "/cases/after-2-v4.png",
      label: { en: "Implant and crown restoration", ar: "ترميم بالزراعة والتيجان" },
    },
  ],
};

const SETTINGS_KEY = "site_settings_v4";
const LEADS_KEY = "site_leads_v2";
const BOOKINGS_KEY = "site_bookings_v2";

function loadSettings(): SiteSettings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return defaultSettings;
    const parsed = JSON.parse(raw) as Partial<SiteSettings>;
    // shallow-merge with defaults so new fields always exist
    const merged: SiteSettings = {
      ...defaultSettings,
      ...parsed,
      theme: { ...DEFAULT_THEME, ...(parsed.theme ?? {}) },
      offers: parsed.offers ?? defaultSettings.offers,
      cases: parsed.cases ?? defaultSettings.cases,
    };
    // DCE landing is logo-first branding, never a single doctor photo.
    if (clinic.slug === "dce" && clinic.logo) {
      merged.photo = clinic.logo;
    }
    return merged;
  } catch {
    return defaultSettings;
  }
}

function loadLeads(): Lead[] {
  try {
    const raw = window.localStorage.getItem(LEADS_KEY);
    return raw ? (JSON.parse(raw) as Lead[]) : [];
  } catch {
    return [];
  }
}

/** Client-created bookings only; seed appointments stay fresh in code. */
function loadBookings(): Appointment[] {
  try {
    const raw = window.localStorage.getItem(BOOKINGS_KEY);
    return raw ? (JSON.parse(raw) as Appointment[]) : [];
  } catch {
    return [];
  }
}

type SiteCtx = {
  settings: SiteSettings;
  ready: boolean;
  update: (partial: Partial<SiteSettings>) => void;
  resetSettings: () => void;
  selectedOffer: Offer | null;
  selectOffer: (o: Offer | null) => void;
  leads: Lead[];
  addLead: (l: Omit<Lead, "id" | "createdAt" | "status">) => void;
  markLeadSeen: (id: string) => void;
  removeLead: (id: string) => void;
  appointments: Appointment[];
  addAppointment: (a: Appointment) => void;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  removeAppointment: (id: string) => void;
};

const Ctx = createContext<SiteCtx | null>(null);

export function SiteProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(defaultSettings);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [bookings, setBookings] = useState<Appointment[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [ready, setReady] = useState(false);

  // hydrate from localStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    setSettings(loadSettings());
    setLeads(loadLeads());
    setBookings(loadBookings());
    setReady(true);

    // keep other tabs in sync (storage fires only in OTHER documents)
    const onStorage = (e: StorageEvent) => {
      if (e.key === SETTINGS_KEY) setSettings(loadSettings());
      if (e.key === LEADS_KEY) setLeads(loadLeads());
      if (e.key === BOOKINGS_KEY) setBookings(loadBookings());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // persist on change (only after hydration, so defaults don't clobber saved data)
  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore quota */
    }
  }, [settings, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
    } catch {
      /* ignore quota */
    }
  }, [leads, ready]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(BOOKINGS_KEY, JSON.stringify(bookings));
    } catch {
      /* ignore quota */
    }
  }, [bookings, ready]);

  // Doctor's full schedule = static seed (always relative to today) + saved bookings.
  const appointments = useMemo(() => [...seedAppointments, ...bookings], [bookings]);

  const addAppointment = useCallback(
    (a: Appointment) => setBookings((prev) => [...prev, a]),
    []
  );
  const updateAppointment = useCallback(
    (id: string, patch: Partial<Appointment>) =>
      setBookings((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    []
  );
  const removeAppointment = useCallback(
    (id: string) => setBookings((prev) => prev.filter((x) => x.id !== id)),
    []
  );

  const update = useCallback(
    (partial: Partial<SiteSettings>) => setSettings((prev) => ({ ...prev, ...partial })),
    []
  );

  const resetSettings = useCallback(() => setSettings(defaultSettings), []);

  const addLead: SiteCtx["addLead"] = useCallback((l) => {
    const lead: Lead = {
      ...l,
      id: `lead-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      status: "new",
    };
    setLeads((prev) => [lead, ...prev]);
  }, []);

  const markLeadSeen = useCallback(
    (id: string) =>
      setLeads((prev) => prev.map((x) => (x.id === id ? { ...x, status: "seen" as const } : x))),
    []
  );

  const removeLead = useCallback(
    (id: string) => setLeads((prev) => prev.filter((x) => x.id !== id)),
    []
  );

  return (
    <Ctx.Provider
      value={{
        settings,
        ready,
        update,
        resetSettings,
        selectedOffer,
        selectOffer: setSelectedOffer,
        leads,
        addLead,
        markLeadSeen,
        removeLead,
        appointments,
        addAppointment,
        updateAppointment,
        removeAppointment,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useSite() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSite must be used within SiteProvider");
  return ctx;
}

/* ---------------- Image helper: downscale + dataURL ---------------- */
export function fileToDataURL(file: File, maxSize = 1000, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read failed"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("image failed"));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          const scale = maxSize / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const cx = canvas.getContext("2d");
        if (!cx) return resolve(reader.result as string);
        cx.drawImage(img, 0, 0, width, height);
        const isPng = file.type.includes("png");
        resolve(canvas.toDataURL(isPng ? "image/png" : "image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
