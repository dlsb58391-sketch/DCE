/** Shared types for the inventory dashboard (mirror the JSON API contract). */

export type Item = {
  id: string;
  nameEn: string;
  nameAr: string;
  sku: string | null;
  barcode: string | null;
  category: string | null;
  unit: string;
  reorderLevel: number;
  reorderQty: number | null;
  notes: string | null;
  active: boolean;
  onHand: number;
  valuation: number;
  lowStock: boolean;
};

export type Batch = {
  id: string;
  itemId: string;
  supplierId: string | null;
  lotNumber: string | null;
  expiryDate: string | null;
  unitCost: number;
  receivedQty: number;
  remainingQty: number;
  receivedAt: string;
  notes: string | null;
};

export type MovementType = "receipt" | "consumption" | "wastage" | "adjustment" | "transfer" | "return";

export type Movement = {
  id: string;
  itemId: string;
  batchId: string | null;
  type: MovementType;
  quantityDelta: number;
  unitCost: number | null;
  totalCost: number | null;
  reason: string | null;
  referenceType: string | null;
  actorName: string | null;
  createdAt: string;
  item?: { nameEn: string; nameAr: string; unit: string };
};

export type ItemDetail = { item: Item; batches: Batch[]; movements: Movement[] };

export type SupplierRef = { id: string; nameEn: string; nameAr: string } | null;

export type ReorderRow = {
  id: string;
  nameEn: string;
  nameAr: string;
  unit: string;
  onHand: number;
  onOrder: number;
  reorderLevel: number;
  reorderQty: number | null;
  suggestedQty: number;
  lastUnitCost: number | null;
  lastPurchaseAt: string | null;
  lastSupplier: SupplierRef;
};

export type ReorderReport = { count: number; items: ReorderRow[] };

export type PurchaseHistoryRow = {
  batchId: string;
  lotNumber: string | null;
  unitCost: number;
  receivedQty: number;
  receivedAt: string;
  supplier: SupplierRef;
};

export type PurchaseHistory = {
  item: { id: string; nameEn: string; nameAr: string; unit: string };
  purchaseHistory: PurchaseHistoryRow[];
};

export type Supplier = {
  id: string;
  nameEn: string;
  nameAr: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxId: string | null;
  paymentTerms: string | null;
  notes: string | null;
  active: boolean;
};

export type ReportBatchRow = {
  batchId: string;
  itemId: string;
  name: string;
  unit: string;
  lotNumber: string | null;
  expiryDate: string | null;
  remainingQty: number;
};

export type Report = {
  totalItems: number;
  totalValuation: number;
  lowStockCount: number;
  expiringCount: number;
  expiredCount: number;
  lowStock: Array<{ id: string; nameEn: string; nameAr: string; unit: string; onHand: number; reorderLevel: number }>;
  expiring: ReportBatchRow[];
  expired: ReportBatchRow[];
};

export type PoStatus = "draft" | "submitted" | "partially_received" | "received" | "cancelled";

export type PoLine = {
  id: string;
  purchaseOrderId: string;
  itemId: string | null;
  descriptionEn: string | null;
  descriptionAr: string | null;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PurchaseOrder = {
  id: string;
  code: string;
  supplierId: string | null;
  supplierName: string | null;
  branchId: string | null;
  status: PoStatus;
  currency: string;
  notes: string | null;
  expectedAt: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PoLine[];
  lineCount: number;
  receivedLineCount: number;
  orderedValue: number;
  receivedValue: number;
  remainingValue: number;
};
