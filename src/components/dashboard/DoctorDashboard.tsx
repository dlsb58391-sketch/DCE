"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useLang } from "@/lib/language";
import { t } from "@/lib/content";
import { LanguageToggle } from "@/components/LanguageToggle";
import { BranchSwitcher } from "./BranchSwitcher";
import { DaySchedule } from "./DaySchedule";
import { BookingRequests } from "./BookingRequests";
import { PatientsSection } from "./PatientsSection";
import { OffersManager } from "./OffersManager";
import { SiteEditor } from "./SiteEditor";
import { OnlineBookings } from "./OnlineBookings";
import { WhatsAppLink } from "./WhatsAppLink";
import { OutreachManager } from "./OutreachManager";
import { ClientMessages } from "./ClientMessages";
import { SettingsSection } from "./SettingsSection";
import { OperationsManager } from "./OperationsManager";
import { AnalyticsSection } from "./AnalyticsSection";
import { DoctorsManager } from "./DoctorsManager";
import { RevenueSection } from "./RevenueSection";
import { EarningsDashboard } from "./EarningsDashboard";
import { RemindersSection } from "./RemindersSection";
import { CalendarSection } from "./CalendarSection";
import { AddAppointmentModal, QuickOperationModal } from "./QuickActions";
import type { Procedure, DoctorLite } from "./PatientOperations";
import {
  type BookingRequest,
  type Appointment,
  sessionTypes,
  seedRequests,
  fmtWeekday,
  fmtDayNum,
  freeSlotCount,
  fmtTime,
  hhmmToMin,
  minToHHMM,
  sessionTypeById,
  isClosed,
  isoDate,
} from "@/lib/dashboard";
import {
  type Patient,
  newPatient,
} from "@/lib/patients";
import { useSite, type Lead } from "@/lib/siteStore";
import { site } from "@/lib/site";

const WEEK_DAYS = 7;

function StatCard({
  icon,
  label,
  value,
  caption,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  caption?: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-primary/12 bg-surface p-4">
      <div className="flex items-center gap-3">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ backgroundColor: `${accent}1f`, color: accent }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted">{label}</p>
          <p className="truncate text-xl font-extrabold text-ink">{value}</p>
        </div>
      </div>
      {caption && <p className="mt-2 truncate text-xs text-muted">{caption}</p>}
    </div>
  );
}

const navItems = [
  { id: "overview", label: { en: "Overview", ar: "الرئيسية" }, icon: "M3 12 12 4l9 8M5 10v9h5v-6h4v6h5v-9" },
  { id: "analytics", label: { en: "Analytics", ar: "التحليلات" }, icon: "M4 20V10M10 20V4M16 20v-7M20 20H3" },
  { id: "revenue", label: { en: "Revenue", ar: "الإيرادات" }, icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { id: "earnings", label: { en: "Earnings", ar: "الأرباح" }, icon: "M3 3v18h18M7 14l4-4 3 3 5-6" },
  { id: "bookings", label: { en: "Bookings", ar: "الحجوزات" }, icon: "M4 5h16v10H7l-3 3V5Z" },
  { id: "whatsapp", label: { en: "WhatsApp", ar: "واتساب" }, icon: "M12 2a10 10 0 0 0-8.6 15L2 22l5.2-1.4A10 10 0 1 0 12 2Z" },
  { id: "outreach", label: { en: "Outreach", ar: "التسويق" }, icon: "M3 11l18-8-8 18-2-7-8-3Z" },
  { id: "messages", label: { en: "Client Messages", ar: "رسائل العملاء" }, icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" },
  { id: "reminders", label: { en: "Reminders", ar: "التذكيرات" }, icon: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" },
  { id: "calendar", label: { en: "Calendar", ar: "التقويم" }, icon: "M3 9h18M7 3v4m10-4v4M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" },
  { id: "patients", label: { en: "Clients", ar: "العملاء" }, icon: "M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" },
  { id: "operations", label: { en: "Operations", ar: "العمليات" }, icon: "M8 3v3a2 2 0 0 1-2 2H3M16 3v3a2 2 0 0 0 2 2h3M12 11v6M9 14h6" },
  { id: "doctors", label: { en: "Doctors", ar: "الأطباء" }, icon: "M6 3v5a4 4 0 0 0 8 0V3M10 12v2a5 5 0 0 0 10 0v-1M20 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" },
  { id: "offers", label: { en: "Offers", ar: "العروض" }, icon: "M20 12v8H4v-8M2 7h20v5H2zM12 7v13M12 7S10.5 3 8 3a2 2 0 0 0 0 4M12 7s1.5-4 4-4a2 2 0 0 1 0 4" },
  { id: "editor", label: { en: "Site Editor", ar: "محرر الموقع" }, icon: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" },
  { id: "settings", label: { en: "Settings", ar: "الإعدادات" }, icon: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7-3a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-5l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h5l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6c.07-.33.1-.66.1-1Z" },
] as const;

// Standalone dashboard screens that live on their own routes (not tab panels).
// Rendered as links beneath the tab list so these shipped features are reachable
// from the menu instead of only by typing the URL.
const linkItems = [
  { href: "/dashboard/inventory", label: { en: "Inventory", ar: "المخزون" }, icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7 12 12l8.7-5M12 22V12" },
  { href: "/dashboard/branches", label: { en: "Branches", ar: "الفروع" }, icon: "M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h1m-1 4h1m4-4h1m-1 4h1M10 21v-4h4v4" },
  { href: "/dashboard/staff", label: { en: "Staff", ar: "الموظفون" }, icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm14 10v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11" },
  { href: "/dashboard/security", label: { en: "Security", ar: "الأمان" }, icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" },
  { href: "/dashboard/diagnostics", label: { en: "Diagnostics", ar: "التشخيص" }, icon: "M3 12h4l2 8 4-16 2 8h4" },
  { href: "/dashboard/recycle-bin", label: { en: "Recycle Bin", ar: "سلة المحذوفات" }, icon: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m1 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" },
] as const;

export function DoctorDashboard() {
  const { tr, lang } = useLang();
  const {
    leads,
    markLeadSeen,
    removeLead,
    appointments,
    addAppointment,
    updateAppointment,
    removeAppointment,
  } = useSite();
  const base = useMemo(() => new Date(), []);
  const [requests, setRequests] = useState<BookingRequest[]>(seedRequests);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedOffset, setSelectedOffset] = useState(0);
  const [activeNav, setActiveNav] = useState("overview");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("dash_theme") : null;
    if (saved === "dark" || saved === "light") setTheme(saved);
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const next = t === "dark" ? "light" : "dark";
      try {
        window.localStorage.setItem("dash_theme", next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  // Clients live in the database (Patient table). Load them from the server and
  // refresh after every change so the list stays authoritative across devices.
  const reloadPatients = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/patients", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      setPatients((j.patients ?? []) as Patient[]);
    } catch {
      /* ignore */
    }
  }, []);
  // One-time cleanup of the legacy browser-only client cache (pre-DB demo data).
  useEffect(() => {
    try {
      window.localStorage.removeItem("dash_patients");
    } catch {
      /* ignore */
    }
  }, []);

  // Create or update a client in the database, then refresh from the server.
  const savePatient = useCallback(
    async (p: Patient) => {
      const existing = patients.some((x) => x.id === p.id);
      try {
        const res = await fetch("/api/admin/patients", {
          method: existing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: existing ? p.id : undefined,
            name: p.name,
            phone: p.phone,
            email: p.email ?? "",
            gender: p.gender ?? "",
            notes: p.notes ?? "",
            medical: p.medical ?? null,
          }),
        });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
          window.alert(j.message || j.error || "Could not save the client.");
          return;
        }
        await reloadPatients();
      } catch {
        window.alert("Could not save the client.");
      }
    },
    [patients, reloadPatients]
  );

  const deletePatient = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`/api/admin/patients?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
          window.alert(j.message || j.error || "Could not delete the client.");
          return;
        }
        setPatients((prev) => prev.filter((x) => x.id !== id));
        await reloadPatients();
      } catch {
        window.alert("Could not delete the client.");
      }
    },
    [reloadPatients]
  );

  // Online bookings (website + WhatsApp) live in the database. Pull them once
  // (polling) and derive both the schedule blocks and the review requests below.
  type DbAppt = {
    code: string;
    patientName: string;
    phone: string;
    serviceId: string;
    serviceLabelEn: string;
    serviceLabelAr: string;
    scheduledAt: string;
    status: string;
    complaint?: string | null;
    createdAt: string;
    doctorNameEn?: string | null;
    doctorNameAr?: string | null;
  };
  const [dbAppts, setDbAppts] = useState<DbAppt[]>([]);
  // Bookings the doctor just confirmed/declined here — hidden from the request
  // list instantly (the next poll then reflects the persisted DB status).
  const [handledCodes, setHandledCodes] = useState<Set<string>>(new Set());
  const loadDbAppts = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/appointments", { cache: "no-store" });
      if (!res.ok) return;
      const j = await res.json();
      setDbAppts((j.appointments ?? []) as DbAppt[]);
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    const run = async () => {
      await loadDbAppts();
    };
    run();
    const id = setInterval(run, 15000);
    return () => clearInterval(id);
  }, [loadDbAppts]);

  // Quick-add (appointment / operation) modals on the overview + their catalogs.
  const [quickAdd, setQuickAdd] = useState<null | "appointment" | "operation">(null);
  const [appointmentDraft, setAppointmentDraft] = useState<{ date: string; time: string } | null>(null);
  const [qaDoctors, setQaDoctors] = useState<DoctorLite[]>([]);
  const [qaProcedures, setQaProcedures] = useState<Procedure[]>([]);
  const loadQuickCatalogs = useCallback(async () => {
    try {
      const [dRes, pRes] = await Promise.all([
        fetch("/api/admin/doctors", { cache: "no-store" }),
        fetch("/api/admin/procedures", { cache: "no-store" }),
      ]);
      if (dRes.ok) {
        const j = await dRes.json();
        setQaDoctors((j.doctors ?? []) as DoctorLite[]);
      }
      if (pRes.ok) {
        const j = await pRes.json();
        setQaProcedures((j.procedures ?? []) as Procedure[]);
      }
    } catch {
      /* ignore */
    }
  }, []);
  useEffect(() => {
    loadQuickCatalogs();
  }, [loadQuickCatalogs]);

  const todayMid = useMemo(() => {
    const x = new Date(base);
    x.setHours(0, 0, 0, 0);
    return x.getTime();
  }, [base]);
  const dayOffsetOf = (iso: string) => {
    const x = new Date(iso);
    x.setHours(0, 0, 0, 0);
    return Math.round((x.getTime() - todayMid) / 86400000);
  };
  const hhmmOf = (iso: string) => {
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // DB bookings (confirmed + pending + just-completed) mapped into the schedule
  // Appointment shape, limited to the visible week so they show in the day grid +
  // week strip. Completed ones render with a "done" flag so the doctor can see
  // what's finished (and they no longer offer a Finish button).
  const onlineAppts = useMemo<Appointment[]>(() => {
    return dbAppts
      .filter((a) => a.status === "confirmed" || a.status === "pending" || a.status === "completed")
      .map((a) => {
        const typeId = sessionTypes.some((s) => s.id === a.serviceId) ? a.serviceId : "checkup";
        const doctorName = (lang === "ar" ? a.doctorNameAr : a.doctorNameEn) || a.doctorNameEn || a.doctorNameAr || undefined;
        return {
          id: `online-${a.code}`,
          patient: { en: a.patientName, ar: a.patientName },
          typeId,
          dayOffset: dayOffsetOf(a.scheduledAt),
          start: hhmmOf(a.scheduledAt),
          status: a.status === "pending" ? "pending" : "confirmed",
          phone: a.phone,
          code: a.code,
          online: true,
          done: a.status === "completed",
          doctorName: doctorName ?? undefined,
        } as Appointment;
      })
      .filter((a) => a.dayOffset >= 0 && a.dayOffset < WEEK_DAYS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbAppts, todayMid, lang]);

  // Pending DB bookings mapped into the Lead shape so WhatsApp/website requests
  // show in the "Recent Bookings — requests to review" panel for the doctor to
  // confirm or decline (newest request first).
  const dbLeads = useMemo<Lead[]>(() => {
    return dbAppts
      .filter((a) => a.status === "pending" && !handledCodes.has(a.code))
      .map((a) => {
        const serviceId = sessionTypes.some((s) => s.id === a.serviceId) ? a.serviceId : "checkup";
        return {
          id: `wa-${a.code}`,
          name: a.patientName,
          phone: a.phone,
          message: a.complaint ?? "",
          offerId: null,
          offerTitle: null,
          serviceId,
          serviceLabel: { en: a.serviceLabelEn, ar: a.serviceLabelAr },
          dayOffset: dayOffsetOf(a.scheduledAt),
          start: hhmmOf(a.scheduledAt),
          appointmentId: null,
          trackCode: a.code,
          createdAt: new Date(a.createdAt).getTime(),
          status: "new",
        } as Lead;
      })
      .sort((x, y) => y.createdAt - x.createdAt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dbAppts, handledCodes, todayMid]);

  // Merge the local schedule with online (DB) bookings for all schedule views.
  const scheduleAppts = useMemo(() => {
    const seen = new Set(appointments.map((a) => a.id));
    return [...appointments, ...onlineAppts.filter((a) => !seen.has(a.id))];
  }, [appointments, onlineAppts]);


  // Refresh the client list periodically so new website/WhatsApp bookings and
  // edits made elsewhere surface without a manual reload.
  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive) reloadPatients();
    };
    tick();
    const id = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [reloadPatients]);

  // Unread WhatsApp client-message count (drives the "Client Messages" nav badge).
  const [unreadMessages, setUnreadMessages] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/chats", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (alive) setUnreadMessages(j.totalUnread ?? 0);
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 12000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [activeNav]);

  // Post-session follow-up (متابعة) replies awaiting the doctor. Each entry is one
  // client who answered the automatic follow-up and hasn't been read yet; they
  // surface as a floating alert on the overview. Opening the chat clears them.
  type FollowupReply = {
    phone: string;
    name: string;
    chatId: string | null;
    lastBody: string;
    lastAt: string;
    count: number;
  };
  const [followupReplies, setFollowupReplies] = useState<FollowupReply[]>([]);
  // "Now" for relative timestamps, refreshed each poll (keeps render pure — no
  // Date.now() during render).
  const [nowTs, setNowTs] = useState(0);
  // The client chat to auto-open in the Messages tab (set by tapping an alert).
  const [openChatPhone, setOpenChatPhone] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/admin/followup-replies", { cache: "no-store" });
        if (!res.ok) return;
        const j = await res.json();
        if (alive) {
          setFollowupReplies((j.replies ?? []) as FollowupReply[]);
          setNowTs(Date.now());
        }
      } catch {
        /* ignore */
      }
    };
    load();
    const id = setInterval(load, 12000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [activeNav]);

  const openFollowupChat = (r: FollowupReply) => {
    setOpenChatPhone(r.phone);
    setActiveNav("messages");
    // Optimistically drop it from the alert list; the next poll confirms (the
    // thread GET marks it read server-side).
    setFollowupReplies((prev) => prev.filter((x) => x.phone !== r.phone));
  };
  const handleChatOpened = useCallback(() => setOpenChatPhone(null), []);
  const openAppointmentSlot = useCallback(
    (slot: { dayOffset: number; startMin: number }) => {
      loadQuickCatalogs();
      setAppointmentDraft({
        date: isoDate(base, slot.dayOffset),
        time: minToHHMM(slot.startMin),
      });
      setQuickAdd("appointment");
    },
    [base, loadQuickCatalogs]
  );
  const closeQuickAdd = useCallback(() => {
    setQuickAdd(null);
    setAppointmentDraft(null);
  }, []);

  // Confirm an online booking lead: lock its slot, create the client + session.
  const confirmLead = (lead: Lead) => {
    if (lead.appointmentId) updateAppointment(lead.appointmentId, { status: "confirmed" });

    // Fire the server-side WhatsApp flow (sends "reserved" + schedules reminder/queue).
    if (lead.trackCode) {
      fetch(`/api/admin/appointments/${lead.trackCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "confirm" }),
      })
        .then(() => reloadPatients())
        .catch(() => {});
      setHandledCodes((prev) => new Set(prev).add(lead.trackCode!));
    }

    const digits = lead.phone.replace(/\D/g, "");
    const offerNote = lead.offerTitle ? `${tr({ en: "Offer", ar: "عرض" })}: ${tr(lead.offerTitle)}` : "";
    const note = [offerNote, lead.message].filter(Boolean).join(" — ");
    const session =
      lead.serviceId && lead.dayOffset != null && lead.start
        ? {
            id: `s-${lead.id}`,
            typeId: lead.serviceId,
            date: isoDate(base, lead.dayOffset),
            cost: sessionTypeById(lead.serviceId).price,
            status: "scheduled" as const,
            notes: note || undefined,
          }
        : null;
    setPatients((prev) => {
      const idx = digits.length >= 5 ? prev.findIndex((p) => p.phone.replace(/\D/g, "") === digits) : -1;
      if (idx >= 0) {
        const ex = prev[idx];
        const merged = {
          ...ex,
          notes: [ex.notes, note].filter(Boolean).join(" | "),
          sessions: session && !ex.sessions.some((s) => s.id === session.id) ? [...ex.sessions, session] : ex.sessions,
        };
        const copy = [...prev];
        copy[idx] = merged;
        return copy;
      }
      const created = newPatient({
        name: lead.name || "—",
        phone: lead.phone,
        source: "booking",
        createdAt: isoDate(base),
        notes: note,
        sessions: session ? [session] : [],
      });
      return [created, ...prev];
    });
    markLeadSeen(lead.id);
    if (lead.dayOffset != null && lead.dayOffset >= 0 && lead.dayOffset < WEEK_DAYS) {
      setSelectedOffset(lead.dayOffset);
    }
  };

  // Decline an online booking: free its slot and drop the lead.
  const declineLead = (lead: Lead) => {
    // DB-backed (WhatsApp/website) booking: mark it declined server-side.
    if (lead.trackCode) {
      fetch(`/api/admin/appointments/${lead.trackCode}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      }).catch(() => {});
      setHandledCodes((prev) => new Set(prev).add(lead.trackCode!));
    }
    if (lead.appointmentId) removeAppointment(lead.appointmentId);
    removeLead(lead.id);
  };

  // Mark a session finished from the schedule. Sets completedAt server-side,
  // which starts the post-session follow-up timer. Optimistically flips the card
  // to "done", then refreshes from the DB.
  const finishSession = (code: string) => {
    setDbAppts((prev) => prev.map((a) => (a.code === code ? { ...a, status: "completed" } : a)));
    fetch(`/api/admin/appointments/${code}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    })
      .then(() => loadDbAppts())
      .catch(() => {});
  };

  // When a booking is confirmed, create or update the client's profile.
  const upsertPatientFromRequest = (req: BookingRequest) => {
    const reqDigits = req.phone.replace(/\D/g, "");
    const date = isoDate(base, req.dayOffset);
    const cost = sessionTypeById(req.typeId).price;
    const session = {
      id: `s-${req.id}`,
      typeId: req.typeId,
      date,
      cost,
      status: "scheduled" as const,
      notes: req.complaint.en,
    };
    setPatients((prev) => {
      const idx = prev.findIndex(
        (p) => p.phone.replace(/\D/g, "") === reqDigits
      );
      if (idx >= 0) {
        const existing = prev[idx];
        if (existing.sessions.some((s) => s.id === session.id)) return prev;
        const updated = { ...existing, sessions: [...existing.sessions, session] };
        const copy = [...prev];
        copy[idx] = updated;
        return copy;
      }
      const created = newPatient({
        name: req.patient.en,
        phone: req.phone,
        source: "booking",
        createdAt: isoDate(base),
        notes: req.complaint.en,
        sessions: [session],
      });
      return [created, ...prev];
    });
  };

  const confirmRequest = (id: string) => {
    const req = requests.find((r) => r.id === id);
    if (!req || req.status !== "new") return;
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "confirmed" } : r))
    );
    addAppointment({
      id: `appt-${req.id}`,
      patient: req.patient,
      typeId: req.typeId,
      dayOffset: req.dayOffset,
      start: req.start,
      status: "confirmed",
      phone: req.phone,
    });
    upsertPatientFromRequest(req);
    setSelectedOffset(req.dayOffset);
  };

  const declineRequest = (id: string) => {
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "declined" } : r))
    );
  };

  const todayAppts = scheduleAppts.filter((a) => a.dayOffset === 0);
  const newLeadCount = leads.filter((l) => l.status === "new").length;
  const newCount =
    requests.filter((r) => r.status === "new").length + newLeadCount + dbLeads.length;
  const freeToday = freeSlotCount(todayAppts);
  const nextAppt = [...todayAppts].sort(
    (a, b) => hhmmToMin(a.start) - hhmmToMin(b.start)
  )[0];

  const hour = base.getHours();
  const greeting =
    hour < 12
      ? { en: "Good morning", ar: "صباح الخير" }
      : hour < 18
      ? { en: "Good afternoon", ar: "مساء الخير" }
      : { en: "Good evening", ar: "مساء الخير" };

  // Compact "time ago" for the follow-up alert timestamps (nowTs comes from the
  // poll so this stays pure during render).
  const timeAgo = (iso: string): string => {
    const ref = nowTs || new Date(iso).getTime();
    const diff = ref - new Date(iso).getTime();
    const mins = Math.max(0, Math.round(diff / 60000));
    if (mins < 1) return tr({ en: "just now", ar: "الآن" });
    if (mins < 60) return tr({ en: `${mins}m ago`, ar: `منذ ${mins} د` });
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return tr({ en: `${hrs}h ago`, ar: `منذ ${hrs} س` });
    const days = Math.round(hrs / 24);
    return tr({ en: `${days}d ago`, ar: `منذ ${days} يوم` });
  };

  return (
    <div className={`${theme === "dark" ? "dash-dark" : "dash-light"} flex min-h-screen bg-background text-ink`}>
      {/* ---------- Sidebar ---------- */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-e border-primary/10 bg-surface/60 p-4 lg:flex">
        <div className="flex items-center gap-2 px-2 py-2">
          <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-white p-0.5 shadow-lg shadow-primary/20">
            <Image src={site.logo} alt={tr(t.brand)} width={40} height={40} className="h-full w-full object-contain" />
          </span>
          <span className="text-base font-bold tracking-tight">{tr(t.brand)}</span>
        </div>

        <nav className="custom-scroll mt-6 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
          {linkItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-muted transition hover:bg-primary/5 hover:text-ink"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {tr(item.label)}
            </Link>
          ))}
          <div className="my-1 h-px bg-primary/10" />
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                activeNav === item.id
                  ? "bg-primary/15 text-primary"
                  : "text-muted hover:bg-primary/5 hover:text-ink"
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={item.icon} />
              </svg>
              {tr(item.label)}
              {item.id === "messages" && unreadMessages > 0 && (
                <span className="ms-auto grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-[#0a0e12]">
                  {unreadMessages}
                </span>
              )}
            </button>
          ))}
        </nav>

        <Link
          href="/"
          className="mt-auto flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-primary/5 hover:text-primary"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          {tr({ en: "Back to site", ar: "العودة للموقع" })}
        </Link>
        <button
          onClick={() => {
            fetch("/api/auth/logout", { method: "POST" }).finally(() => window.location.assign("/login"));
          }}
          className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-rose-500/5 hover:text-rose-600"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          {tr({ en: "Sign out", ar: "تسجيل الخروج" })}
        </button>
      </aside>

      {/* ---------- Main ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* topbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-primary/10 bg-background/80 px-4 py-3 backdrop-blur-md lg:px-6">
          <div>
            <h1 className="text-base font-bold lg:text-lg">
              {tr({ en: "Doctor Dashboard", ar: "لوحة الطبيب" })}
            </h1>
            <p className="hidden text-xs text-muted sm:block">
              {activeNav === "patients"
                ? tr({ en: "Clients & payments", ar: "العملاء والمدفوعات" })
                : tr({ en: "Appointments & schedule", ar: "المواعيد والجدول" })}
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <BranchSwitcher compact />
            <LanguageToggle />
            <button
              onClick={toggleTheme}
              aria-label="Toggle theme"
              title={tr({ en: "Toggle dark / light", ar: "تبديل الوضع الليلي/النهاري" })}
              className="grid h-9 w-9 place-items-center rounded-full border border-primary/20 text-ink transition hover:border-primary hover:text-primary"
            >
              {theme === "dark" ? (
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                </svg>
              )}
            </button>
            <button
              aria-label="Notifications"
              className="relative grid h-9 w-9 place-items-center rounded-full border border-primary/20 text-ink transition hover:border-primary hover:text-primary"
            >
              <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0" />
              </svg>
              {newCount > 0 && (
                <span className="absolute -top-0.5 -end-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-[#0a0e12]">
                  {newCount}
                </span>
              )}
            </button>
            <span className="grid h-9 w-9 place-items-center overflow-hidden rounded-full bg-white p-0.5 ring-2 ring-primary/40">
              <Image src={site.logo} alt={tr(t.brand)} width={40} height={40} className="h-full w-full object-contain" />
            </span>
          </div>
        </header>

        {/* content */}
        <main className="flex-1 space-y-5 p-4 lg:p-6">
          {/* mobile section switcher (sidebar is desktop-only) */}
          <div className="custom-scroll -mx-1 flex gap-2 overflow-x-auto px-1 lg:hidden">
            {linkItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-primary/15 px-3.5 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {tr(item.label)}
              </Link>
            ))}
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveNav(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
                  activeNav === item.id
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-primary/15 text-muted"
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d={item.icon} />
                </svg>
                {tr(item.label)}
                {item.id === "messages" && unreadMessages > 0 && (
                  <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[9px] font-bold text-[#0a0e12]">
                    {unreadMessages}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeNav === "overview" && (
          <>
          {/* floating follow-up (متابعة) reply alerts */}
          {followupReplies.length > 0 && (
            <div className="followup-alert sticky top-2 z-20 overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-surface shadow-lg shadow-primary/10 ring-1 ring-primary/20">
              <div className="flex items-center gap-2.5 border-b border-primary/15 bg-primary/10 px-4 py-2.5">
                <span className="followup-bell grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/20 text-primary">
                  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
                  </svg>
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">
                    {tr({ en: "Follow-up replies", ar: "ردود المتابعة" })}
                  </p>
                  <p className="truncate text-[11px] text-muted">
                    {tr({
                      en: "Patients answered your after-visit message — tap to reply.",
                      ar: "مرضى ردّوا على رسالة المتابعة — اضغط للرد.",
                    })}
                  </p>
                </div>
                <span className="ms-auto grid h-6 min-w-6 shrink-0 place-items-center rounded-full bg-primary px-2 text-xs font-bold text-[#0a0e12]">
                  {followupReplies.length}
                </span>
              </div>
              <div className="custom-scroll max-h-64 space-y-1.5 overflow-y-auto p-2.5">
                {followupReplies.map((r) => (
                  <button
                    key={r.phone}
                    onClick={() => openFollowupChat(r)}
                    className="flex w-full items-center gap-3 rounded-xl border border-primary/12 bg-surface p-2.5 text-start transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-primary/5"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                      {(r.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-bold text-ink">{r.name}</span>
                        <span className="shrink-0 text-[10px] text-muted">{timeAgo(r.lastAt)}</span>
                      </span>
                      <span className="truncate text-xs text-muted">{r.lastBody}</span>
                    </span>
                    {r.count > 1 && (
                      <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary/20 px-1 text-[10px] font-bold text-primary">
                        {r.count}
                      </span>
                    )}
                    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-primary rtl:rotate-180" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* greeting */}
          <div>
            <h2 className="text-xl font-extrabold tracking-tight lg:text-2xl">
              {tr(greeting)}, {tr(t.brand)} 👋
            </h2>
            <p className="mt-1 text-sm text-muted">
              {tr({
                en: "Here's what your clinic looks like today.",
                ar: "إليك ملخص عيادتك اليوم.",
              })}
            </p>
          </div>

          {/* quick actions */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => {
                loadQuickCatalogs();
                setQuickAdd("appointment");
              }}
              className="group flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-surface p-4 text-start transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg hover:shadow-primary/10"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary/25">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4.5" width="18" height="17" rx="2" />
                  <path d="M3 9h18M8 2.5v4M16 2.5v4M12 13v4M10 15h4" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-ink">{tr({ en: "Add appointment", ar: "إضافة موعد" })}</span>
                <span className="block truncate text-xs text-muted">{tr({ en: "Book a day, pick the doctor & client.", ar: "احجز يومًا، اختر الطبيب والعميل." })}</span>
              </span>
            </button>
            <button
              onClick={() => {
                loadQuickCatalogs();
                setQuickAdd("operation");
              }}
              className="group flex items-center gap-3 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-surface p-4 text-start transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-lg hover:shadow-primary/10"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary transition group-hover:bg-primary/25">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4.5c-2-1.4-5-1.6-6.3.3-1.2 1.8-.6 4.3 0 6.6.5 1.9.3 3 .8 5.2.3 1.4.7 2.9 1.6 2.9 1.1 0 1.1-2 1.6-3.6.3-1 .8-1.7 1.3-1.7s1 .7 1.3 1.7c.5 1.6.5 3.6 1.6 3.6.9 0 1.3-1.5 1.6-2.9.5-2.2.3-3.3.8-5.2.6-2.3 1.2-4.8 0-6.6C17 2.9 14 3.1 12 4.5Z" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-ink">{tr({ en: "Record operation", ar: "تسجيل عملية" })}</span>
                <span className="block truncate text-xs text-muted">{tr({ en: "Log a procedure just done & the doctors.", ar: "سجّل عملية تمّت للتو والأطباء." })}</span>
              </span>
            </button>
          </div>

          {/* stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              accent="#c9a24b"
              label={tr({ en: "Today's Sessions", ar: "جلسات اليوم" })}
              value={String(todayAppts.length)}
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4.5" width="18" height="17" rx="2" />
                  <path d="M3 9h18M8 2.5v4M16 2.5v4" />
                </svg>
              }
            />
            <StatCard
              accent="#60a5fa"
              label={tr({ en: "New Requests", ar: "حجوزات جديدة" })}
              value={String(newCount)}
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 5h16v10H7l-3 3V5Z" />
                </svg>
              }
            />
            <StatCard
              accent="#34d399"
              label={tr({ en: "Free Slots Today", ar: "مواعيد متاحة اليوم" })}
              value={String(freeToday)}
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 7.5V12l3 2" />
                </svg>
              }
            />
            <StatCard
              accent="#f472b6"
              label={tr({ en: "Next Session", ar: "الجلسة القادمة" })}
              value={nextAppt ? fmtTime(base, 0, hhmmToMin(nextAppt.start), lang) : "—"}
              caption={
                nextAppt
                  ? `${tr(nextAppt.patient)} · ${tr(sessionTypeById(nextAppt.typeId).label)}`
                  : tr({ en: "No sessions today", ar: "لا جلسات اليوم" })
              }
              icon={
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 19a4 4 0 0 0-8 0M12 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
                </svg>
              }
            />
          </div>

          {/* week strip */}
          <div className="custom-scroll flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: WEEK_DAYS }, (_, offset) => {
              const count = scheduleAppts.filter((a) => a.dayOffset === offset).length;
              const active = selectedOffset === offset;
              const closed = isClosed(base, offset);
              return (
                <button
                  key={offset}
                  onClick={() => setSelectedOffset(offset)}
                  className={`flex min-w-[4.5rem] flex-col items-center gap-1 rounded-2xl border px-3 py-2.5 transition ${
                    active
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-primary/12 bg-surface text-muted hover:border-primary/30 hover:text-ink"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase">
                    {offset === 0 ? tr({ en: "Today", ar: "اليوم" }) : fmtWeekday(base, offset, lang)}
                  </span>
                  <span className="text-lg font-extrabold">{fmtDayNum(base, offset, lang)}</span>
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      closed ? "bg-rose-500/70" : count > 0 ? "bg-primary" : "bg-muted/30"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* panels */}
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="h-[38rem] lg:col-span-2">
              <DaySchedule
                base={base}
                dayOffset={selectedOffset}
                appointments={scheduleAppts}
                onFinish={finishSession}
                onBookSlot={openAppointmentSlot}
              />
            </div>
            <div className="h-[38rem]">
              <BookingRequests
                base={base}
                requests={requests}
                extraLeads={dbLeads}
                onConfirm={confirmRequest}
                onDecline={declineRequest}
                onLeadConfirm={confirmLead}
                onLeadDecline={declineLead}
              />
            </div>
          </div>
          </>
          )}

          {activeNav === "patients" && (
            <PatientsSection
              patients={patients}
              base={base}
              onSavePatient={savePatient}
              onDeletePatient={deletePatient}
            />
          )}

          {activeNav === "operations" && <OperationsManager />}

          {activeNav === "doctors" && <DoctorsManager />}

          {activeNav === "analytics" && <AnalyticsSection />}

          {activeNav === "revenue" && <RevenueSection />}

          {activeNav === "earnings" && <EarningsDashboard />}

          {activeNav === "reminders" && <RemindersSection />}

          {activeNav === "bookings" && <OnlineBookings />}

          {activeNav === "whatsapp" && <WhatsAppLink />}

          {activeNav === "outreach" && <OutreachManager />}

          {activeNav === "messages" && (
            <ClientMessages initialPhone={openChatPhone} onOpened={handleChatOpened} />
          )}

          {activeNav === "offers" && <OffersManager />}

          {activeNav === "editor" && <SiteEditor />}

          {activeNav === "settings" && <SettingsSection />}

          {activeNav === "calendar" && <CalendarSection />}
        </main>
      </div>

      {quickAdd === "appointment" && (
        <AddAppointmentModal
          procedures={qaProcedures}
          doctors={qaDoctors}
          initialDate={appointmentDraft?.date}
          initialTime={appointmentDraft?.time}
          onClose={closeQuickAdd}
          onSaved={() => {
            closeQuickAdd();
            loadDbAppts();
          }}
        />
      )}
      {quickAdd === "operation" && (
        <QuickOperationModal
          procedures={qaProcedures.filter((p) => p.active)}
          doctors={qaDoctors.filter((d) => d.active)}
          onClose={closeQuickAdd}
          onSaved={() => {
            closeQuickAdd();
            loadDbAppts();
          }}
        />
      )}
    </div>
  );
}
