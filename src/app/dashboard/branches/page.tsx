import type { Metadata } from "next";
import { BranchesManager } from "@/components/dashboard/BranchesManager";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Branches — ${site.shortName}`,
  description: "Manage the physical locations (branches) of your clinic.",
};

export default function BranchesPage() {
  return <BranchesManager />;
}
