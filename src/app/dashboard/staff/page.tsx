import type { Metadata } from "next";
import { StaffManager } from "@/components/dashboard/StaffManager";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Staff accounts — ${site.shortName}`,
  description: "Manage staff sign-in accounts, roles, and branch assignment.",
};

export default function StaffPage() {
  return <StaffManager />;
}
