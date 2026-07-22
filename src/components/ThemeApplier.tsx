"use client";

import { useSite } from "@/lib/siteStore";

/**
 * Applies the doctor's editable theme colors to the landing page by overriding
 * the global CSS variables. Rendered only on the public site, so the dashboard
 * (which re-scopes its own palette via .dash-light) is unaffected.
 */
export function ThemeApplier() {
  const { settings, ready } = useSite();
  if (!ready) return null;
  const c = settings.theme;
  const css = `:root{--background:${c.background};--surface:${c.surface};--surface-2:${c.surface2};--primary:${c.primary};--primary-dark:${c.primaryDark};--accent:${c.accent};--border:${c.primary}2e;--on-primary:${c.onPrimary ?? "#0a0e12"};}`;
  return <style id="site-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
