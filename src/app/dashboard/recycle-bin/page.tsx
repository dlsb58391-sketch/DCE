import type { Metadata } from "next";
import { RecycleBin } from "@/components/dashboard/RecycleBin";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Recycle Bin — ${site.shortName}`,
  description: "Restore or permanently delete soft-deleted clinic records.",
};

export default function RecycleBinPage() {
  return <RecycleBin />;
}
