"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLang } from "@/lib/language";

type Conversation = {
  phone: string;
  name: string;
  lastBody: string;
  lastAt: string;
  lastDir: string;
  unread: number;
  chatId: string | null;
};

type ChatMsg = {
  id: string;
  direction: "in" | "out";
  body: string;
  kind: string;
  createdAt: string;
};

export function ClientMessages({
  initialPhone = null,
  onOpened,
}: {
  initialPhone?: string | null;
  onOpened?: () => void;
} = {}) {
  const { tr, lang } = useLang();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [active, setActive] = useState<string | null>(initialPhone);
  const [activeName, setActiveName] = useState<string>("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set());
  // True until the first thread load highlights the follow-up reply that was
  // opened from an overview alert. A ref (not state) so reading/clearing it
  // inside the loader doesn't add render churn.
  const pendingHighlightRef = useRef<boolean>(!!initialPhone);
  const threadRef = useRef<HTMLDivElement | null>(null);

  const loadList = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/chats", { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setConversations(j.conversations ?? []);
      }
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadThread = useCallback(async (phone: string) => {
    try {
      const res = await fetch(`/api/admin/chats?phone=${encodeURIComponent(phone)}`, { cache: "no-store" });
      if (res.ok) {
        const j = await res.json();
        setMessages(j.messages ?? []);
        setActiveName(j.name ?? `+${phone}`);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadList();
    const id = setInterval(loadList, 10000);
    return () => clearInterval(id);
  }, [loadList]);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const run = async () => {
      try {
        const res = await fetch(`/api/admin/chats?phone=${encodeURIComponent(active)}`, { cache: "no-store" });
        if (res.ok && alive) {
          const j = await res.json();
          const msgs = (j.messages ?? []) as ChatMsg[];
          setMessages(msgs);
          setActiveName(j.name ?? `+${active}`);
          // First load after opening from a follow-up alert: highlight the
          // reply bubble(s) and scroll the newest into view. Runs once.
          if (alive && pendingHighlightRef.current) {
            pendingHighlightRef.current = false;
            const ids = msgs.filter((m) => m.direction === "in" && m.kind === "reply").map((m) => m.id);
            const target = ids.length ? ids : msgs.slice(-1).map((m) => m.id);
            setHighlightIds(new Set(target));
            const lastId = target[target.length - 1];
            requestAnimationFrame(() => {
              document.getElementById(`msg-${lastId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
            });
            window.setTimeout(() => {
              if (alive) setHighlightIds(new Set());
            }, 6000);
          }
        }
      } catch {
        /* ignore */
      }
    };
    run();
    const id = setInterval(run, 5000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [active]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  // Notify the parent that the requested chat has been consumed, so it can reset
  // its "open this phone" state (lets the same alert be tapped again later).
  useEffect(() => {
    if (initialPhone) onOpened?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openConversation = (c: Conversation) => {
    pendingHighlightRef.current = false;
    setHighlightIds(new Set());
    setActive(c.phone);
    setActiveName(c.name);
    setMessages([]);
    // Optimistically clear unread in the list.
    setConversations((prev) => prev.map((x) => (x.phone === c.phone ? { ...x, unread: 0 } : x)));
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !active || sending) return;
    setSending(true);
    setDraft("");
    // Optimistic append.
    const optimistic: ChatMsg = {
      id: `tmp-${Date.now()}`,
      direction: "out",
      body: text,
      kind: "manual",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    try {
      await fetch("/api/admin/chats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: active, text }),
      });
      await loadThread(active);
      loadList();
    } finally {
      setSending(false);
    }
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const today = new Date();
    const sameDay = d.toDateString() === today.toDateString();
    return new Intl.DateTimeFormat(lang === "ar" ? "ar-EG" : "en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
      ...(sameDay ? {} : { day: "numeric", month: "short" }),
      timeZone: "Africa/Cairo",
    }).format(d);
  };

  const totalUnread = conversations.reduce((n, c) => n + c.unread, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight text-ink">
            {tr({ en: "Client Messages", ar: "رسائل العملاء" })}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {tr({ en: "WhatsApp replies from patients — tap a chat to reply.", ar: "ردود المرضى على واتساب — اضغط على المحادثة للرد." })}
          </p>
        </div>
        {totalUnread > 0 && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-bold text-[#0a0e12]">
            {totalUnread} {tr({ en: "new", ar: "جديد" })}
          </span>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* conversation list */}
        <div className={`${active ? "hidden lg:block" : ""} lg:col-span-1`}>
          <div className="custom-scroll h-[34rem] space-y-2 overflow-y-auto rounded-2xl border border-primary/12 bg-surface p-3">
            {loadingList ? (
              <div className="grid h-full place-items-center text-muted">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
              </div>
            ) : conversations.length === 0 ? (
              <p className="grid h-full place-items-center px-4 text-center text-sm text-muted">
                {tr({ en: "No conversations yet. Patient replies will show here.", ar: "لا توجد محادثات بعد. ستظهر ردود المرضى هنا." })}
              </p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c.phone}
                  onClick={() => openConversation(c)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-start transition ${
                    active === c.phone
                      ? "border-primary bg-primary/10"
                      : "border-primary/10 hover:border-primary/30 hover:bg-primary/5"
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {(c.name || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold text-ink">{c.name}</span>
                      <span className="shrink-0 text-[10px] text-muted">{fmtTime(c.lastAt)}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted">
                        {c.lastDir === "out" ? "↩ " : ""}
                        {c.lastBody}
                      </span>
                      {c.unread > 0 && (
                        <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-[#0a0e12]">
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* thread */}
        <div className={`${active ? "" : "hidden lg:block"} lg:col-span-2`}>
          <div className="flex h-[34rem] flex-col rounded-2xl border border-primary/12 bg-surface">
            {!active ? (
              <div className="grid flex-1 place-items-center px-6 text-center text-muted">
                <div>
                  <svg viewBox="0 0 24 24" className="mx-auto h-10 w-10 opacity-30" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
                  </svg>
                  <p className="mt-3 text-sm">{tr({ en: "Select a conversation to open the chat.", ar: "اختر محادثة لفتح الشات." })}</p>
                </div>
              </div>
            ) : (
              <>
                {/* header */}
                <div className="flex items-center gap-3 border-b border-primary/10 p-4">
                  <button onClick={() => setActive(null)} className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-primary/10 hover:text-ink lg:hidden">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
                  </button>
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                    {(activeName || "?").trim().charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{activeName}</p>
                    <a href={`tel:${active}`} dir="ltr" className="text-xs text-muted transition hover:text-primary">+{active}</a>
                  </div>
                  <a
                    href={`https://wa.me/${active}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15l-1.3 4.7 4.8-1.3A10 10 0 1 0 12 2Z" /></svg>
                    WhatsApp
                  </a>
                </div>

                {/* messages */}
                <div ref={threadRef} className="custom-scroll flex-1 space-y-2 overflow-y-auto p-4">
                  {messages.length === 0 ? (
                    <p className="grid h-full place-items-center text-sm text-muted">{tr({ en: "No messages.", ar: "لا توجد رسائل." })}</p>
                  ) : (
                    messages.map((m) => {
                      const out = m.direction === "out";
                      const isReply = m.direction === "in" && m.kind === "reply";
                      const hl = highlightIds.has(m.id);
                      return (
                        <div key={m.id} id={`msg-${m.id}`} className={`flex ${out ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm ${
                              out
                                ? "bg-primary/15 text-ink rounded-ee-sm"
                                : isReply
                                ? "border border-primary/30 bg-primary/8 text-ink rounded-es-sm"
                                : "border border-primary/10 bg-background text-ink rounded-es-sm"
                            } ${hl ? "chat-highlight" : ""}`}
                          >
                            {m.kind === "followup" && (
                              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-primary">
                                {tr({ en: "Follow-up", ar: "متابعة" })}
                              </span>
                            )}
                            {isReply && (
                              <span className="mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-primary">
                                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 17H7A5 5 0 0 1 7 7h2M15 7h2a5 5 0 0 1 0 10h-2M8 12h8" /></svg>
                                {tr({ en: "Follow-up reply", ar: "رد المتابعة" })}
                              </span>
                            )}
                            {m.body}
                            <span className="mt-1 block text-end text-[10px] text-muted">{fmtTime(m.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* composer */}
                <div className="flex items-center gap-2 border-t border-primary/10 p-3">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    placeholder={tr({ en: "Type a reply…", ar: "اكتب رد…" })}
                    className="flex-1 rounded-xl border border-primary/15 bg-background px-3.5 py-2.5 text-sm text-ink outline-none focus:border-primary"
                  />
                  <button
                    onClick={send}
                    disabled={sending || !draft.trim()}
                    className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-r from-primary to-primary-dark text-[#0a0e12] transition hover:-translate-y-0.5 disabled:opacity-50"
                    aria-label={tr({ en: "Send", ar: "إرسال" })}
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4Z" /></svg>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
