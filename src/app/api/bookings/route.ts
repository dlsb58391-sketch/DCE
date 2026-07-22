import { NextResponse } from "next/server";
import { createBooking } from "@/lib/server/appointments";
import { normalizePhone } from "@/lib/server/phone";
import { withRoute } from "@/lib/server/http";

/** Public endpoint: create a booking request from the landing-page form. */
export const POST = withRoute("bookings.POST", bookingsPOST);

async function bookingsPOST(req: Request) {
  let data: Record<string, unknown>;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const name = String(data.name ?? "").trim();
  const phone = String(data.phone ?? "").trim();
  const serviceId = String(data.serviceId ?? "").trim();
  const scheduledAtRaw = data.scheduledAt as string | undefined;

  if (!name || !phone || !serviceId || !scheduledAtRaw) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const when = new Date(scheduledAtRaw);
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "bad_date" }, { status: 400 });
  }

  const norm = normalizePhone(phone);

  const appt = await createBooking({
    name,
    phone: norm.e164 || phone,
    serviceId,
    serviceLabelEn: String(data.serviceLabelEn ?? serviceId),
    serviceLabelAr: String(data.serviceLabelAr ?? serviceId),
    scheduledAt: when,
    durationMin: Number(data.durationMin) || 30,
    complaint: data.complaint ? String(data.complaint) : null,
    offerTitle: data.offerTitle ? String(data.offerTitle) : null,
    lang: data.lang === "ar" ? "ar" : "en",
  });

  return NextResponse.json({ ok: true, code: appt.code, id: appt.id });
}
