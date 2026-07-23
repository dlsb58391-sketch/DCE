"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLang } from "@/lib/language";

export type MapLead = {
  id: string;
  name: string;
  phone: string;
  status: string;
  place: string | null;
  lat: number | null;
  lng: number | null;
};

type Clinic = {
  name: string;
  phone: string;
  lat: number;
  lng: number;
  address?: string;
  website?: string;
};

type Suggestion = { lat: number; lng: number; label: string };
type Note = { kind: "ok" | "err" | "info"; text: string };

const DEFAULT_CENTER = { lat: 30.0444, lng: 31.2357 }; // Cairo

// Nominatim display names are long ("Maadi, Cairo Governorate, Egypt, ..."); keep
// the first two comma parts so tab labels / place names stay compact and readable.
function shortPlace(label: string): string {
  const parts = label
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(", ") || label;
  return parts.slice(0, 2).join(", ");
}

function statusColor(status: string): string {
  switch (status) {
    case "sent":
      return "#16a34a";
    case "replied":
      return "#0ea5e9";
    case "queued":
      return "#f59e0b";
    case "failed":
      return "#dc2626";
    case "optout":
    case "not_whatsapp":
      return "#6b7280";
    default:
      return "#7c3aed"; // new
  }
}

function isSent(status: string): boolean {
  return status === "sent" || status === "replied";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function pinIcon(color: string, tick: string) {
  const html =
    `<div style="width:16px;height:16px;border-radius:50%;background:${color};border:2px solid #fff;` +
    `box-shadow:0 0 0 1px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;` +
    `color:#fff;font-size:10px;font-weight:700;line-height:1">${tick}</div>`;
  return L.divIcon({ html, className: "", iconSize: [16, 16], iconAnchor: [8, 8] });
}

function centerIcon() {
  const html =
    `<div style="width:18px;height:18px;border-radius:50%;background:#7c3aed;` +
    `border:3px solid #fff;box-shadow:0 0 0 2px #7c3aed"></div>`;
  return L.divIcon({ html, className: "", iconSize: [18, 18], iconAnchor: [9, 9] });
}

// Google Maps zoom that roughly frames a circle of the given radius so the
// scraper's results come from the drawn area (smaller circle -> closer zoom).
function zoomForRadius(radiusM: number): number {
  const km = Math.max(0.2, radiusM / 1000);
  const z = Math.round(15.5 - Math.log2(km));
  return Math.max(11, Math.min(16, z));
}

// Great-circle distance in metres — used to keep only clinics that actually sit
// inside the drawn circle.
function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const la1 = (aLat * Math.PI) / 180;
  const la2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export default function OutreachMap({
  leads,
  onImported,
}: {
  leads: MapLead[];
  onImported: () => void;
}) {
  const { tr } = useLang();

  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);
  const leadLayerRef = useRef<L.LayerGroup | null>(null);
  const discoverLayerRef = useRef<L.LayerGroup | null>(null);

  const [center, setCenter] = useState(DEFAULT_CENTER);
  const centerRef = useRef(center);
  useEffect(() => {
    centerRef.current = center;
  }, [center]);

  const [radiusM, setRadiusM] = useState(2500);
  const radiusRef = useRef(radiusM);
  useEffect(() => {
    radiusRef.current = radiusM;
  }, [radiusM]);

  const [search, setSearch] = useState("");
  const [placeLabel, setPlaceLabel] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSuggest, setShowSuggest] = useState(false);
  const justPickedRef = useRef(false);

  const [searching, setSearching] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [importing, setImporting] = useState(false);

  const [discovery, setDiscovery] = useState<{ group: string; clinics: Clinic[] } | null>(null);
  const [note, setNote] = useState<Note | null>(null);

  // ---- derived -------------------------------------------------------------
  const knownPhones = useMemo(() => new Set(leads.map((l) => l.phone)), [leads]);

  // Freshly-found clinics in the circle that have a number and aren't already leads.
  const discoveredNew = useMemo(
    () => (discovery?.clinics || []).filter((c) => c.phone && !knownPhones.has(c.phone)),
    [discovery, knownPhones],
  );

  // Frame the drawn circle so the user sees the area (and clinics) under it.
  // Stable identity (only reads refs) so the map-init effect can call it safely.
  const flyToCircle = useCallback((lat: number, lng: number) => {
    const map = mapRef.current;
    if (!map) return;
    try {
      const bounds = L.latLng(lat, lng).toBounds(radiusRef.current * 2.4);
      map.flyToBounds(bounds, { maxZoom: 15, padding: [30, 30], duration: 0.5 });
    } catch {
      map.flyTo([lat, lng], map.getZoom(), { duration: 0.5 });
    }
  }, []);

  // ---- map init (once) -----------------------------------------------------
  useEffect(() => {
    if (!mapEl.current || mapRef.current) return;
    const map = L.map(mapEl.current, {
      center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lng],
      zoom: 12,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const circle = L.circle([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
      radius: radiusRef.current,
      color: "#7c3aed",
      weight: 1.5,
      fillColor: "#7c3aed",
      fillOpacity: 0.08,
    }).addTo(map);

    const centerMarker = L.marker([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], {
      draggable: true,
      icon: centerIcon(),
    }).addTo(map);
    centerMarker.bindTooltip(
      tr({ en: "Drag me, or click the map, to move the circle here", ar: "اسحبني أو انقر على الخريطة لتحريك الدائرة هنا" }),
      { direction: "top", offset: [0, -10] },
    );
    centerMarker.on("drag", () => {
      circle.setLatLng(centerMarker.getLatLng());
    });
    centerMarker.on("dragend", () => {
      const p = centerMarker.getLatLng();
      setCenter({ lat: p.lat, lng: p.lng });
      flyToCircle(p.lat, p.lng);
    });

    // Click anywhere on the map to move the circle centre there, then fly to it so
    // the user sees the area (and the clinics) under the circle before pressing
    // "Find clinics in this circle".
    map.on("click", (e: L.LeafletMouseEvent) => {
      const p = e.latlng;
      circle.setLatLng(p);
      centerMarker.setLatLng(p);
      setCenter({ lat: p.lat, lng: p.lng });
      flyToCircle(p.lat, p.lng);
    });

    const leadLayer = L.layerGroup().addTo(map);
    const discoverLayer = L.layerGroup().addTo(map);

    mapRef.current = map;
    circleRef.current = circle;
    centerMarkerRef.current = centerMarker;
    leadLayerRef.current = leadLayer;
    discoverLayerRef.current = discoverLayer;

    // The container is inside a lazily shown tab; make sure Leaflet measures it.
    const t = setTimeout(() => map.invalidateSize(), 120);

    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep circle radius / center in sync with state
  useEffect(() => {
    circleRef.current?.setRadius(radiusM);
  }, [radiusM]);
  useEffect(() => {
    circleRef.current?.setLatLng([center.lat, center.lng]);
    centerMarkerRef.current?.setLatLng([center.lat, center.lng]);
  }, [center]);

  // lead pins
  useEffect(() => {
    const layer = leadLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const l of leads) {
      if (typeof l.lat !== "number" || typeof l.lng !== "number") continue;
      const color = statusColor(l.status);
      const marker = L.marker([l.lat, l.lng], { icon: pinIcon(color, isSent(l.status) ? "\u2713" : "") });
      const phone = l.phone ? `<div dir="ltr">${escapeHtml(l.phone)}</div>` : "";
      marker.bindPopup(
        `<b>${escapeHtml(l.name)}</b>${phone}<div style="color:#6b7280">${escapeHtml(l.status)}</div>`,
      );
      layer.addLayer(marker);
    }
  }, [leads]);

  // discovered clinic pins (latest circle discovery)
  useEffect(() => {
    const layer = discoverLayerRef.current;
    if (!layer) return;
    layer.clearLayers();
    for (const c of discovery?.clinics || []) {
      const marker = L.marker([c.lat, c.lng], { icon: pinIcon(c.phone ? "#0891b2" : "#94a3b8", "") });
      const phone = c.phone
        ? `<div dir="ltr">${escapeHtml(c.phone)}</div>`
        : `<div style="color:#94a3b8">no number</div>`;
      marker.bindPopup(`<b>${escapeHtml(c.name)}</b>${phone}`);
      layer.addLayer(marker);
    }
  }, [discovery]);

  // search autocomplete (debounced)
  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false;
      return;
    }
    const q = search.trim();
    if (q.length < 2) {
      setSuggestions([]);
      setShowSuggest(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const c = centerRef.current;
        const r = await fetch(`/api/ads/geocode?q=${encodeURIComponent(q)}&lat=${c.lat}&lng=${c.lng}`, {
          cache: "no-store",
        });
        if (!r.ok) return;
        const j = await r.json();
        const res: Suggestion[] = Array.isArray(j?.results) ? j.results : [];
        setSuggestions(res);
        setShowSuggest(res.length > 0);
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ---- actions -------------------------------------------------------------
  function applyPlace(lat: number, lng: number, label: string) {
    justPickedRef.current = true;
    const short = shortPlace(label);
    setSearch(short);
    setPlaceLabel(short);
    setCenter({ lat, lng });
    setSuggestions([]);
    setShowSuggest(false);
    mapRef.current?.setView([lat, lng], 13);
  }

  async function runSearch() {
    const q = search.trim();
    if (q.length < 2) return;
    if (suggestions[0]) {
      applyPlace(suggestions[0].lat, suggestions[0].lng, suggestions[0].label);
      return;
    }
    setSearching(true);
    setNote(null);
    try {
      const c = centerRef.current;
      const r = await fetch(`/api/ads/geocode?q=${encodeURIComponent(q)}&lat=${c.lat}&lng=${c.lng}`, {
        cache: "no-store",
      });
      const j = await r.json();
      const hit: Suggestion | null = Array.isArray(j?.results) ? j.results[0] : null;
      if (!hit) {
        setNote({ kind: "err", text: tr({ en: "No place found.", ar: "لم يتم العثور على المكان." }) });
        return;
      }
      applyPlace(hit.lat, hit.lng, hit.label);
    } catch {
      setNote({ kind: "err", text: tr({ en: "Search failed.", ar: "فشل البحث." }) });
    } finally {
      setSearching(false);
    }
  }

  async function runDiscover() {
    setDiscovering(true);
    setNote(null);
    try {
      const c = centerRef.current;
      const rad = radiusRef.current;

      // Name the group after the actual place(s) UNDER the circle. When the circle
      // spans more than one place they are combined (e.g. "Nasr City + Heliopolis").
      let group = "";
      try {
        const rr = await fetch("/api/ads/area-name", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: c.lat, lng: c.lng, radius: rad }),
        });
        const jj = await rr.json();
        if (rr.ok && Array.isArray(jj?.places) && jj.places.length > 0) {
          group = jj.places.map((p: string) => shortPlace(p)).join(" + ");
        }
      } catch {
        /* fall through to typed / reverse name */
      }
      if (!group) group = placeLabel.trim() || search.trim();
      if (!group) {
        try {
          const rr = await fetch(`/api/ads/geocode?reverse=1&lat=${c.lat}&lng=${c.lng}`, { cache: "no-store" });
          const jj = await rr.json();
          const lbl = Array.isArray(jj?.results) ? jj.results[0]?.label : "";
          if (lbl) group = shortPlace(lbl);
        } catch {
          /* ignore */
        }
      }
      if (!group) group = `${c.lat.toFixed(3)}, ${c.lng.toFixed(3)}`;

      setNote({
        kind: "info",
        text: tr({
          en: `Scanning Google Maps near ${group}… this can take 1–3 min.`,
          ar: `يتم البحث في خرائط جوجل قرب ${group}… قد يستغرق ١-٣ دقائق.`,
        }),
      });

      // Primary: Google Maps scraper centred on the circle (rich phone coverage).
      const zoom = zoomForRadius(rad);
      let clinics: Clinic[] = [];
      let usedFallback = false;
      try {
        const r = await fetch("/api/ads/scrape", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: "dental clinic",
            place: group,
            lat: c.lat,
            lng: c.lng,
            zoom,
            max: 60,
            preview: true,
          }),
        });
        const j = await r.json();
        if (r.ok && Array.isArray(j?.clinics)) clinics = j.clinics as Clinic[];
      } catch {
        /* fall through to OSM */
      }

      // Fallback: instant OpenStreetMap Overpass (sparser, but no scraper needed).
      if (clinics.length === 0) {
        usedFallback = true;
        const r = await fetch("/api/ads/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lat: c.lat, lng: c.lng, radius: rad }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j?.error || "discover_failed");
        clinics = Array.isArray(j?.clinics) ? (j.clinics as Clinic[]) : [];
      }

      // Keep only clinics that actually sit inside the drawn circle. Clinics with
      // no coordinates are kept (can't be verified — better than dropping a lead).
      const foundTotal = clinics.length;
      const inside = clinics.filter((x) => {
        if (typeof x.lat !== "number" || typeof x.lng !== "number") return true;
        return haversineM(c.lat, c.lng, x.lat, x.lng) <= rad;
      });
      const trimmed = foundTotal - inside.length;
      if (inside.length > 0) clinics = inside;

      setDiscovery({ group, clinics });
      setPlaceLabel(group);
      const withPhone = clinics.filter((x) => x.phone).length;
      setNote({
        kind: clinics.length > 0 ? "ok" : "info",
        text: tr({
          en: `${group}: ${clinics.length} clinics under the circle (${withPhone} with numbers)${trimmed > 0 ? ` · ${trimmed} outside skipped` : ""}${usedFallback ? " · OSM fallback" : ""}.`,
          ar: `${group}: ${clinics.length} عيادة داخل الدائرة (${withPhone} بأرقام)${trimmed > 0 ? ` · تم تجاهل ${trimmed} خارجها` : ""}${usedFallback ? " · مصدر OSM" : ""}.`,
        }),
      });
    } catch {
      setNote({
        kind: "err",
        text: tr({ en: "Discovery failed. Try again.", ar: "فشل البحث عن العيادات. حاول مجددًا." }),
      });
    } finally {
      setDiscovering(false);
    }
  }

  async function importDiscovery() {
    if (!discovery) return;
    const list = discoveredNew;
    if (list.length === 0) return;
    setImporting(true);
    setNote(null);
    try {
      const r = await fetch("/api/ads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinics: list, place: discovery.group, query: "map" }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || "import_failed");
      setNote({
        kind: "ok",
        text: tr({
          en: `Added ${j.added ?? 0} clinic(s) to the send list.`,
          ar: `تمت إضافة ${j.added ?? 0} عيادة إلى قائمة الإرسال.`,
        }),
      });
      onImported();
    } catch {
      setNote({ kind: "err", text: tr({ en: "Add failed.", ar: "فشلت الإضافة." }) });
    } finally {
      setImporting(false);
    }
  }

  // ---- render --------------------------------------------------------------
  const noteCls =
    note?.kind === "err"
      ? "border-red-300 bg-red-50 text-red-700"
      : note?.kind === "ok"
        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
        : "border-primary/20 bg-primary/5 text-primary";

  return (
    <section className="rounded-2xl border border-primary/15 bg-white/70 p-4 shadow-sm dark:bg-slate-900/40">
      <header className="mb-3">
        <h3 className="text-base font-semibold text-primary">
          {tr({ en: "Clinics map", ar: "خريطة العيادات" })}
        </h3>
        <p className="text-xs text-muted">
          {tr({
            en: "Search a place, draw a circle, find clinics, then add them to your send list.",
            ar: "ابحث عن مكان، ارسم دائرة، اعثر على العيادات، ثم أضِفها إلى قائمة الإرسال.",
          })}
        </p>
      </header>

      {/* search bar with autocomplete */}
      <div className="relative z-[1000] mb-3">
        <div className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setShowSuggest(suggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggest(false), 150)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder={tr({ en: "Search a place (e.g. Nasr City)", ar: "ابحث عن مكان (مثل مدينة نصر)" })}
            className="w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={runSearch}
            disabled={searching || search.trim().length < 2}
            className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {searching ? "…" : tr({ en: "Go", ar: "بحث" })}
          </button>
        </div>
        {showSuggest && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full mt-1 max-h-64 overflow-auto rounded-lg border border-primary/20 bg-white shadow-lg dark:bg-slate-800">
            {suggestions.map((s, i) => (
              <li key={`${s.lat},${s.lng},${i}`}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applyPlace(s.lat, s.lng, s.label);
                  }}
                  className="block w-full truncate px-3 py-2 text-left text-sm text-slate-900 hover:bg-primary/10 dark:text-slate-100 dark:hover:bg-primary/20"
                  title={s.label}
                >
                  {s.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* radius + discover */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          {tr({ en: "Radius", ar: "نصف القطر" })}
          <input
            type="range"
            min={500}
            max={15000}
            step={250}
            value={radiusM}
            onChange={(e) => setRadiusM(Number(e.target.value))}
            className="w-40"
          />
          <span className="w-14 tabular-nums text-primary">{(radiusM / 1000).toFixed(1)} km</span>
        </label>
        <button
          type="button"
          onClick={runDiscover}
          disabled={discovering}
          className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {discovering
            ? tr({ en: "Finding…", ar: "جارٍ البحث…" })
            : tr({ en: "Find clinics in this circle", ar: "اعثر على العيادات في هذه الدائرة" })}
        </button>
      </div>

      {/* map */}
      <div ref={mapEl} className="h-[420px] w-full overflow-hidden rounded-xl border border-primary/15" />

      {/* legend */}
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted">
        <Dot color="#7c3aed" label={tr({ en: "new lead", ar: "عميل جديد" })} />
        <Dot color="#16a34a" label={tr({ en: "sent \u2713", ar: "تم الإرسال \u2713" })} />
        <Dot color="#0ea5e9" label={tr({ en: "replied", ar: "رد" })} />
        <Dot color="#0891b2" label={tr({ en: "discovered (has number)", ar: "مكتشفة (بها رقم)" })} />
        <Dot color="#94a3b8" label={tr({ en: "discovered (no number)", ar: "مكتشفة (بدون رقم)" })} />
      </div>

      {note && <div className={"mt-3 rounded-lg border px-3 py-2 text-sm " + noteCls}>{note.text}</div>}

      {/* recently found in this circle (preview) — add to the single send list */}
      <div className="mt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-primary">
            {discovery
              ? tr({ en: `Found in ${discovery.group}`, ar: `تم العثور في ${discovery.group}` })
              : tr({ en: "Recently found clinics", ar: "العيادات المكتشفة مؤخرًا" })}
            {discovery && <span className="opacity-60"> ({discovery.clinics.length})</span>}
          </h4>
          <button
            type="button"
            onClick={importDiscovery}
            disabled={importing || discoveredNew.length === 0}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {importing
              ? tr({ en: "Adding…", ar: "جارٍ الإضافة…" })
              : tr({
                  en: `Add ${discoveredNew.length} with numbers to the send list`,
                  ar: `أضف ${discoveredNew.length} بأرقام إلى قائمة الإرسال`,
                })}
          </button>
        </div>
        {!discovery ? (
          <p className="rounded-lg border border-dashed border-primary/20 p-3 text-xs text-muted">
            {tr({
              en: "Move the circle over an area and press \u201CFind clinics in this circle\u201D. The clinics you find appear here — add the ones with numbers to your one send list below.",
              ar: "حرّك الدائرة فوق منطقة واضغط \u201Cاعثر على العيادات في هذه الدائرة\u201D. تظهر العيادات هنا — أضِف التي لديها أرقام إلى قائمة الإرسال الواحدة بالأسفل.",
            })}
          </p>
        ) : discovery.clinics.length === 0 ? (
          <p className="rounded-lg border border-dashed border-primary/20 p-3 text-xs text-muted">
            {tr({ en: "No clinics under the circle. Try a bigger radius or a new spot.", ar: "لا توجد عيادات داخل الدائرة. جرّب نصف قطر أكبر أو مكانًا آخر." })}
          </p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-auto pr-1">
            {discovery.clinics.map((c, i) => {
              const already = c.phone ? knownPhones.has(c.phone) : false;
              return (
                <li
                  key={`${c.lat},${c.lng},${i}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-primary/10 bg-white/60 px-3 py-2 text-sm dark:bg-slate-800/40"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{c.name}</span>
                    {c.phone ? (
                      <span className="block text-xs text-muted" dir="ltr">
                        {c.phone}
                      </span>
                    ) : (
                      <span className="block text-xs text-slate-400">{tr({ en: "no number", ar: "بدون رقم" })}</span>
                    )}
                  </span>
                  {c.phone && (
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium " +
                        (already ? "bg-slate-100 text-slate-500" : "bg-emerald-100 text-emerald-700")
                      }
                    >
                      {already ? tr({ en: "in list", ar: "بالقائمة" }) : tr({ en: "new", ar: "جديد" })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
