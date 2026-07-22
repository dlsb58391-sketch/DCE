import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Exercises the REAL WhatsApp booking agent through the local simulator
 * (no Meta credentials needed). New flow: greet → pick day → pick slot →
 * reason → pending booking + "waiting for confirmation".
 */
const phone = "+201000000777";

async function say(request: APIRequestContext, text: string) {
  const res = await request.post("/api/whatsapp/simulate", { data: { phone, text } });
  expect(res.ok()).toBeTruthy();
  return res.json();
}

test("full WhatsApp booking conversation (day → slot → reason)", async ({ request }) => {
  // any greeting → day menu
  let r = await say(request, "مرحبا");
  expect(r.replies.join("\n")).toMatch(/اختر اليوم|أهلاً/);

  // pick the 2nd open day (tomorrow-ish: reliably has free slots)
  r = await say(request, "2");
  const afterDay = r.replies.join("\n");
  expect(afterDay).toMatch(/المواعيد المتاحة|مفيش مواعيد/);

  if (/مفيش مواعيد/.test(afterDay)) {
    r = await say(request, "3"); // try another day
  }
  expect(r.replies.join("\n")).toMatch(/المواعيد المتاحة/);

  // pick the 1st available time → asks reason
  r = await say(request, "1");
  expect(r.replies.join("\n")).toMatch(/سبب الزيارة/);

  // give a reason → asks who the appointment is for
  r = await say(request, "ألم في الضرس");
  expect(r.replies.join("\n")).toMatch(/باسم مين|اسم المريض/);

  // give the patient name → pending booking + waiting for confirmation
  r = await say(request, "أحمد علي");
  expect(r.replies.join("\n")).toMatch(/في انتظار تأكيد الطبيب/);
  expect(r.replies.join("\n")).toContain("أحمد علي");
  expect(r.bookingCode).toBeTruthy();

  // the booking is real and visible on the public tracker as pending
  const track = await request.get(`/api/track/${r.bookingCode}`);
  expect(track.ok()).toBeTruthy();
  expect((await track.json()).stage).toBe("pending");
});

test("cancel resets the flow", async ({ request }) => {
  const p2 = "+201000000888";
  const say2 = async (text: string) =>
    (await request.post("/api/whatsapp/simulate", { data: { phone: p2, text } })).json();

  await say2("حجز"); // → day menu
  await say2("2"); // → slots
  const r = await say2("إلغاء");
  expect(r.replies.join("\n")).toMatch(/تم الإلغاء|cancel/i);
});

test("website 'confirm on WhatsApp' message is acknowledged (free-trick)", async ({ request }) => {
  const p3 = "+201000000999";
  const res = await request.post("/api/whatsapp/simulate", {
    data: { phone: p3, text: "مرحبًا، أريد تأكيد حجزي في مركز بدوي لزراعة الأسنان\nكود الحجز: ABC234" },
  });
  const r = await res.json();
  expect(r.replies.join("\n")).toMatch(/وصلنا|الطبيب|تأكيد/);
  expect(r.replies.join("\n")).not.toMatch(/اختر اليوم/);
});
