import { useState, useRef, useEffect } from "react";
import { Sidebar } from "@/components/Sidebar";
import {
  useMenu,
  useCreateMenuItem,
  useUpdateMenuItem,
  useDisableMenuItem,
  useUploadMenuImage,
  useDeleteMenuImage,
  type MenuItem,
} from "@/hooks/use-menu";
import {
  useMenuCategories,
  useCreateCategory,
  useUpdateCategory,
  useDisableCategory,
} from "@/hooks/use-menuCategories";
import {
  useCombos,
  useCreateCombo,
  useUpdateCombo,
  useDeleteCombo,
  type Combo,
  type ComboTier,
} from "@/hooks/use-combos";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrency } from "@/hooks/use-currency";
import { toastError } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search, Plus, Pencil, Trash2, Tag, Layers,
  Gift, BarChart3, Camera, X, ImageOff, UtensilsCrossed,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { cn } from "@/lib/utils";

const selectCls =
  "w-full border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition";

// ─── Barcode dialog ───────────────────────────────────────────────────────────
function BarcodeDialog({ item, onClose }: { item: MenuItem | null; onClose: () => void }) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (item?.barcode && svgRef.current) {
      JsBarcode(svgRef.current, item.barcode, {
        format: "CODE128", lineColor: "#000", width: 2, height: 72,
        displayValue: true, fontSize: 13, margin: 10,
      });
    }
  }, [item]);

  const download = () => {
    if (!svgRef.current || !item) return;
    const svg = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.width; c.height = img.height;
      c.getContext("2d")!.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      const a = document.createElement("a");
      a.download = `barcode-${item.name}.png`;
      a.href = c.toDataURL("image/png");
      a.click();
    };
    img.src = url;
  };

  const print = () => {
    if (!svgRef.current || !item) return;
    const svgStr = new XMLSerializer().serializeToString(svgRef.current);
    const w = window.open("", "_blank");
    if (!w) return;
    const doc = w.document;
    doc.open();
    doc.write('<!DOCTYPE html><html><head></head><body style="display:flex;flex-direction:column;align-items:center;padding:24px;font-family:sans-serif"></body></html>');
    doc.close();
    const title = doc.createElement("title");
    title.textContent = item.name;
    doc.head.appendChild(title);
    const h3 = doc.createElement("h3");
    h3.textContent = item.name;
    doc.body.appendChild(h3);
    const svgNode = new DOMParser().parseFromString(svgStr, "image/svg+xml").documentElement;
    doc.body.appendChild(doc.adoptNode(svgNode));
    const script = doc.createElement("script");
    script.textContent = "window.onload=()=>{window.print();window.close();}";
    doc.body.appendChild(script);
  };

  return (
    <Dialog open={!!item} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>{item?.name} — Barcode</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <svg ref={svgRef} />
          <p className="text-xs text-muted-foreground font-mono">{item?.barcode}</p>
          <div className="flex gap-3 w-full">
            <Button variant="outline" className="flex-1" onClick={download}>Download PNG</Button>
            <Button className="flex-1" onClick={print}>Print</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Tab = "items" | "categories" | "combos";

export default function ManageMenu() {
  const { format } = useCurrency();
  const qc = useQueryClient();

  const { data: menuItems = [] } = useMenu();
  const { data: categories = [] } = useMenuCategories();
  const { data: combos = [] } = useCombos();

  const { mutate: createMenuItem } = useCreateMenuItem();
  const { mutate: updateMenuItem } = useUpdateMenuItem();
  const { mutate: deleteMenuItem } = useDisableMenuItem();
  const uploadMenuImage = useUploadMenuImage();
  const { mutate: deleteMenuImage } = useDeleteMenuImage();

  const { mutate: createCategory } = useCreateCategory();
  const { mutate: updateCategory } = useUpdateCategory();
  const { mutate: deleteCategory } = useDisableCategory();

  const { mutate: createCombo } = useCreateCombo();
  const { mutate: updateCombo } = useUpdateCombo();
  const { mutate: deleteCombo } = useDeleteCombo();

  const [tab, setTab] = useState<Tab>("items");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<number | "all">("all");

  // ── Item form ──────────────────────────────────────────────────────────────
  const [itemOpen, setItemOpen] = useState(false);
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [fName, setFName] = useState("");
  const [fPrice, setFPrice] = useState(0);
  const [fCat, setFCat] = useState<number | null>(null);
  const [fWeight, setFWeight] = useState(false);
  const [fBarcode, setFBarcode] = useState("");
  const [barcodeView, setBarcodeView] = useState<MenuItem | null>(null);
  const imageRef = useRef<HTMLInputElement>(null);

  // ── Delete confirmation ────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "item" | "category" | "combo";
    id: number;
    name: string;
  } | null>(null);

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "item") deleteMenuItem(deleteConfirm.id);
    else if (deleteConfirm.type === "category") deleteCategory(deleteConfirm.id);
    else deleteCombo(deleteConfirm.id);
    setDeleteConfirm(null);
  };

  const openAddItem = (barcode = "") => {
    setEditItem(null); setFName(""); setFPrice(0);
    setFCat(null); setFWeight(false); setFBarcode(barcode);
    setItemOpen(true);
  };
  const openEditItem = (item: MenuItem) => {
    setEditItem(item); setFName(item.name); setFPrice(item.price);
    setFCat(item.category_id ?? null); setFWeight(item.is_weight_based ?? false);
    setFBarcode(item.barcode ?? ""); setItemOpen(true);
  };
  const saveItem = () => {
    if (!fName.trim() || fPrice <= 0) { toastError("Name and price required"); return; }
    const payload = {
      name: fName, price: fPrice,
      category_id: fCat ?? undefined,
      is_weight_based: fWeight,
      barcode: fBarcode || null,
    };
    if (editItem) updateMenuItem({ id: editItem.id, ...payload, is_active: true });
    else createMenuItem(payload);
    setItemOpen(false);
  };

  // ── Category form ──────────────────────────────────────────────────────────
  const [catOpen, setCatOpen] = useState(false);
  const [editCat, setEditCat] = useState<any>(null);
  const [cName, setCName] = useState("");
  const [cColor, setCColor] = useState("#6366f1");

  const openAddCat = () => { setEditCat(null); setCName(""); setCColor("#6366f1"); setCatOpen(true); };
  const openEditCat = (c: any) => { setEditCat(c); setCName(c.name); setCColor(c.color); setCatOpen(true); };
  const saveCat = () => {
    if (!cName.trim()) { toastError("Name required"); return; }
    if (editCat) updateCategory({ id: editCat.id, name: cName, color: cColor, sort_order: editCat.sort_order ?? 0, is_active: true });
    else createCategory({ name: cName, color: cColor, sort_order: 0 });
    setCatOpen(false);
  };

  // ── Combo form ─────────────────────────────────────────────────────────────
  const [comboOpen, setComboOpen] = useState(false);
  const [editCombo, setEditCombo] = useState<Combo | null>(null);
  const [coName, setCoName] = useState("");
  const [coType, setCoType] = useState<"volume" | "bundle">("volume");
  const [coBundlePrice, setCoBundlePrice] = useState(0);
  const [coUseTiers, setCoUseTiers] = useState(false);
  const [coItems, setCoItems] = useState<{ menu_item_id: number; quantity: number }[]>([{ menu_item_id: 0, quantity: 1 }]);
  const [coTiers, setCoTiers] = useState<ComboTier[]>([{ quantity: 1, price: 0 }]);

  const openAddCombo = () => {
    setEditCombo(null); setCoName(""); setCoType("volume"); setCoBundlePrice(0);
    setCoUseTiers(false);
    setCoItems([{ menu_item_id: 0, quantity: 1 }]);
    setCoTiers([{ quantity: 1, price: 0 }]);
    setComboOpen(true);
  };
  const openEditCombo = (c: Combo) => {
    setEditCombo(c); setCoName(c.name); setCoType(c.combo_type);
    setCoBundlePrice(c.bundle_price ?? 0);
    const hasTiers = c.tiers.length > 0;
    setCoUseTiers(c.combo_type === "volume" || hasTiers);
    setCoItems(c.items.map(i => ({ menu_item_id: i.menu_item_id, quantity: i.quantity })));
    setCoTiers(hasTiers ? c.tiers.map(t => ({ quantity: t.quantity, price: t.price })) : [{ quantity: 1, price: 0 }]);
    setComboOpen(true);
  };
  const saveCombo = () => {
    if (!coName.trim()) { toastError("Combo name required"); return; }
    if (coItems.some(i => !i.menu_item_id)) { toastError("Select all items"); return; }
    const useTiers = coType === "volume" || coUseTiers;
    if (useTiers && coTiers.some(t => !t.quantity || !t.price)) { toastError("Fill all tier values"); return; }
    if (!useTiers && coBundlePrice <= 0) { toastError("Bundle price required"); return; }

    const payload = {
      name: coName,
      combo_type: coType,
      bundle_price: !useTiers ? coBundlePrice : null,
      items: coItems,
      tiers: useTiers ? coTiers : [],
    };

    if (editCombo) updateCombo({ id: editCombo.id, ...payload });
    else createCombo(payload);
    setComboOpen(false);
  };

  const TABS = [
    { key: "items" as Tab,      label: "Menu Items",   icon: Layers, count: (menuItems as MenuItem[]).length },
    { key: "categories" as Tab, label: "Categories",   icon: Tag,    count: (categories as any[]).length },
    { key: "combos" as Tab,     label: "Combo Offers", icon: Gift,   count: combos.length },
  ];

  const filteredItems = (menuItems as MenuItem[]).filter(item => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || item.category_id === filterCat;
    return matchSearch && matchCat;
  });

  const imgBase = import.meta.env.VITE_API_URL?.replace(/\/api$/, "") ?? "";
  const resolveImg = (url: string) => url.startsWith("http") ? url : `${imgBase}${url}`;

  return (
    <div className="flex bg-background min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-0 lg:ml-60 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
      <div className="w-full">

        {/* ── Page header ── */}
        <div className="flex items-start justify-between mb-6 gap-3">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
              <UtensilsCrossed className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
              <span className="truncate">Menu Management</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {(menuItems as MenuItem[]).length} items · {(categories as any[]).length} categories · {combos.length} combos
            </p>
          </div>

          {tab === "items" && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={() => openAddItem()}>
              <Plus size={14} /> <span className="hidden sm:inline">Add Item</span><span className="sm:hidden">Add</span>
            </Button>
          )}
          {tab === "categories" && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={openAddCat}>
              <Plus size={14} /> <span className="hidden sm:inline">Add Category</span><span className="sm:hidden">Add</span>
            </Button>
          )}
          {tab === "combos" && (
            <Button size="sm" className="gap-1.5 shrink-0" onClick={openAddCombo}>
              <Plus size={14} /> <span className="hidden sm:inline">Add Combo</span><span className="sm:hidden">Add</span>
            </Button>
          )}
        </div>

        {/* ── Tabs ── */}
        <div className="overflow-x-auto mb-6">
          <div className="flex gap-1 bg-muted/50 border rounded-xl p-1 w-max">
            {TABS.map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                  tab === key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <Icon size={14} />
                {label}
                <span className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full font-semibold",
                  tab === key ? "bg-white/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════ MENU ITEMS ══════════════ */}
        {tab === "items" && (
          <div className="space-y-4">
            {/* Search + filter */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search items…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setFilterCat("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0",
                    filterCat === "all"
                      ? "bg-primary text-primary-foreground"
                      : "bg-card border text-foreground hover:bg-muted/50"
                  )}
                >
                  All
                </button>
                {(categories as any[]).map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setFilterCat(cat.id)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all shrink-0"
                    style={{
                      background: filterCat === cat.id ? cat.color : "hsl(var(--card))",
                      color: filterCat === cat.id ? "#fff" : "hsl(var(--foreground))",
                      border: `1px solid ${cat.color}`,
                    }}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Mobile list view (< sm) ── */}
            <div className="flex flex-col gap-2 sm:hidden">
              {filteredItems.map((item) => {
                const catColor = (categories as any[]).find(c => c.id === item.category_id)?.color;
                const imgSrc = item.image_url ? resolveImg(item.image_url) : null;
                return (
                  <div
                    key={item.id}
                    className="bg-card rounded-2xl border border-border/60 shadow-sm p-3 flex items-center gap-3"
                  >
                    {/* Thumbnail */}
                    <div
                      className="w-16 h-16 rounded-xl overflow-hidden shrink-0 bg-muted flex items-center justify-center cursor-pointer"
                      style={!imgSrc && catColor ? { background: `${catColor}22` } : undefined}
                      onClick={() => openEditItem(item)}
                    >
                      {imgSrc ? (
                        <img
                          src={imgSrc}
                          alt={item.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center"
                          style={{ background: catColor || "#e5e7eb" }}
                        >
                          <Camera size={14} className="text-white opacity-70" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1 mb-0.5">
                        <p className="font-semibold text-sm leading-tight line-clamp-1 text-foreground">{item.name}</p>
                        <p className="text-sm font-bold text-primary shrink-0 ml-1">{format(item.price)}</p>
                      </div>
                      {item.category_name && (
                        <p className="text-xs text-muted-foreground truncate">{item.category_name}</p>
                      )}
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {item.is_weight_based && (
                          <span className="text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">kg</span>
                        )}
                        {(item.usage_count ?? 0) > 0 && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <BarChart3 size={10} />{item.usage_count}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <button
                        className="text-xs border rounded-lg px-3 py-1.5 hover:bg-muted/50 transition flex items-center gap-1 text-foreground"
                        onClick={() => openEditItem(item)}
                      >
                        <Pencil size={12} /> Edit
                      </button>
                      <button
                        className="text-xs border border-red-200 dark:border-red-900 text-red-500 rounded-lg px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 transition flex items-center justify-center"
                        onClick={() => setDeleteConfirm({ type: "item", id: item.id, name: item.name })}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="text-center py-16 text-muted-foreground">
                  <Layers size={36} className="mx-auto mb-3 opacity-25" />
                  <p className="text-sm">No items found</p>
                </div>
              )}
            </div>

            {/* ── Desktop grid view (sm+) ── */}
            <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
              {filteredItems.map((item) => {
                const catColor = (categories as any[]).find(c => c.id === item.category_id)?.color;
                const imgSrc = item.image_url ? resolveImg(item.image_url) : null;
                return (
                  <div
                    key={item.id}
                    className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden hover:shadow-md hover:border-primary/20 transition-all group"
                  >
                    {/* Image / placeholder area */}
                    <div className="relative aspect-square bg-muted">
                      {imgSrc ? (
                        <>
                          <img
                            src={imgSrc}
                            alt={item.name}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                            <button
                              className="bg-card/90 backdrop-blur-sm rounded-full p-2 hover:bg-card transition"
                              onClick={() => { openEditItem(item); setTimeout(() => imageRef.current?.click(), 100); }}
                              title="Change photo"
                            >
                              <Camera size={15} className="text-foreground" />
                            </button>
                            <button
                              className="bg-card/90 backdrop-blur-sm rounded-full p-2 hover:bg-red-50 transition"
                              onClick={() => deleteMenuImage(item.id)}
                              title="Remove photo"
                            >
                              <ImageOff size={15} className="text-red-500" />
                            </button>
                          </div>
                        </>
                      ) : (
                        <div
                          className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer hover:opacity-80 transition"
                          style={{ background: catColor ? `${catColor}22` : "hsl(var(--muted))" }}
                          onClick={() => openEditItem(item)}
                        >
                          <div
                            className="w-9 h-9 rounded-full flex items-center justify-center"
                            style={{ background: catColor || "#e5e7eb" }}
                          >
                            <Camera size={16} className="text-white opacity-70" />
                          </div>
                          <span className="text-xs text-muted-foreground">Add photo</span>
                        </div>
                      )}
                    </div>

                    <div className="p-3">
                      <div className="flex items-start justify-between gap-1 mb-1">
                        <p className="font-semibold text-foreground text-sm leading-tight line-clamp-2">{item.name}</p>
                        <p className="text-sm font-bold text-primary shrink-0 ml-1">{format(item.price)}</p>
                      </div>

                      {item.category_name && (
                        <p className="text-xs text-muted-foreground mb-2 truncate">{item.category_name}</p>
                      )}

                      <div className="flex flex-wrap gap-1 mb-2.5">
                        {item.is_weight_based && (
                          <span className="text-xs bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-full">
                            kg
                          </span>
                        )}
                        {item.barcode && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-mono truncate max-w-[80px]">
                            {item.barcode}
                          </span>
                        )}
                        {(item.usage_count ?? 0) > 0 && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            <BarChart3 size={10} />{item.usage_count}
                          </span>
                        )}
                      </div>

                      <div className="flex gap-1.5">
                        {item.barcode && (
                          <button
                            className="text-xs text-primary border border-primary/20 rounded-lg px-2 py-1 hover:bg-primary/5 transition"
                            onClick={() => setBarcodeView(item)}
                          >
                            Barcode
                          </button>
                        )}
                        <button
                          className="flex-1 text-xs border rounded-lg px-2 py-1 hover:bg-muted/50 transition flex items-center justify-center gap-1 text-foreground"
                          onClick={() => openEditItem(item)}
                        >
                          <Pencil size={11} /> Edit
                        </button>
                        <button
                          className="text-xs border border-red-200 dark:border-red-900 text-red-500 rounded-lg px-2 py-1 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                          onClick={() => setDeleteConfirm({ type: "item", id: item.id, name: item.name })}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="col-span-full text-center py-20 text-muted-foreground">
                  <Layers size={36} className="mx-auto mb-3 opacity-25" />
                  <p className="text-sm">No items found</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════ CATEGORIES ══════════════ */}
        {tab === "categories" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(categories as any[]).map((cat) => {
              const count = (menuItems as MenuItem[]).filter(i => i.category_id === cat.id).length;
              return (
                <div
                  key={cat.id}
                  className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-primary/20 transition-all"
                >
                  <div
                    className="w-12 h-12 rounded-xl shrink-0"
                    style={{ background: cat.color }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">{cat.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {count} {count === 1 ? "item" : "items"}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => openEditCat(cat)}>
                      <Pencil size={14} />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => setDeleteConfirm({ type: "category", id: cat.id, name: cat.name })}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
              );
            })}
            {(categories as any[]).length === 0 && (
              <div className="col-span-full text-center py-20 text-muted-foreground">
                <Tag size={36} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm">No categories yet</p>
              </div>
            )}
          </div>
        )}

        {/* ══════════════ COMBOS ══════════════ */}
        {tab === "combos" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {combos.map((combo) => (
              <div
                key={combo.id}
                className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 hover:shadow-md hover:border-primary/20 transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-foreground">{combo.name}</p>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full font-medium",
                        combo.combo_type === "bundle"
                          ? "bg-primary/10 text-primary"
                          : "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                      )}>
                        {combo.combo_type === "bundle" ? "Bundle" : "Volume"}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {combo.items.map(i => i.menu_item_name).join(" + ")}
                    </p>
                  </div>
                  <Gift size={18} className="text-primary shrink-0 mt-0.5" />
                </div>

                {combo.combo_type === "volume" ? (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {combo.tiers.map((t, i) => (
                      <div
                        key={i}
                        className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-3 py-1.5 text-center"
                      >
                        <p className="text-xs text-muted-foreground">Buy {t.quantity}</p>
                        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{format(t.price)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5 mb-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      {combo.items.map(i => `${i.quantity}× ${i.menu_item_name}`).join(" + ")}
                    </p>
                    <p className="text-base font-bold text-primary">{format(combo.bundle_price ?? 0)}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="flex-1 gap-1 text-xs" onClick={() => openEditCombo(combo)}>
                    <Pencil size={12} /> Edit
                  </Button>
                  <Button size="sm" variant="destructive" className="px-2.5" onClick={() => setDeleteConfirm({ type: "combo", id: combo.id, name: combo.name })}>
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}

            {combos.length === 0 && (
              <div className="col-span-full text-center py-20 text-muted-foreground">
                <Gift size={36} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm">No combo offers yet</p>
                <p className="text-xs mt-1 opacity-70">
                  Volume: "3 Samosas for $5" · Bundle: "Burger + Drink for $12"
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      </main>

      {/* ══════════════ DIALOGS ══════════════ */}

      {/* Menu Item dialog */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Menu Item" : "Add Menu Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Item name" value={fName} onChange={(e) => setFName(e.target.value)} />
            <Input type="number" placeholder="Price" value={fPrice || ""} onChange={(e) => setFPrice(Number(e.target.value))} />

            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Category</label>
              <select
                className={selectCls}
                value={fCat ?? ""}
                onChange={(e) => setFCat(e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">No category</option>
                {(categories as any[]).map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>

            <label className="flex items-center gap-2.5 text-sm text-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={fWeight}
                onChange={(e) => setFWeight(e.target.checked)}
                className="rounded"
              />
              Weight-based item (kg / decimal qty)
            </label>

            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground block">Barcode</label>
              <div className="flex gap-2">
                <Input
                  placeholder="Scan or enter barcode"
                  value={fBarcode}
                  onChange={(e) => setFBarcode(e.target.value)}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFBarcode(String(Date.now()).slice(-10))}
                >
                  Generate
                </Button>
              </div>
              {fBarcode && (
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                  onClick={() => setBarcodeView({ id: 0, name: fName || "Item", price: 0, category_id: null, barcode: fBarcode })}
                >
                  Preview barcode →
                </button>
              )}
            </div>

            {editItem && (
              <div className="space-y-2">
                {editItem.image_url && (
                  <div className="relative rounded-xl overflow-hidden aspect-video group">
                    <img
                      src={resolveImg(editItem.image_url)}
                      alt="Current"
                      className="w-full h-full object-cover"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <button
                        className="bg-card/90 backdrop-blur-sm rounded-full p-2 hover:bg-card"
                        onClick={() => imageRef.current?.click()}
                      >
                        <Camera size={16} />
                      </button>
                      <button
                        className="bg-card/90 backdrop-blur-sm rounded-full p-2 hover:bg-red-50"
                        onClick={() => {
                          deleteMenuImage(editItem.id);
                          setEditItem(prev => prev ? { ...prev, image_url: undefined } : prev);
                        }}
                      >
                        <X size={16} className="text-red-500" />
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={imageRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !editItem) return;
                    try {
                      const res = await uploadMenuImage(editItem.id, file);
                      setEditItem(prev => prev ? { ...prev, image_url: res.image_url } : prev);
                      qc.invalidateQueries({ queryKey: ["menu"] });
                    } catch {
                      toastError("Image upload failed");
                    }
                  }}
                />
                <Button type="button" variant="outline" className="w-full gap-2" onClick={() => imageRef.current?.click()}>
                  <Camera size={15} />
                  {editItem.image_url ? "Change Photo" : "Upload Photo"}
                </Button>
              </div>
            )}

            <Button className="w-full" onClick={saveItem}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCat ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Category name" value={cName} onChange={(e) => setCName(e.target.value)} />

            <div>
              <label className="text-xs text-muted-foreground block mb-2">Colour</label>
              <div className="flex flex-wrap gap-2 mb-3">
                {["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#f97316","#0ea5e9"].map(c => (
                  <button
                    key={c}
                    onClick={() => setCColor(c)}
                    className="w-8 h-8 rounded-full transition-all hover:scale-110 ring-offset-background"
                    style={{
                      background: c,
                      outline: cColor === c ? `3px solid ${c}` : "none",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={cColor}
                  onChange={(e) => setCColor(e.target.value)}
                  className="h-9 w-14 rounded-lg cursor-pointer border"
                />
                <span className="text-sm text-muted-foreground font-mono">{cColor}</span>
                <div className="flex-1 h-9 rounded-lg" style={{ background: cColor }} />
              </div>
            </div>

            <Button className="w-full" onClick={saveCat}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Combo dialog */}
      <Dialog open={comboOpen} onOpenChange={setComboOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCombo ? "Edit Combo" : "Add Combo Offer"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Combo name" value={coName} onChange={(e) => setCoName(e.target.value)} />

            {/* Type selector */}
            <div className="grid grid-cols-2 gap-2">
              {(["volume", "bundle"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setCoType(t)}
                  className={cn(
                    "py-2.5 rounded-xl text-sm font-medium border transition-all",
                    coType === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                  )}
                >
                  {t === "volume" ? "Volume Deal" : "Bundle Deal"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              {coType === "volume"
                ? "One item, quantity tiers — e.g. 3 Samosas for $5"
                : "Multiple items — e.g. Burger + Drink for $12"}
            </p>

            {/* Items */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-medium text-foreground">
                  {coType === "volume" ? "Item" : "Items in bundle"}
                </p>
                {coType === "bundle" && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setCoItems(prev => [...prev, { menu_item_id: 0, quantity: 1 }])}
                  >
                    + Add item
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {coItems.map((ci, i) => (
                  <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-xl p-2">
                    <select
                      className={cn(selectCls, "flex-1")}
                      value={ci.menu_item_id || ""}
                      onChange={(e) => setCoItems(prev =>
                        prev.map((x, j) => j === i ? { ...x, menu_item_id: Number(e.target.value) } : x)
                      )}
                    >
                      <option value="">Select item</option>
                      {(menuItems as MenuItem[]).map((item) => (
                        <option key={item.id} value={item.id}>{item.name} ({format(item.price)})</option>
                      ))}
                    </select>
                    <Input
                      type="number" min={1} placeholder="Qty"
                      value={ci.quantity || ""}
                      onChange={(e) => setCoItems(prev =>
                        prev.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x)
                      )}
                      className="w-16 h-9 text-center"
                    />
                    {coItems.length > 1 && (
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-red-500 transition p-1 shrink-0"
                        onClick={() => setCoItems(prev => prev.filter((_, j) => j !== i))}
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Bundle pricing mode toggle */}
            {coType === "bundle" && (
              <label className="flex items-center gap-2.5 text-sm text-muted-foreground cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={coUseTiers}
                  onChange={(e) => setCoUseTiers(e.target.checked)}
                  className="rounded"
                />
                Add quantity tiers (volume pricing per bundle set)
              </label>
            )}

            {/* Pricing Tiers */}
            {(coType === "volume" || coUseTiers) && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm font-medium text-foreground">Pricing Tiers</p>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setCoTiers(prev => [...prev, { quantity: 1, price: 0 }])}
                  >
                    + Add tier
                  </button>
                </div>
                <div className="space-y-2">
                  {coTiers.map((tier, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/40 rounded-xl p-2">
                      <span className="text-xs text-muted-foreground shrink-0">
                        {coType === "bundle" ? "Sets" : "Buy"}
                      </span>
                      <Input
                        type="number" min={1} placeholder="Qty"
                        value={tier.quantity || ""}
                        onChange={(e) => setCoTiers(prev =>
                          prev.map((t, j) => j === i ? { ...t, quantity: Number(e.target.value) } : t)
                        )}
                        className="w-20 h-9 text-center"
                      />
                      <span className="text-xs text-muted-foreground shrink-0">for</span>
                      <Input
                        type="number" min={0} step={0.01} placeholder="Price"
                        value={tier.price || ""}
                        onChange={(e) => setCoTiers(prev =>
                          prev.map((t, j) => j === i ? { ...t, price: Number(e.target.value) } : t)
                        )}
                        className="flex-1 h-9"
                      />
                      {coTiers.length > 1 && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-red-500 transition p-1 shrink-0"
                          onClick={() => setCoTiers(prev => prev.filter((_, j) => j !== i))}
                        >
                          <X size={15} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Flat bundle price */}
            {coType === "bundle" && !coUseTiers && (
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Bundle Price (total)</p>
                <Input
                  type="number" min={0} step={0.01} placeholder="e.g. 12.00"
                  value={coBundlePrice || ""}
                  onChange={(e) => setCoBundlePrice(Number(e.target.value))}
                />
              </div>
            )}

            <Button className="w-full" onClick={saveCombo}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Barcode */}
      <BarcodeDialog item={barcodeView} onClose={() => setBarcodeView(null)} />

      {/* Hidden file input for image upload from card hover */}
      <input ref={imageRef} type="file" accept="image/*" className="hidden" />

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => { if (!o) setDeleteConfirm(null); }}>
        <DialogContent aria-describedby="delete-desc" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {deleteConfirm?.type === "item" ? "Item" : deleteConfirm?.type === "category" ? "Category" : "Combo"}?</DialogTitle>
            <DialogDescription id="delete-desc">
              <span className="font-semibold text-foreground">"{deleteConfirm?.name}"</span> will be permanently removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
