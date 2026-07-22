"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/language";

type FileRec = {
  id: string;
  category: "xray" | "photo" | "document" | "medical";
  title: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
};

const CATEGORIES: { id: FileRec["category"]; label: { en: string; ar: string } }[] = [
  { id: "xray", label: { en: "X-ray", ar: "أشعة" } },
  { id: "photo", label: { en: "Photo", ar: "صورة" } },
  { id: "document", label: { en: "Document", ar: "مستند" } },
  { id: "medical", label: { en: "Medical record", ar: "سجل طبي" } },
];

const CAT_STYLE: Record<FileRec["category"], string> = {
  xray: "bg-indigo-100 text-indigo-700",
  photo: "bg-emerald-100 text-emerald-700",
  document: "bg-amber-100 text-amber-700",
  medical: "bg-rose-100 text-rose-700",
};

function humanSize(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const isImage = (m: string) => m.startsWith("image/");

export function PatientFiles({ patientKey, patientName }: { patientKey: string; patientName: string }) {
  const { tr, lang } = useLang();
  const [files, setFiles] = useState<FileRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [category, setCategory] = useState<FileRec["category"]>("xray");
  const [err, setErr] = useState("");
  const [lightbox, setLightbox] = useState<FileRec | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/patient-files?patientKey=${encodeURIComponent(patientKey)}`, { cache: "no-store" });
      if (res.ok) setFiles((await res.json()).files ?? []);
    } finally {
      setLoading(false);
    }
  }, [patientKey]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = useCallback(
    async (fileList: FileList | File[]) => {
      const arr = Array.from(fileList);
      if (arr.length === 0) return;
      setUploading(true);
      setErr("");
      try {
        for (const f of arr) {
          const fd = new FormData();
          fd.append("file", f);
          fd.append("patientKey", patientKey);
          fd.append("patientName", patientName);
          fd.append("category", category);
          const res = await fetch("/api/admin/patient-files", { method: "POST", body: fd });
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            const map: Record<string, { en: string; ar: string }> = {
              too_large: { en: "File too large (max 25 MB).", ar: "الملف كبير جدًا (الحد 25 ميجا)." },
              bad_type: { en: "Unsupported file type.", ar: "نوع ملف غير مدعوم." },
            };
            setErr(tr(map[j.error] ?? { en: "Upload failed.", ar: "فشل الرفع." }));
          }
        }
        await load();
      } finally {
        setUploading(false);
      }
    },
    [patientKey, patientName, category, load, tr]
  );

  const remove = async (f: FileRec) => {
    if (!window.confirm(tr({ en: `Delete "${f.fileName}"?`, ar: `حذف "${f.fileName}"؟` }))) return;
    await fetch(`/api/admin/patient-files/${f.id}`, { method: "DELETE" });
    setFiles((prev) => prev.filter((x) => x.id !== f.id));
  };

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between">
        <h4 className="text-sm font-bold uppercase tracking-wide text-ink">
          {tr({ en: "Files & X-rays", ar: "الملفات والأشعة" })} ({files.length})
        </h4>
      </div>

      {/* uploader */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files?.length) upload(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-4 transition ${
          dragOver ? "border-primary bg-primary/5" : "border-primary/20 bg-surface-2"
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                  category === c.id ? "bg-primary text-[#0a0e12]" : "border border-primary/15 text-muted hover:border-primary/40"
                }`}
              >
                {tr(c.label)}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-primary to-primary-dark px-3 py-1.5 text-sm font-semibold text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {uploading ? (
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0a0e12]/30 border-t-[#0a0e12]" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 16V4M7 9l5-5 5 5M4 20h16" />
              </svg>
            )}
            {uploading ? tr({ en: "Uploading…", ar: "جارٍ الرفع…" }) : tr({ en: "Upload", ar: "رفع ملف" })}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          {tr({
            en: "Drag & drop x-rays, photos or PDFs here · max 25 MB each",
            ar: "اسحب وأفلت الأشعة أو الصور أو ملفات PDF هنا · بحد أقصى 25 ميجا للملف",
          })}
        </p>
        {err && <p className="mt-2 text-center text-xs font-medium text-rose-600">{err}</p>}
      </div>

      {/* grid */}
      {loading ? (
        <div className="grid place-items-center py-8 text-muted">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
        </div>
      ) : files.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-primary/15 py-6 text-center text-sm text-muted">
          {tr({ en: "No files yet. Upload the first x-ray or photo above.", ar: "لا توجد ملفات بعد. ارفع أول أشعة أو صورة بالأعلى." })}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {files.map((f) => (
            <div key={f.id} className="group overflow-hidden rounded-xl border border-primary/12 bg-surface-2">
              <button
                type="button"
                onClick={() => (isImage(f.mimeType) ? setLightbox(f) : window.open(`/api/admin/patient-files/${f.id}/raw`, "_blank"))}
                className="relative block aspect-[4/3] w-full overflow-hidden bg-[#0a0e12]"
                title={f.fileName}
              >
                {isImage(f.mimeType) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/admin/patient-files/${f.id}/raw`}
                    alt={f.title || f.fileName}
                    className="h-full w-full object-cover transition group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <span className="grid h-full w-full place-items-center text-primary/70">
                    <svg viewBox="0 0 24 24" className="h-12 w-12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3v5h5M7 3h8l5 5v13H7z" /><path d="M9.5 14h5M9.5 17h5" />
                    </svg>
                  </span>
                )}
                <span className={`absolute start-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold ${CAT_STYLE[f.category]}`}>
                  {tr(CATEGORIES.find((c) => c.id === f.category)?.label ?? { en: f.category, ar: f.category })}
                </span>
              </button>
              <div className="flex items-center gap-1.5 p-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-ink" title={f.fileName}>{f.title || f.fileName}</p>
                  <p className="text-[10px] text-muted">{fmtDate(f.createdAt)} · {humanSize(f.size)}</p>
                </div>
                <a
                  href={`/api/admin/patient-files/${f.id}/raw?download=1`}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-primary"
                  title={tr({ en: "Download", ar: "تنزيل" })}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
                  </svg>
                </a>
                <button
                  type="button"
                  onClick={() => remove(f)}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-rose-500/10 hover:text-rose-600"
                  title={tr({ en: "Delete", ar: "حذف" })}
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2m-7 0v12m4-12v12M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-h-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/admin/patient-files/${lightbox.id}/raw`}
              alt={lightbox.title || lightbox.fileName}
              className="max-h-[80vh] w-auto rounded-xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl bg-white/95 px-4 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink">{lightbox.title || lightbox.fileName}</p>
                <p className="text-xs text-muted">{fmtDate(lightbox.createdAt)} · {humanSize(lightbox.size)}</p>
              </div>
              <a
                href={`/api/admin/patient-files/${lightbox.id}/raw?download=1`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-[#0a0e12]"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 4v12m0 0 4-4m-4 4-4-4M4 20h16" />
                </svg>
                {tr({ en: "Download", ar: "تنزيل" })}
              </a>
            </div>
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute -top-3 -end-3 grid h-9 w-9 place-items-center rounded-full bg-white text-ink shadow-lg transition hover:bg-rose-50 hover:text-rose-600"
              aria-label="Close"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
