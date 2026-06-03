import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { get, post } from "@/lib/api";
import { toastPromise, toastError } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/currency";

// ================= TYPES =================

type PaymentMethod =
  | "cash"
  | "online"
  | "card"
  | "mixed-online"
  | "mixed-card"
  | "unpaid";

interface Order {
  id: number;
  total: number;
  payment_method: PaymentMethod;
  bill_number: string;
  created_at: string;

  is_paid: boolean;
  amount_paid: number;
  due_amount: number;

  customer_name?: string;
  customer_phone?: string;
  created_by_name?: string;
}

interface Denomination {
  note: number;
  qty: number;
}

interface CreateOrderPayload {
  items: any[];
  paymentMethod: PaymentMethod;
  businessDayId?: number;

  // 🔥 NEW
  cashBreakdown?: Denomination[];
  manualChangeBreakdown?: Denomination[];
  amountPaid?: number;

  customerName?: string;
  customerPhone?: string;
  discount?: number;
}

export interface DeletedOrder {
  id: number;
  bill_number: string;
  total: number;
  created_at: string;
}

export interface OrderItem {
  menu_item_id: number;
  item_name: string;
  quantity: number;
  price_snapshot: number;
}

export interface OrderDetails extends Order {
  items: OrderItem[];
}

// ================= HELPERS =================

const generateIdempotencyKey = () =>
  `order_${Date.now()}_${Math.random().toString(36).slice(2)}`;

// ================= GET ORDERS =================

export function useOrders(useBusinessDay: boolean, businessDayId?: number, date?: string) {
  return useQuery<Order[]>({
    queryKey: ["orders", useBusinessDay, businessDayId, date],

    enabled: useBusinessDay ? !!businessDayId : true,

    queryFn: () =>
      get<Order[]>("/orders", {
        params: useBusinessDay
          ? { businessDayId }
          : date
            ? { date }
            : {},
      }),

    staleTime: 0,
    refetchOnMount: "always",
  });
}

// ================= CREATE ORDER =================

export function useCreateOrder(useBusinessDay: boolean) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (order: CreateOrderPayload) => {
      const payload = {
        ...order,
        idempotencyKey: generateIdempotencyKey(),
        businessDayId: useBusinessDay ? order.businessDayId : undefined,
      };

      const promise = post("/orders", payload);

      return toastPromise(promise, {
        loading: "Placing order...",
        success: "Order placed",
        error: (err) => err?.message || "Order failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
      qc.invalidateQueries({ queryKey: ["unpaid-orders-active"] }); // 🔥
    },

    onError: () => {
      toastError("Unable to place order");
    },
  });
}

// ================= DELETE ORDER =================

export function useDeleteOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = post(`/orders/${id}/delete`, {
        idempotencyKey: generateIdempotencyKey(),
      });

      return toastPromise(promise, {
        loading: "Deleting order...",
        success: "Order deleted",
        error: (err) => err?.message || "Delete failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["deleted-orders"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },

    onError: () => {
      toastError("Unable to delete order");
    },
  });
}

// ================= UNDO DELETE =================

export function useUndoDeleteOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      const promise = post(`/orders/${id}/undo-delete`);

      return toastPromise(promise, {
        loading: "Restoring order...",
        success: "Order restored",
        error: (err) => err?.message || "Restore failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["deleted-orders"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["expected-cash"] });
    },

    onError: () => {
      toastError("Unable to restore order");
    },
  });
}

// ================= PAY UNPAID ORDER =================

export function usePayOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      paymentMethod,
      cashBreakdown,
      manualChangeBreakdown,
    }: {
      id: number;
      paymentMethod: PaymentMethod;
      cashBreakdown?: Denomination[];
      manualChangeBreakdown?: Denomination[];
    }) => {
      const promise = post(`/orders/${id}/pay`, {
        paymentMethod,
        cashBreakdown,
        manualChangeBreakdown,
        idempotencyKey: generateIdempotencyKey(),
      });

      return toastPromise(promise, {
        loading: "Processing payment...",
        success: "Payment successful",
        error: (err) => err?.message || "Payment failed",
      });
    },

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["unpaid-orders-active"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });
      qc.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

// ================= REFUND =================

interface RefundResponse {
  refundAmount: number;
  cashRefund?: number;
  bankRefund?: number;
  fallbackToBank?: boolean;
  mode?: string;
}

export function useRefundOrder() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      orderId: number;
      items: { menu_item_id: number; qty: number }[];
      denominations?: { note: number; qty: number }[];
    }): Promise<RefundResponse> => {
      return post<RefundResponse>(`/orders/${payload.orderId}/refund`, {
        items: payload.items,
        denominations: payload.denominations,
      });
    },

    onSuccess: (data: RefundResponse) => {
      const totalCash = data.cashRefund || 0;
      const totalBank = data.bankRefund || 0;

      // 🔥 SHOW PROPER MESSAGE
      toastPromise(Promise.resolve(), {
        loading: "Processing refund...",

        success: () => {
          let msg = `Refunded ${formatCurrency(data.refundAmount)}`;

          if (totalCash > 0) {
            msg += ` • Cash ${formatCurrency(totalCash)}`;
          }

          if (totalBank > 0) {
            msg += ` • EFTPOS ${formatCurrency(totalBank)}`;
          }

          if (data.fallbackToBank) {
            msg += " (cash not available → EFTPOS)";
          }

          return msg;
        },

        error: "Refund failed",
      });

      // 🔥 IMPORTANT INVALIDATIONS
      qc.invalidateQueries({ queryKey: ["orders"] });
      qc.invalidateQueries({ queryKey: ["unpaid-orders"] });

      qc.invalidateQueries({ queryKey: ["expected-cash"] });
      qc.invalidateQueries({ queryKey: ["current-cash"] });

      qc.invalidateQueries({ queryKey: ["bank-balance"] });
      qc.invalidateQueries({ queryKey: ["bank-history"] });
    },
  });
}
// ================= BILL LOOKUP =================

export function useOrderByBillNumber(billNumber?: string) {
  return useQuery<OrderDetails>({
    queryKey: ["order-bill", billNumber],
    enabled: !!billNumber,

    queryFn: () =>
      get(`/orders/bill/${billNumber}`),

    staleTime: 1000 * 10, // fast lookup, low cache
  });
}

// ================= ORDER DETAILS =================

export function useOrderDetails(id?: number) {
  return useQuery<OrderDetails>({
    queryKey: ["order-details", id],
    enabled: !!id,

    queryFn: () =>
      get(`/orders/${id}`),

    staleTime: 1000 * 10,
  });
}

export function useDeletedOrders() {
  return useQuery<DeletedOrder[]>({
    queryKey: ["deleted-orders"],
    queryFn: () => get<DeletedOrder[]>("/orders/deleted"),
    staleTime: 1000 * 10,
  });
}

