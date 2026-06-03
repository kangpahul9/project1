import { useState, useRef, useCallback } from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  useMenu,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDisableMenuItem,
  useUploadMenuImage,
} from "@/hooks/use-menu";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreateCategory,
  useDisableCategory,
  useMenuCategories,
  useUpdateCategory,
} from "@/hooks/use-menuCategories";
import {
  useCombos,
  useCreateCombo,
  useUpdateCombo,
  useDeleteCombo,
  calcComboSavings,
  type Combo,
  type ComboTier,
} from "@/hooks/use-combos";
import { useCreateOrder } from "@/hooks/use-orders";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { useAuthStore } from "@/hooks/use-auth";
import { MenuItem } from "@/hooks/use-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  Loader2,
  Wifi,
  Banknote,
  CreditCard,
  Tag,
  AlertCircle,
  CheckCircle2,
  Receipt,
  X,
  ChefHat,
  LayoutGrid,
  Car,
  Users,
} from "lucide-react";
import {
  getTableCart,
  saveTableCart,
  clearTableCart,
  sendToKitchen as sendTableToKitchen,
  clearTableKitchenTickets,
  removeItemFromKitchen,
  getTableCount,
  setTableCount,
  getPosMode,
  savePosMode,
  useStorageSync,
  type TableCartItem,
  type TableCart,
  type KotSnapshot,
} from "@/hooks/use-tables";
import { toastError, toastSuccess } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLocation } from "wouter";
import { useMarkOrderPaid, useOrderById } from "@/hooks/use-unpaid-orders";
import { useEffect } from "react";
import JsBarcode from "jsbarcode";
import { useEftpos } from "@/hooks/use-eftpos";
import { DenominationSelector } from "@/components/DenominationSelector";
import { useSettings } from "@/hooks/use-settings";
import { useCurrency, useDenominations } from "@/hooks/use-currency";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

interface CartItem extends MenuItem {
  quantity: number;
}

const selectCls =
  "w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition";

/* ── BARCODE DIALOG ── */
function BarcodeViewDialog({
  item,
  onClose,
}: {
  item: MenuItem | null;
  onClose: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (item?.barcode && svgRef.current) {
      JsBarcode(svgRef.current, item.barcode, {
        format: "CODE128",
        lineColor: "#000",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 14,
        margin: 10,
      });
    }
  }, [item]);

  const handleDownload = () => {
    if (!svgRef.current || !item) return;
    const svg = svgRef.current;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    const img = new Image();
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const link = document.createElement("a");
      link.download = `barcode-${item.name}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = url;
  };

  const handlePrint = () => {
    if (!svgRef.current || !item) return;
    const svgStr = new XMLSerializer().serializeToString(svgRef.current);
    const win = window.open("", "_blank");
    if (!win) return;
    const doc = win.document;
    doc.open();
    doc.write(
      '<!DOCTYPE html><html><head></head><body style="display:flex;flex-direction:column;align-items:center;padding:24px;font-family:sans-serif;"></body></html>'
    );
    doc.close();
    const title = doc.createElement("title");
    title.textContent = `Barcode - ${item.name}`;
    doc.head.appendChild(title);
    const h3 = doc.createElement("h3");
    h3.style.marginBottom = "12px";
    h3.textContent = item.name;
    doc.body.appendChild(h3);
    const svgNode = new DOMParser().parseFromString(svgStr, "image/svg+xml").documentElement;
    doc.body.appendChild(doc.adoptNode(svgNode));
    const script = doc.createElement("script");
    script.textContent = "window.onload=()=>{window.print();window.close();}";
    doc.body.appendChild(script);
  };

  return (
    <Dialog open={!!item} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{item?.name} — Barcode</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <svg ref={svgRef} />
          <p className="text-xs text-muted-foreground font-mono">{item?.barcode}</p>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={handleDownload}>
              Download PNG
            </Button>
            <Button className="flex-1" onClick={handlePrint}>
              Print
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================
   MAIN POS COMPONENT
================================================================ */
export default function Pos() {
  const [, navigate] = useLocation();
  const { data: settings } = useSettings();
  const { format } = useCurrency();
  const denoms = useDenominations();

  const searchParams = new URLSearchParams(window.location.search);
  const unpaidOrderId = searchParams.get("pay");
  const isUnpaidPayment = !!unpaidOrderId;

  const { data: unpaidOrder, isLoading: unpaidLoading } = useOrderById(
    unpaidOrderId ? Number(unpaidOrderId) : null
  );
  const [upiQr, setUpiQr] = useState<string | null>(null);

  const { data: menuItems, isLoading } = useMenu();
  const { data: categories } = useMenuCategories();
  const { data: currentDay } = useCurrentBusinessDay(settings?.use_business_day ?? false);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user } = useAuthStore();
  const { mutate: createOrder, isPending } = useCreateOrder(settings?.use_business_day ?? false);
  const { mutate: markPaid } = useMarkOrderPaid();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // ── DINE-IN STATE ────────────────────────────────────────────────
  const [posMode, setPosMode] = useState<"takeaway" | "dine-in">(getPosMode);
  const [activeTable, setActiveTable] = useState<number | null>(null);
  const [tableCount, setTableCountState] = useState(getTableCount);
  const [tableSnapshot, setTableSnapshot] = useState(0); // bump to refresh grid
  const [kotSnapshot, setKotSnapshot] = useState<KotSnapshot[]>([]);

  const activeTableRef = useRef<number | null>(null);
  const posModeRef = useRef<"takeaway" | "dine-in">(getPosMode());
  useEffect(() => { activeTableRef.current = activeTable; }, [activeTable]);
  useEffect(() => { posModeRef.current = posMode; }, [posMode]);
  useStorageSync(useCallback(() => {
    setTableSnapshot(t => t + 1);
    const tbl = activeTableRef.current;
    if (posModeRef.current === "dine-in" && tbl !== null) {
      const saved = getTableCart(tbl);
      setCart((saved?.items as CartItem[]) ?? []);
      setKotSnapshot(saved?.kotSnapshot ?? []);
    }
  }, []));
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [latestBill, setLatestBill] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | "all">("all");

  const { mutate: createMenuItem } = useCreateMenuItem();
  const { mutate: deleteMenuItem } = useDisableMenuItem();
  const { mutate: updateMenuItem } = useUpdateMenuItem();
  const uploadMenuImage = useUploadMenuImage();
  const queryClient = useQueryClient();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const { mutate: createCategory } = useCreateCategory();
  const { mutate: deleteCategory } = useDisableCategory();
  const { mutate: updateCategory } = useUpdateCategory();

  const { data: combos = [] } = useCombos();
  const { mutate: createCombo } = useCreateCombo();
  const { mutate: updateCombo } = useUpdateCombo();
  const { mutate: deleteCombo } = useDeleteCombo();

  const [comboDialogOpen, setComboDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<Combo | null>(null);
  const [comboName, setComboName] = useState("");
  const [comboItemId, setComboItemId] = useState<number | null>(null);
  const [comboTiers, setComboTiers] = useState<ComboTier[]>([{ quantity: 1, price: 0 }]);

  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  const [menuItemDialogOpen, setMenuItemDialogOpen] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState<any | null>(null);

  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState(0);
  const [formCategory, setFormCategory] = useState<number | null>(null);
  const [formColor, setFormColor] = useState("#6366f1");

  type UIPaymentMethod = "cash" | "upi" | "eftpos" | "unpaid";
  type BackendPaymentMethod = "cash" | "online" | "card" | "mixed-online" | "mixed-card" | "unpaid";

  const mapToBackendMethod = (method: UIPaymentMethod, isMixed: boolean): BackendPaymentMethod => {
    if (method === "cash") return "cash";
    if (method === "unpaid") return "unpaid";
    if (method === "upi") return isMixed ? "mixed-online" : "online";
    if (method === "eftpos") return isMixed ? "mixed-card" : "card";
    throw new Error("Invalid payment method");
  };

  const [customerName, setCustomerName] = useState("");
  const [discount, setDiscount] = useState(0);
  const [customerPhone, setCustomerPhone] = useState("");
  const [partialAmount, setPartialAmount] = useState(0);
  const [editingQty, setEditingQty] = useState<Record<number, string>>({});

  const [cashBreakdown, setCashBreakdown] = useState(denoms.map((d) => ({ note: d, qty: 0 })));
  const [isWeightBased, setIsWeightBased] = useState(false);
  const [formBarcode, setFormBarcode] = useState<string>("");
  const [barcodeViewItem, setBarcodeViewItem] = useState<MenuItem | null>(null);

  const [pendingChange, setPendingChange] = useState<any[]>([]);
  const [awaitingChangeConfirm, setAwaitingChangeConfirm] = useState(false);

  const eftpos = useEftpos();

  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printBillNumber, setPrintBillNumber] = useState<string | null>(null);
  const [menuAdminOpen, setMenuAdminOpen] = useState(false);
  const [paymentMode, setPaymentMode] = useState<UIPaymentMethod>("cash");

  /* ── CALCULATIONS ── */
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const { savings: comboSavings, applied: comboApplied } = calcComboSavings(cart, combos);

  useEffect(() => {
    if (isUnpaidPayment && unpaidOrder?.items) {
      setCart(
        unpaidOrder.items.map((item: any) => ({
          id: item.menu_item_id,
          name: item.item_name,
          price: Number(item.price_snapshot),
          quantity: Number(item.quantity),
          category_id: null,
        }))
      );
      setCustomerName(unpaidOrder.customer_name || "");
      setCustomerPhone(unpaidOrder.customer_phone || "");
    }
  }, [unpaidOrder, isUnpaidPayment]);

  useEffect(() => {
    const interval = setInterval(() => {
      const el = document.getElementById("mobile-sidebar");
      if (!el) return;
      const isVisible =
        el.classList.contains("opacity-100") && el.classList.contains("pointer-events-auto");
      setSidebarOpen(isVisible);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (customerPhone.length >= 8) {
      const lastCustomer = JSON.parse(localStorage.getItem("lastCustomer") || "null");
      if (lastCustomer?.phone === customerPhone) setCustomerName(lastCustomer.name);
    }
  }, [customerPhone]);

  const cartTotal = isUnpaidPayment
    ? Number(unpaidOrder?.due_amount) || 0
    : Math.max(0, subtotal - discount - comboSavings);

  const addToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) return prev.map((i) => (i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const adjustNote = (note: number, delta: number) => {
    setCashBreakdown((prev) =>
      prev.map((n) => (n.note === note ? { ...n, qty: Math.max(0, n.qty + delta) } : n))
    );
  };

  const totalReceived = cashBreakdown.reduce((sum, n) => sum + n.note * n.qty, 0);

  useEffect(() => {
    if (!paymentDialog) setUpiQr(null);
  }, [paymentDialog]);

  const remainingAmount = Math.max(0, cartTotal - totalReceived);

  const updateQuantity = (id: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item))
        .filter((item) => item.quantity > 0)
    );
  };

  useEffect(() => {
    if (paymentMode === "upi") {
      QRCode.toDataURL(generateUpiLink())
        .then(setUpiQr)
        .catch(() => setUpiQr(null));
    }
  }, [paymentMode, cartTotal, totalReceived, remainingAmount, settings]);

  useEffect(() => {
    let buffer = "";
    let lastKeyTime = 0;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const now = Date.now();
      if (now - lastKeyTime > 100) buffer = "";
      lastKeyTime = now;
      if (e.key === "Enter") {
        const scanned = buffer.trim();
        buffer = "";
        if (scanned.length < 4) return;
        const match = menuItems?.find((item: MenuItem) => item.barcode === scanned);
        if (match) {
          addToCart(match);
          toastSuccess(`Added: ${match.name}`);
        } else if (user?.role === "ADMIN") {
          setEditingMenuItem(null);
          setFormName("");
          setFormPrice(0);
          setFormCategory(null);
          setIsWeightBased(false);
          setFormBarcode(scanned);
          setMenuItemDialogOpen(true);
          toastSuccess(`Unknown barcode — add it as a new item`);
        } else {
          toastError(`No item found for barcode: ${scanned}`);
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuItems]);

  // ── Load cart when a table is selected ────────────────────────
  useEffect(() => {
    if (posMode !== "dine-in" || activeTable === null) return;
    const saved = getTableCart(activeTable);
    setCart((saved?.items as CartItem[]) ?? []);
    setCustomerName(saved?.customerName ?? "");
    setCustomerPhone(saved?.customerPhone ?? "");
    setDiscount(saved?.discount ?? 0);
    setKotSnapshot(saved?.kotSnapshot ?? []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTable]);

  // ── Auto-save cart to localStorage (dine-in mode) ─────────────
  useEffect(() => {
    if (posMode !== "dine-in" || activeTable === null) return;
    if (cart.length === 0 && !customerName && !customerPhone && discount === 0) {
      clearTableCart(activeTable);
      return;
    }
    const existing = getTableCart(activeTable);
    // Skip if unchanged — prevents the sync→save→sync loop when reloading from storage
    if (existing &&
        JSON.stringify(existing.items) === JSON.stringify(cart) &&
        existing.customerName === customerName &&
        existing.customerPhone === customerPhone &&
        existing.discount === discount) {
      return;
    }
    saveTableCart(activeTable, {
      items: cart as TableCartItem[],
      customerName,
      customerPhone,
      discount,
      sentToKitchen: cart.length > 0 ? (existing?.sentToKitchen ?? false) : false,
      sentAt: cart.length > 0 ? existing?.sentAt : undefined,
      kotSnapshot: cart.length > 0 ? existing?.kotSnapshot : [],
    });
  }, [cart, customerName, customerPhone, discount, posMode, activeTable]);

  const removeFromCart = (id: number) => {
    if (posMode === "dine-in" && activeTable !== null) {
      const item = cart.find(i => i.id === id);
      const wasInKitchen = kotSnapshot.some(s => s.id === id && s.quantity > 0);
      if (item && wasInKitchen) {
        removeItemFromKitchen(activeTable, id, item.name);
        setKotSnapshot(prev => prev.filter(s => s.id !== id));
      }
    }
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const generateUpiLink = () => {
    return settings?.payid || "";
  };

  const completeOrder = (method: "cash" | "upi" | "eftpos" | "unpaid") => {
    if (!user) return;
    if (!isUnpaidPayment && !currentDay) return;

    if (isUnpaidPayment && unpaidOrder) {
      let payAmount = 0;
      if (method === "cash") {
        payAmount = totalReceived;
        if (payAmount <= 0) { toastError("Enter cash received"); return; }
      }
      if (method === "upi" || method === "eftpos") payAmount = unpaidOrder.due_amount;

      markPaid(
        {
          id: unpaidOrder.id,
          amountPaid: method === "cash" ? payAmount : undefined,
          paymentMethod: mapToBackendMethod(method, totalReceived > 0),
          cashBreakdown: method === "cash" || totalReceived > 0 ? cashBreakdown : undefined,
        },
        {
          onSuccess: (data: any) => {
            setLatestBill(data.bill_number);
            if (method === "cash" && data.changeBreakdown?.length > 0) {
              setPendingChange(data.changeBreakdown);
              setAwaitingChangeConfirm(true);
              return;
            }
            finalizeSale(data.bill_number);
          },
          onError: (err: any) => toastError(err?.message || "Payment Failed"),
        }
      );
      return;
    }

    if (method === "cash") {
      if (totalReceived < cartTotal) { toastError("Insufficient cash: payment is less than total."); return; }
    }
    if (method === "unpaid") {
      if (!customerName || !customerPhone) { toastError("Customer name and phone required for credit orders."); return; }
      if (totalReceived > cartTotal) { toastError("Partial amount cannot exceed total."); return; }
      if (totalReceived === cartTotal && cartTotal > 0) { toastError("Full payment should use Cash/UPI/Card."); return; }
    }

    createOrder(
      {
        businessDayId: currentDay?.id,
        customerName,
        customerPhone,
        paymentMethod:
          totalReceived > 0 && method === "eftpos"
            ? "mixed-card"
            : totalReceived > 0 && method === "upi"
            ? "mixed-online"
            : method === "upi"
            ? "online"
            : method === "eftpos"
            ? "card"
            : method,
        cashBreakdown: totalReceived > 0 ? cashBreakdown : undefined,
        discount,
        amountPaid: method === "unpaid" ? totalReceived : undefined,
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: Number(item.quantity),
          price: item.price,
          name: item.name,
        })),
      },
      {
        onSuccess: (data: any) => {
          setLatestBill(data.bill_number);
          if (method === "cash" && data.changeBreakdown?.length > 0) {
            setPendingChange(data.changeBreakdown);
            setAwaitingChangeConfirm(true);
            return;
          }
          finalizeSale(data.bill_number);
        },
        onError: (err: any) => toastError(err?.message || "Payment Failed"),
      }
    );
  };

  const handleCheckout = (method: any) => {
    setCheckoutOpen(false);
    setPaymentMode(method);
    setPaymentDialog(true);
  };

  const finalizeSale = (billNumber?: string) => {
    if (isUnpaidPayment) navigate("/pos");
    if (customerPhone && customerName) {
      localStorage.setItem("lastCustomer", JSON.stringify({ phone: customerPhone, name: customerName }));
    }
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setPartialAmount(0);
    setDiscount(0);
    setCheckoutOpen(false);
    setPaymentDialog(false);
    setPendingChange([]);
    setAwaitingChangeConfirm(false);
    setCashBreakdown(denoms.map((d) => ({ note: d, qty: 0 })));
    // Clear table state on successful sale (dine-in mode)
    if (posMode === "dine-in" && activeTable !== null) {
      clearTableCart(activeTable);
      clearTableKitchenTickets(activeTable);
      setActiveTable(null);
      setTableSnapshot(s => s + 1);
    }
    if (billNumber) {
      setPrintBillNumber(billNumber);
      setPrintDialogOpen(true);
    }
    toastSuccess(billNumber ? `Payment Successful • Bill: ${billNumber}` : "Payment Successful");
  };

  /* ── LOADING STATES ── */
  if (isUnpaidPayment && unpaidLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin w-8 h-8 text-primary" />
      </div>
    );
  }

  if (settings?.use_business_day && !currentDay && !isUnpaidPayment) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-0 lg:ml-60 flex items-center justify-center p-8">
          <div className="bg-card rounded-2xl border shadow-sm p-12 text-center max-w-sm w-full">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-amber-600 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-foreground">Business Closed</h2>
            <p className="text-muted-foreground text-sm mt-2">Open a new business day first.</p>
          </div>
        </main>
      </div>
    );
  }

  /* ================================================================
     MAIN RENDER
  ================================================================ */
  return (
    <div className="flex flex-col lg:flex-row bg-background h-screen overflow-hidden">
      <Sidebar />

      {/* ── LEFT: MENU BROWSER ── */}
      <main
        className={cn(
          "flex-1 lg:ml-60 flex flex-col min-w-0 overflow-hidden",
          "pb-[58vh] lg:pb-0"
        )}
      >
        {/* ── Mode toggle + Search bar ── */}
        <div className="px-4 pt-16 lg:px-5 lg:pt-5 bg-background border-b">
          {/* Takeaway / Dine-In toggle */}
          <div className="flex items-center gap-2 pb-3">
            {([
              { mode: "takeaway" as const, label: "Takeaway", icon: Car },
              { mode: "dine-in"  as const, label: "Dine In",  icon: LayoutGrid },
            ]).map(({ mode, label, icon: Icon }) => (
              <button
                key={mode}
                onClick={() => {
                  setPosMode(mode);
                  savePosMode(mode);
                  setActiveTable(null);
                  setCart([]);
                  setDiscount(0);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all",
                  posMode === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}

            {/* Active table indicator */}
            {posMode === "dine-in" && activeTable !== null && (
              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm font-bold text-primary">Table {activeTable}</span>
                <button
                  onClick={() => { setActiveTable(null); setCart([]); setDiscount(0); setTableSnapshot(s => s + 1); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Search input — hidden when showing table grid */}
          {!(posMode === "dine-in" && activeTable === null) && (
            <div className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search menu…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 rounded-xl border-border bg-muted/40 focus:bg-background"
                />
              </div>
            </div>
          )}
        </div>

        {/* ── TABLE GRID (dine-in, no table selected) ── */}
        {posMode === "dine-in" && activeTable === null ? (
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-5 space-y-5" key={tableSnapshot}>
              {/* Table count adjuster — admin only */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span>{tableCount} tables</span>
                </div>
                {user?.role === "ADMIN" && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => { const n = Math.max(1, tableCount - 1); setTableCountState(n); setTableCount(n); }}
                      className="w-7 h-7 rounded-lg border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition text-lg"
                    >−</button>
                    <button
                      onClick={() => { const n = tableCount + 1; setTableCountState(n); setTableCount(n); }}
                      className="w-7 h-7 rounded-lg border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition text-lg"
                    >+</button>
                  </div>
                )}
              </div>

              {/* Table buttons grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {Array.from({ length: tableCount }, (_, i) => i + 1).map((n) => {
                  const tCart = getTableCart(n);
                  const hasItems = (tCart?.items.length ?? 0) > 0;
                  const sentToKitchen = hasItems && (tCart?.sentToKitchen ?? false);

                  return (
                    <button
                      key={n}
                      onClick={() => setActiveTable(n)}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all hover:shadow-md active:scale-95",
                        sentToKitchen
                          ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 hover:border-amber-400"
                          : hasItems
                          ? "border-primary/40 bg-primary/5 hover:border-primary/60"
                          : "border-border/60 bg-card hover:border-primary/20"
                      )}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base",
                            sentToKitchen
                              ? "bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200"
                              : hasItems
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {n}
                        </div>
                        {sentToKitchen && (
                          <ChefHat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        )}
                      </div>
                      <p className="text-sm font-semibold text-foreground">Table {n}</p>
                      {hasItems ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {tCart!.items.reduce((s, i) => s + i.quantity, 0)} items
                          {sentToKitchen ? " · In kitchen" : " · Active"}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">Available</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </ScrollArea>
        ) : (
          <>
            {/* Category pills */}
            <div className="flex gap-2 overflow-x-auto px-4 lg:px-5 py-3 border-b bg-background scrollbar-hide">
              <button
                onClick={() => setSelectedCategory("all")}
                className={cn(
                  "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                  selectedCategory === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                All
              </button>
              {categories?.map((cat: any) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                  style={{
                    background: selectedCategory === cat.id ? cat.color : "hsl(var(--muted))",
                    color: selectedCategory === cat.id ? "white" : "hsl(var(--muted-foreground))",
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Menu grid */}
            <ScrollArea className="flex-1 overflow-y-auto">
              <div
                className="
                  grid p-4 lg:p-5
                  grid-cols-2
                  sm:grid-cols-3
                  md:grid-cols-4
                  lg:grid-cols-4
                  xl:grid-cols-5
                  2xl:grid-cols-6
                  gap-3 pb-10
                "
              >
                {isLoading ? (
                  <div className="col-span-full flex justify-center py-16">
                    <Loader2 className="animate-spin w-7 h-7 text-primary" />
                  </div>
                ) : (
                  menuItems
                    ?.filter((item: any) => {
                      const searchMatch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
                      const categoryMatch = selectedCategory === "all" || item.category_id === selectedCategory;
                      return searchMatch && categoryMatch;
                    })
                    .sort((a: any, b: any) => (b.usage_count || 0) - (a.usage_count || 0))
                    .map((item: any) => (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className="rounded-2xl overflow-hidden shadow-sm hover:shadow-md active:scale-95 transition-all bg-card border border-border/50 hover:border-primary/30 text-left group"
                      >
                        {item.image_url ? (
                          <img
                            src={`${import.meta.env.VITE_API_URL.replace(/\/api$/, "")}${item.image_url}`}
                            alt={item.name}
                            className="h-24 w-full object-cover"
                          />
                        ) : (
                          <div
                            className="h-24 w-full"
                            style={{
                              background: `linear-gradient(135deg, ${
                                categories?.find((c: any) => c.id === item.category_id)?.color || "#e5e7eb"
                              }, ${
                                (categories?.find((c: any) => c.id === item.category_id)?.color || "#e5e7eb") + "cc"
                              })`,
                            }}
                          />
                        )}
                        <div className="p-2.5">
                          <p className="font-medium text-foreground text-xs leading-tight line-clamp-2">{item.name}</p>
                          <p className="text-primary font-bold text-sm mt-1">{format(item.price)}</p>
                        </div>
                      </button>
                    ))
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </main>

      {/* ── RIGHT / BOTTOM: CART ── */}
      <aside
        className={cn(
          "flex flex-col bg-card border-t lg:border-t-0 lg:border-l",
          "fixed bottom-0 left-0 right-0 z-40 h-[58vh]",
          sidebarOpen ? "hidden" : "flex",
          "lg:static lg:h-full lg:w-[360px] xl:w-[400px]"
        )}
      >
        {/* Unpaid order banner */}
        {isUnpaidPayment && unpaidOrder && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-2.5 text-amber-800 dark:text-amber-300 text-sm font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Settling Unpaid Order #{unpaidOrder.id}
          </div>
        )}

        {/* Cart header */}
        <div className="px-5 py-4 border-b flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <ShoppingCart className="w-5 h-5 text-foreground" />
            <h2 className="font-bold text-lg text-foreground">
              {posMode === "dine-in" && activeTable !== null
                ? `Table ${activeTable}`
                : "Current Order"}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {posMode === "dine-in" && activeTable !== null && (
              <span className="bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                <LayoutGrid className="w-3 h-3" />
                Dine In
              </span>
            )}
            <span className="bg-primary/10 text-primary text-xs font-semibold px-2.5 py-1 rounded-full">
              {cart.length} {cart.length === 1 ? "item" : "items"}
            </span>
          </div>
        </div>

        {/* Cart items */}
        <ScrollArea className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-10 text-muted-foreground">
              <ShoppingCart className="w-10 h-10 opacity-20 mb-2" />
              <p className="text-sm">No items added yet</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 rounded-xl border bg-background"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm leading-tight truncate">{item.name}</p>
                    <p className="text-primary font-bold text-sm mt-0.5">{format(item.price)}</p>
                  </div>

                  {/* Quantity controls */}
                  <div className="flex items-center gap-1.5 bg-muted rounded-lg px-2 py-1">
                    <button
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-background transition text-foreground font-bold text-base"
                    >
                      −
                    </button>
                    <input
                      type="text"
                      value={editingQty[item.id] !== undefined ? editingQty[item.id] : String(item.quantity)}
                      onFocus={() => setEditingQty((prev) => ({ ...prev, [item.id]: String(item.quantity) }))}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (!/^\d*\.?\d*$/.test(value)) return;
                        setEditingQty((prev) => ({ ...prev, [item.id]: value }));
                      }}
                      onBlur={() => {
                        const value = editingQty[item.id];
                        if (value === undefined) return;
                        const num = Number(value);
                        setCart((prev) =>
                          prev.map((i) =>
                            i.id === item.id
                              ? {
                                  ...i,
                                  quantity: item.is_weight_based
                                    ? Math.max(0.01, num || 0)
                                    : Math.max(1, Math.floor(num || 0)),
                                }
                              : i
                          )
                        );
                        setEditingQty((prev) => {
                          const copy = { ...prev };
                          delete copy[item.id];
                          return copy;
                        });
                      }}
                      className="w-10 text-center font-semibold bg-transparent outline-none tabular-nums text-sm"
                    />
                    <button
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-background transition text-foreground font-bold text-base"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="text-muted-foreground hover:text-red-500 transition p-1"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Discount + summary + checkout */}
        <div className="border-t bg-card px-4 pt-3 pb-4 space-y-3">
          {/* Discount row */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Tag className="w-3.5 h-3.5" />
                Discount
              </div>
              <Input
                type="number"
                min={0}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-24 h-8 text-sm text-right"
              />
            </div>
            <div className="flex gap-1.5">
              {[5, 10, 20].map((pct) => (
                <button
                  key={pct}
                  onClick={() => setDiscount((prev) => Math.round((prev + (subtotal * pct) / 100) * 100) / 100)}
                  className="flex-1 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 active:scale-95 text-primary text-xs font-semibold py-1.5 transition-all"
                >
                  +{pct}%
                </button>
              ))}
              {discount > 0 && (
                <button
                  onClick={() => setDiscount(0)}
                  className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95 text-red-500 dark:text-red-400 text-xs font-semibold px-2.5 py-1.5 transition-all"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Customer fields — required for takeaway */}
          {posMode === "takeaway" && !isUnpaidPayment && (
            <div className="space-y-1.5 pb-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                Customer
                <span className="text-red-500">*</span>
              </p>
              <Input
                placeholder="Phone number *"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className={cn("h-8 text-sm", !customerPhone.trim() && cart.length > 0 && "border-red-300 dark:border-red-700")}
              />
              <Input
                placeholder="Name *"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className={cn("h-8 text-sm", !customerName.trim() && cart.length > 0 && "border-red-300 dark:border-red-700")}
              />
            </div>
          )}

          {/* Totals */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{format(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-red-500">
                <span>Discount</span>
                <span>− {format(discount)}</span>
              </div>
            )}
            {comboApplied.map((c) => (
              <div key={c.name} className="flex justify-between text-emerald-600">
                <span>🎁 {c.name}</span>
                <span>− {format(c.saving)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-base border-t pt-2 text-foreground">
              <span>Total</span>
              <span>{format(cartTotal)}</span>
            </div>
          </div>

          {/* Send to Kitchen — dine-in mode only */}
          {posMode === "dine-in" && activeTable !== null && (() => {
            const newQty = cart.reduce((sum, i) => {
              const prev = kotSnapshot.find(s => s.id === i.id);
              return sum + Math.max(0, i.quantity - (prev?.quantity ?? 0));
            }, 0);
            return cart.length > 0 ? (
              <Button
                variant="outline"
                disabled={newQty === 0}
                className="w-full h-10 text-sm font-semibold gap-2 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30 disabled:opacity-40"
                onClick={() => {
                  const sent = sendTableToKitchen(
                    activeTable,
                    cart.map(i => ({ id: i.id, name: i.name, quantity: i.quantity }))
                  );
                  if (sent) {
                    setKotSnapshot(cart.map(i => ({ id: i.id, quantity: i.quantity })));
                    setTableSnapshot(s => s + 1);
                    toastSuccess(`Order sent to kitchen — Table ${activeTable}`);
                  }
                }}
              >
                <ChefHat className="w-4 h-4" />
                {newQty > 0 ? `Send to Kitchen (${newQty} new)` : "Nothing new to send"}
              </Button>
            ) : null;
          })()}

          <Button
            className="w-full h-11 text-base font-semibold"
            disabled={cart.length === 0}
            onClick={() => {
              if (posMode === "takeaway" && !isUnpaidPayment) {
                if (!customerPhone.trim()) { toastError("Phone number is required for takeaway orders"); return; }
                if (!customerName.trim()) { toastError("Customer name is required for takeaway orders"); return; }
              }
              setCheckoutOpen(true);
            }}
          >
            {posMode === "dine-in" && activeTable !== null ? `Bill Table ${activeTable}` : "Checkout"}
          </Button>
        </div>
      </aside>

      {/* ================================================================
          DIALOGS
      ================================================================ */}

      {/* PAYMENT METHOD SELECT */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="w-[95vw] max-w-sm">
          <DialogHeader>
            <DialogTitle>Choose Payment Method</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            {[
              { method: "cash", label: "Cash", icon: Banknote, color: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100" },
              { method: "upi", label: settings?.currency_code === "AUD" ? "PayID" : "UPI / QR", icon: Wifi, color: "bg-primary/5 border-primary/20 text-primary hover:bg-primary/10" },
              { method: "eftpos", label: "Card / EFTPOS", icon: CreditCard, color: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100" },
              ...(!isUnpaidPayment
                ? [{ method: "unpaid", label: "Credit", icon: Receipt, color: "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100" }]
                : []),
            ].map(({ method, label, icon: Icon, color }) => (
              <button
                key={method}
                onClick={() => handleCheckout(method)}
                className={cn(
                  "flex flex-col items-center gap-2.5 p-5 rounded-2xl border font-medium text-sm transition-all active:scale-95",
                  color
                )}
              >
                <Icon className="w-6 h-6" />
                {label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* PAYMENT DIALOG */}
      <Dialog
        open={paymentDialog}
        onOpenChange={(open) => {
          if (!open) eftpos.reset();
          setPaymentDialog(open);
        }}
      >
        <DialogContent className="w-[95vw] max-w-lg">
          <DialogHeader>
            {/* Customer info */}
            <div className="mb-4 space-y-2 pb-4 border-b">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Customer</p>
              <Input
                placeholder="Phone number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <Input
                placeholder="Name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              {paymentMode === "unpaid" && (
                <p className="text-xs text-red-500">Both fields required for credit orders</p>
              )}
            </div>
            <DialogTitle className="text-base">
              {paymentMode === "cash" && "Cash Payment"}
              {paymentMode === "upi" &&
                (settings?.currency_code === "AUD" ? "Scan & Pay (PayID)" : "Scan & Pay (UPI)")}
              {paymentMode === "eftpos" && "EFTPOS Terminal"}
              {paymentMode === "unpaid" && "Credit / Unpaid Order"}
            </DialogTitle>
          </DialogHeader>

          {/* CASH */}
          {paymentMode === "cash" &&
            (awaitingChangeConfirm ? (
              <div className="space-y-5 text-center">
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-2xl p-6">
                  <p className="font-bold text-lg text-amber-700 dark:text-amber-300 mb-4">Return Change</p>
                  <div className="space-y-2">
                    {pendingChange.map((c: any) => (
                      <p key={c.note} className="text-base font-semibold text-foreground">
                        {format(c.note)} × {c.qty}
                      </p>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={() => finalizeSale(latestBill || undefined)}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Change Given
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="bg-muted/40 rounded-2xl p-4 grid grid-cols-2 gap-3 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Order Total</p>
                    <p className="text-xl font-bold text-foreground">{format(cartTotal)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Received</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{format(totalReceived)}</p>
                  </div>
                  {totalReceived > cartTotal && (
                    <div className="col-span-2 pt-2 border-t border-border/40">
                      <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold">
                        Change: {format(totalReceived - cartTotal)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="max-h-[35vh] overflow-y-auto">
                  <DenominationSelector breakdown={cashBreakdown} setBreakdown={setCashBreakdown} title="Cash Received" />
                </div>
                {remainingAmount === 0 ? (
                  <Button className="w-full" disabled={totalReceived === 0} onClick={() => completeOrder("cash")}>
                    Confirm Payment
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-center text-sm text-amber-600 font-semibold">
                      Remaining: {format(remainingAmount)}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button variant="outline" onClick={() => setPaymentMode("eftpos")}>
                        Pay Rest by Card
                      </Button>
                      <Button variant="outline" onClick={() => setPaymentMode("upi")}>
                        Pay Rest by UPI
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}

          {/* UPI / PayID */}
          {paymentMode === "upi" && (
            <div className="space-y-5 text-center">
              <div className="bg-muted/40 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Amount Due</p>
                <p className="text-2xl font-bold text-foreground">
                  {format(totalReceived > 0 ? remainingAmount : cartTotal)}
                </p>
              </div>
              {upiQr && (
                <div className="flex justify-center">
                  <img
                    src={upiQr}
                    alt={settings?.currency_code === "AUD" ? "PayID QR" : "UPI QR"}
                    className="w-52 h-52 border rounded-2xl shadow-sm"
                  />
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Ask customer to scan and complete payment.
                <br />
                Confirm after verifying bank screenshot.
              </p>
              <Button className="w-full" onClick={() => completeOrder("upi")}>
                Confirm Payment
              </Button>
            </div>
          )}

          {/* EFTPOS */}
          {paymentMode === "eftpos" && (
            <div className="space-y-5 text-center">
              <div className="bg-muted/40 rounded-2xl p-4">
                <p className="text-xs text-muted-foreground mb-1">Amount to Charge</p>
                <p className="text-2xl font-bold text-foreground">
                  {format(totalReceived > 0 ? remainingAmount : cartTotal)}
                </p>
              </div>

              {eftpos.status === "idle" && (
                <Button
                  className="w-full"
                  onClick={async () => {
                    const cents = Math.round((totalReceived > 0 ? remainingAmount : cartTotal) * 100);
                    const ok = await eftpos.charge(cents);
                    if (ok) completeOrder("eftpos");
                  }}
                >
                  Send to Terminal
                </Button>
              )}
              {eftpos.status === "pending" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-center gap-2 text-primary">
                    <Loader2 className="animate-spin w-5 h-5" />
                    <span className="font-medium">Waiting for customer…</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ask the customer to tap, insert, or swipe their card on the terminal.
                  </p>
                  <Button variant="outline" size="sm" className="text-red-500" onClick={() => eftpos.reset()}>
                    Cancel
                  </Button>
                </div>
              )}
              {eftpos.status === "approved" && (
                <div className="flex items-center justify-center gap-2 text-emerald-600 font-semibold">
                  <CheckCircle2 className="w-5 h-5" /> Payment approved
                </div>
              )}
              {(eftpos.status === "declined" || eftpos.status === "cancelled" || eftpos.status === "error") && (
                <div className="space-y-3">
                  <p className="text-red-600 font-semibold">{eftpos.error || "Payment failed"}</p>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={() => eftpos.reset()}>
                      Try Again
                    </Button>
                    <Button className="flex-1" onClick={() => completeOrder("eftpos")}>
                      Mark Paid Manually
                    </Button>
                  </div>
                </div>
              )}
              {!settings?.eftpos_provider && eftpos.status === "idle" && (
                <p className="text-xs text-muted-foreground">No terminal configured — using manual confirmation.</p>
              )}
            </div>
          )}

          {/* UNPAID / CREDIT */}
          {paymentMode === "unpaid" && (
            <div className="space-y-5">
              <div className="bg-muted/40 rounded-2xl p-4 grid grid-cols-2 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Order Total</p>
                  <p className="text-xl font-bold text-foreground">{format(cartTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Cash Received</p>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{format(totalReceived)}</p>
                </div>
                <div className="col-span-2 pt-2 border-t border-border/40">
                  <p className="text-sm text-amber-600 dark:text-amber-400 font-semibold">
                    Due: {format(Math.max(0, cartTotal - totalReceived))}
                  </p>
                </div>
              </div>
              <div className="max-h-[35vh] overflow-y-auto">
                <DenominationSelector breakdown={cashBreakdown} setBreakdown={setCashBreakdown} title="Cash Received" />
              </div>
              <Button
                className="w-full"
                disabled={totalReceived < 0 || totalReceived >= cartTotal}
                onClick={() => completeOrder("unpaid")}
              >
                Save Credit Order
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* PRINT BILL */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Print Bill?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Do you want to print bill #{printBillNumber}?
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setPrintDialogOpen(false)}>
                Skip
              </Button>
              <Button
                className="flex-1"
                onClick={() => {
                  window.open(`/print/${printBillNumber}`, "_blank");
                  setPrintDialogOpen(false);
                }}
              >
                Print
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* BARCODE VIEW */}
      <BarcodeViewDialog item={barcodeViewItem} onClose={() => setBarcodeViewItem(null)} />

      {/* CATEGORY DIALOG */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Category Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Colour</label>
              <input
                type="color"
                value={formColor}
                onChange={(e) => setFormColor(e.target.value)}
                className="w-full h-10 rounded-lg border cursor-pointer"
              />
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (editingCategory) {
                  updateCategory({
                    id: editingCategory.id,
                    name: formName,
                    color: formColor,
                    sort_order: editingCategory.sort_order || 0,
                    is_active: true,
                  });
                } else {
                  createCategory({ name: formName, color: formColor, sort_order: 0 });
                }
                setCategoryDialogOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MENU ITEM DIALOG */}
      <Dialog open={menuItemDialogOpen} onOpenChange={setMenuItemDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingMenuItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Item Name"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />
            <Input
              type="number"
              placeholder="Price"
              value={formPrice}
              onChange={(e) => setFormPrice(Number(e.target.value))}
            />
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Category</label>
              <select
                className={selectCls}
                value={formCategory || ""}
                onChange={(e) => setFormCategory(Number(e.target.value))}
              >
                <option value="">Select Category</option>
                {categories?.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {editingMenuItem && (
              <div className="space-y-2">
                {editingMenuItem.image_url && (
                  <img
                    src={`${import.meta.env.VITE_API_URL.replace(/\/api$/, "")}${editingMenuItem.image_url}`}
                    alt="Current"
                    className="h-24 w-full object-cover rounded-lg"
                  />
                )}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    try {
                      const res = await uploadMenuImage(editingMenuItem.id, file);
                      setEditingMenuItem((prev: any) => ({ ...prev, image_url: res.image_url }));
                      queryClient.invalidateQueries({ queryKey: ["menu"] });
                    } catch {
                      toastError("Image upload failed");
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => imageInputRef.current?.click()}
                >
                  {editingMenuItem.image_url ? "Change Image" : "Upload Image"}
                </Button>
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <input
                type="checkbox"
                id="weight-based"
                checked={isWeightBased}
                onChange={(e) => setIsWeightBased(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="weight-based" className="text-sm text-foreground cursor-pointer">
                Weight-based item (kg / decimal)
              </label>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground block">Barcode</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Scan or enter barcode"
                  value={formBarcode}
                  onChange={(e) => setFormBarcode(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFormBarcode(String(Date.now()).slice(-10))}
                >
                  Generate
                </Button>
              </div>
              {formBarcode && (
                <button
                  type="button"
                  onClick={() =>
                    setBarcodeViewItem({
                      id: 0,
                      name: formName || "Item",
                      price: 0,
                      category_id: null,
                      barcode: formBarcode,
                    })
                  }
                  className="text-xs text-primary hover:underline"
                >
                  Preview barcode →
                </button>
              )}
            </div>

            <Button
              className="w-full"
              onClick={() => {
                if (editingMenuItem) {
                  updateMenuItem({
                    id: editingMenuItem.id,
                    name: formName,
                    price: formPrice,
                    category_id: formCategory ?? undefined,
                    is_active: true,
                    is_weight_based: isWeightBased,
                    barcode: formBarcode || null,
                  });
                } else {
                  createMenuItem({
                    name: formName,
                    price: formPrice,
                    category_id: formCategory ?? undefined,
                    is_weight_based: isWeightBased,
                    barcode: formBarcode || null,
                  });
                }
                setMenuItemDialogOpen(false);
              }}
            >
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
