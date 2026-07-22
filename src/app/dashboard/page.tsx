import type { Metadata } from "next";
import { DoctorDashboard } from "@/components/dashboard/DoctorDashboard";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Doctor Dashboard — ${site.shortName}`,
  description: "Manage appointments, review booking requests and view the daily schedule.",
};

export default function DashboardPage() {
  return <DoctorDashboard />;
}
