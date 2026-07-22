import type { ClinicConfig } from "./types";
import { clinics } from "./registry.generated";

export type { ClinicConfig, ClinicTheme, ClinicTeamMember, Bi } from "./types";
export { clinics };

/** Fallback clinic when none is selected. */
export const DEFAULT_CLINIC = "badawi";

/**
 * The slug of the clinic this deployment serves. Set once per host via the env
 * var (always set NEXT_PUBLIC_CLINIC so the server and browser agree — CLINIC
 * alone would cause a hydration mismatch). Defaults to badawi.
 */
export function activeClinicSlug(): string {
  const slug = process.env.NEXT_PUBLIC_CLINIC || process.env.CLINIC || DEFAULT_CLINIC;
  return clinics[slug] ? slug : DEFAULT_CLINIC;
}

/** The active clinic's full config. */
export function activeClinic(): ClinicConfig {
  return clinics[activeClinicSlug()];
}
