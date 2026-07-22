import type { Item, ItemDetail, Movement, PurchaseHistory, PurchaseOrder, ReorderReport, Report, Supplier } from "./types";

/** Error carrying the server's machine `code` + human message for the toast. */
export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, status: number, code: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

/** JSON fetch that throws {@link ApiError} on a non-2xx, surfacing `message`. */
async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = (body.message as string) || (body.error as string) || "Request failed";
    throw new ApiError(message, res.status, (body.error as string) || "error");
  }
  return body as T;
}

const qs = (params: Record<string, string | boolean | undefined>): string => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "" || v === false) continue;
    sp.set(k, v === true ? "1" : v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const api = {
  report: (days?: number) => req<Report>(`/api/admin/inventory/report${qs({ days: days ? String(days) : undefined })}`),

  reorder: () => req<ReorderReport>(`/api/admin/inventory/reorder`),
  itemPurchaseHistory: (id: string, limit?: number) =>
    req<PurchaseHistory>(`/api/admin/inventory/items/${id}/purchase-history${qs({ limit: limit ? String(limit) : undefined })}`),

  listItems: (opts: { search?: string; inactive?: boolean; low?: boolean } = {}) =>
    req<{ items: Item[] }>(`/api/admin/inventory/items${qs(opts)}`),
  itemDetail: (id: string) => req<ItemDetail>(`/api/admin/inventory/items/${id}`),
  createItem: (data: Record<string, unknown>) =>
    req<{ item: Item }>(`/api/admin/inventory/items`, { method: "POST", body: JSON.stringify(data) }),
  updateItem: (id: string, data: Record<string, unknown>) =>
    req<{ item: Item }>(`/api/admin/inventory/items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteItem: (id: string) => req<{ ok: true }>(`/api/admin/inventory/items/${id}`, { method: "DELETE" }),
  receive: (id: string, data: Record<string, unknown>) =>
    req<{ batch: unknown }>(`/api/admin/inventory/items/${id}/receive`, { method: "POST", body: JSON.stringify(data) }),
  adjust: (id: string, data: Record<string, unknown>) =>
    req<{ movements?: Movement[]; movement?: Movement }>(`/api/admin/inventory/items/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  listSuppliers: () => req<{ suppliers: Supplier[] }>(`/api/admin/inventory/suppliers`),
  createSupplier: (data: Record<string, unknown>) =>
    req<{ supplier: Supplier }>(`/api/admin/inventory/suppliers`, { method: "POST", body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: Record<string, unknown>) =>
    req<{ supplier: Supplier }>(`/api/admin/inventory/suppliers/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => req<{ ok: true }>(`/api/admin/inventory/suppliers/${id}`, { method: "DELETE" }),

  listMovements: (opts: { itemId?: string; type?: string; limit?: number } = {}) =>
    req<{ movements: Movement[] }>(
      `/api/admin/inventory/movements${qs({ itemId: opts.itemId, type: opts.type, limit: opts.limit ? String(opts.limit) : "100" })}`,
    ),

  listPurchaseOrders: (opts: { status?: string; supplierId?: string; search?: string } = {}) =>
    req<{ purchaseOrders: PurchaseOrder[] }>(`/api/admin/inventory/purchase-orders${qs(opts)}`),
  purchaseOrder: (id: string) =>
    req<{ purchaseOrder: PurchaseOrder }>(`/api/admin/inventory/purchase-orders/${id}`),
  createPurchaseOrder: (data: Record<string, unknown>) =>
    req<{ purchaseOrder: PurchaseOrder }>(`/api/admin/inventory/purchase-orders`, { method: "POST", body: JSON.stringify(data) }),
  updatePurchaseOrder: (id: string, data: Record<string, unknown>) =>
    req<{ purchaseOrder: PurchaseOrder }>(`/api/admin/inventory/purchase-orders/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deletePurchaseOrder: (id: string) =>
    req<{ ok: true }>(`/api/admin/inventory/purchase-orders/${id}`, { method: "DELETE" }),
  submitPurchaseOrder: (id: string) =>
    req<{ purchaseOrder: PurchaseOrder }>(`/api/admin/inventory/purchase-orders/${id}/submit`, { method: "POST", body: "{}" }),
  cancelPurchaseOrder: (id: string) =>
    req<{ purchaseOrder: PurchaseOrder }>(`/api/admin/inventory/purchase-orders/${id}/cancel`, { method: "POST", body: "{}" }),
  receivePurchaseOrder: (id: string, data: Record<string, unknown>) =>
    req<{ purchaseOrder: PurchaseOrder }>(`/api/admin/inventory/purchase-orders/${id}/receive`, { method: "POST", body: JSON.stringify(data) }),
};
