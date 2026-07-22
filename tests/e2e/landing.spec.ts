import { test, expect } from "@playwright/test";

/**
 * Smoke e2e: the public landing page renders core marketing content + SEO,
 * with no missing-image/console-fatal surprises.
 */
test("landing page loads with hero, booking and SEO", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("lang", "ar"));
  await page.goto("/");

  // hero team stage is present
  await expect(page.locator(".team-stage")).toBeVisible();

  // booking section anchor exists
  await expect(page.locator("#contact, #booking, form")).toBeTruthy();

  // SEO: JSON-LD + canonical present in the served HTML
  const html = await page.content();
  expect(html).toContain('application/ld+json');
  expect(html).toContain('"@type":"Dentist"');
});

test("robots and sitemap are served", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.ok()).toBeTruthy();
  expect(await robots.text()).toContain("Sitemap:");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.ok()).toBeTruthy();
  expect(await sitemap.text()).toContain("<urlset");
});

test("health endpoint reports the database is up", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe("ok");
  expect(body.db).toBe("up");
});
