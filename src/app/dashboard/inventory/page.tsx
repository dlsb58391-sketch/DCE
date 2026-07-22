import type { Metadata } from "next";
import { Inventory } from "@/components/dashboard/inventory/Inventory";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: `Inventory — ${site.shortName}`,
  description: "Track stock, batches, expiry and supplier receipts.",
};

export default function InventoryPage() {
  return <Inventory />;
}
