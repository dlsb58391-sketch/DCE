/** Phone-number normalization for WhatsApp / wa.me. Egypt-first but generic. */

export type NormalizedPhone = {
  digits: string; // e.g. "201222156274" (no +) — used by wa.me
  e164: string; // e.g. "+201222156274"
  display: string; // a tidy display form
  valid: boolean;
};

/**
 * Turn any messy local/international phone string into a WhatsApp-ready number.
 * - "+20 122 215 6274" -> 201222156274
 * - "01222156274"      -> 201222156274  (leading 0 dropped, CC added)
 * - "0020122..."       -> 20122...      (00 international prefix dropped)
 */
export function normalizePhone(raw: string, defaultCc = process.env.WHATSAPP_DEFAULT_CC || "20"): NormalizedPhone {
  let d = (raw || "").replace(/\D/g, "");

  if (d.startsWith("00")) d = d.slice(2);

  if (d.startsWith(defaultCc)) {
    // already has the country code
  } else if (d.startsWith("0")) {
    d = defaultCc + d.slice(1); // local number with trunk 0
  } else if (d.length > 0 && d.length <= 10) {
    d = defaultCc + d; // bare local number
  }

  const valid = d.length >= 10 && d.length <= 15;
  return {
    digits: d,
    e164: d ? `+${d}` : "",
    display: d ? `+${d}` : raw,
    valid,
  };
}
