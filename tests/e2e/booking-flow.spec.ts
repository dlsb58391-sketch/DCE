import { test, expect } from "@playwright/test";

/**
 * Full automation flow (the core product promise), driven through the API the
 * same way the UI does:
 *   1. public booking      -> POST /api/bookings (status: pending)
 *   2. doctor signs in     -> POST /api/auth/login (session cookie)
 *   3. doctor confirms     -> PATCH /api/admin/appointments/<code> {confirm}
 *   4. public live tracker -> GET  /api/track/<code> reflects the lifecycle
 *
 * Uses a far-future slot so the natural stage is "reserved", then asserts the
 * tracker can also surface the live "queue" stage via the preview param.
 */
test("booking -> confirm -> tracker lifecycle", async ({ request }) => {
  // 1. patient books
  const when = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3h out
  const create = await request.post("/api/bookings", {
    data: {
      name: "اختبار آلي",
      phone: "+20 100 000 1122",
      serviceId: "implant",
      serviceLabelEn: "Dental Implant",
      serviceLabelAr: "زراعة أسنان",
      scheduledAt: when,
      lang: "ar",
    },
  });
  expect(create.ok()).toBeTruthy();
  const { code } = await create.json();
  expect(code).toBeTruthy();

  // 2. before confirmation, tracker shows "pending"
  let track = await request.get(`/api/track/${code}`);
  expect(track.ok()).toBeTruthy();
  expect((await track.json()).stage).toBe("pending");

  // 3. doctor signs in
  const login = await request.post("/api/auth/login", {
    data: { email: "doctor@bdic.clinic", password: "bdic12345" },
  });
  expect(login.ok()).toBeTruthy();

  // 4. doctor confirms (reuses the session cookie from the same request context)
  const confirm = await request.patch(`/api/admin/appointments/${code}`, {
    data: { action: "confirm" },
  });
  expect(confirm.ok()).toBeTruthy();

  // 5. tracker now reflects a confirmed lifecycle stage (3h out => "reserved")
  track = await request.get(`/api/track/${code}`);
  const reserved = await track.json();
  expect(["reserved", "reminder"]).toContain(reserved.stage);

  // 6. live "queue" stage is available (preview forces it; shows "patients ahead")
  const queue = await request.get(`/api/track/${code}?preview=queue`);
  const q = await queue.json();
  expect(q.stage).toBe("queue");
  expect(typeof q.ahead).toBe("number");
});

test("unauthenticated admin access is blocked", async ({ request }) => {
  const res = await request.get("/api/admin/appointments", {
    headers: { cookie: "" },
  });
  expect(res.status()).toBe(401);
});
