/**
 * In-memory store for the WhatsApp Web worker's live status.
 *
 * The worker (worker/whatsapp-web.mjs) POSTs its state here as it changes
 * (qr → authenticated → ready, or disconnected). The dashboard polls it to show
 * the QR to scan and the connection status. State is ephemeral on purpose — if
 * the server restarts, the worker re-posts within ~20s.
 */
export type WaWorkerState = "qr" | "authenticated" | "ready" | "disconnected" | "offline";

type Status = { state: WaWorkerState; qr?: string; at: number };

let current: Status = { state: "offline", at: 0 };

export function setWorkerStatus(state: WaWorkerState, qr?: string) {
  current = { state, qr, at: Date.now() };
}

export function getWorkerStatus(): Status & { fresh: boolean } {
  // If we haven't heard from the worker in 60s, treat it as offline.
  const fresh = current.at > 0 && Date.now() - current.at < 60_000;
  const state = fresh ? current.state : "offline";
  return { ...current, state, fresh };
}
