import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { useMenu, useCategories } from "@/hooks/use-menu";
import { useCreateOrder } from "@/hooks/use-orders";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { useAuthStore } from "@/hooks/use-auth";
import { MenuItem, Category } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Search, Plus, Minus, Trash2, ShoppingCart, Loader2, Wifi, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface CartItem extends MenuItem {
  quantity: number;
}

export default function Pos() {
  const { data: menuItems, isLoading: isMenuLoading } = useMenu();
  const { data: categories, isLoading: isCatsLoading } = useCategories();
  const { data: currentDay } = useCurrentBusinessDay();
  const { user } = useAuthStore();
  const { mutate: createOrder, isPending: isProcessing } = useCreateOrder();
  const { toast } = useToast();

  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkoutMode, setCheckoutMode] = useState(false);
  const [customerName, setCustomerName] = useState("");

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const updateQuantity = (itemId: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === itemId) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => prev.filter(item => item.id !== itemId));
  };

  const handleCheckout = (paymentMethod: "cash" | "online" | "card") => {
    if (!currentDay || !user) return;

    createOrder({
      businessDayId: currentDay.id,
      userId: user.id,
      customerName: customerName || undefined,
      paymentMethod,
      items: cart.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
        price: item.price,
        name: item.name
      }))
    }, {
      onSuccess: () => {
        setCart([]);
        setCustomerName("");
        setCheckoutMode(false);
        toast({
          title: "Order Completed",
          description: `Total: ₹${cartTotal}`,
          className: "bg-green-500 text-white border-none"
        });
      }
    });
  };

  const filteredItems = menuItems?.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory ? item.categoryId === activeCategory : true;
    return matchesSearch && matchesCategory;
  }) || [];

  const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  if (!currentDay) {
    return (
      <div className="flex bg-gray-50 min-h-screen">
        <Sidebar />
        <main className="flex-1 ml-64 p-8 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Business is Closed</h2>
            <p className="text-gray-500">Open a new business day from the dashboard to use POS.</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 h-screen overflow-hidden">
      <Sidebar />
      
      {/* Main Content - Menu Area */}
      <main className="flex-1 ml-64 p-6 flex flex-col h-screen overflow-hidden">
        {/* Header / Filter Bar */}
        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search menu items..." 
              className="pl-10 h-12 text-lg bg-white shadow-sm border-gray-200 rounded-xl"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Categories */}
        <div className="mb-6 overflow-x-auto pb-2 no-scrollbar">
          <div className="flex gap-2">
            <Button
              variant={activeCategory === null ? "default" : "secondary"}
              onClick={() => setActiveCategory(null)}
              className="rounded-full px-6 h-10 shadow-sm"
            >
              All
            </Button>
            {categories?.map(cat => (
              <Button
                key={cat.id}
                variant={activeCategory === cat.id ? "default" : "secondary"}
                onClick={() => setActiveCategory(cat.id)}
                className="rounded-full px-6 h-10 shadow-sm whitespace-nowrap"
              >
                {cat.name}
              </Button>
            ))}
          </div>
        </div>

        {/* Menu Grid */}
        <ScrollArea className="flex-1 -mr-4 pr-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-20">
            {isMenuLoading ? (
              <div className="col-span-full flex justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredItems.map(item => (
              <div 
                key={item.id}
                onClick={() => addToCart(item)}
                className="bg-white rounded-xl p-4 shadow-sm border border-transparent hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer group flex flex-col justify-between min-h-[140px]"
              >
                <div>
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary transition-colors line-clamp-2">
                    {item.name}
                  </h3>
                </div>
                <div className="flex items-end justify-between mt-4">
                  <span className="text-lg font-bold font-display text-gray-900">₹{item.price}</span>
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </main>

      {/* Right Sidebar - Cart */}
      <aside className="w-[400px] bg-white border-l h-screen flex flex-col shadow-xl z-20">
        <div className="p-6 border-b bg-gray-50/50">
          <h2 className="text-xl font-bold font-display flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            Current Order
          </h2>
          <div className="mt-4">
             <Input 
                placeholder="Customer Name (Optional)" 
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-white"
             />
          </div>
        </div>

        <ScrollArea className="flex-1 p-6">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400 mt-20">
              <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
              <p>Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map(item => (
                <div key={item.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <div className="flex-1">
                    <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
                    <p className="text-xs text-gray-500">₹{item.price} x {item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-2 bg-white rounded-lg p-1 border shadow-sm">
                    <button 
                      onClick={() => updateQuantity(item.id, -1)}
                      className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="w-4 text-center text-sm font-medium">{item.quantity}</span>
                    <button 
                      onClick={() => updateQuantity(item.id, 1)}
                      className="w-6 h-6 flex items-center justify-center hover:bg-gray-100 rounded text-gray-600"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                  <button 
                    onClick={() => removeFromCart(item.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors p-1"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="p-6 bg-gray-50 border-t space-y-4">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-gray-500">
              <span>Subtotal</span>
              <span>₹{cartTotal}</span>
            </div>
            <div className="flex justify-between font-bold text-lg text-gray-900 pt-2 border-t">
              <span>Total</span>
              <span>₹{cartTotal}</span>
            </div>
          </div>

          <Button 
            className="w-full h-12 text-lg font-bold shadow-lg shadow-primary/25" 
            size="lg"
            disabled={cart.length === 0}
            onClick={() => setCheckoutMode(true)}
          >
            Checkout ₹{cartTotal}
          </Button>
        </div>
      </aside>

      {/* Checkout Dialog */}
      <Dialog open={checkoutMode} onOpenChange={setCheckoutMode}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Payment Method</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-32 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all text-lg font-medium"
              onClick={() => handleCheckout("cash")}
              disabled={isProcessing}
            >
              <Banknote className="w-8 h-8" />
              Cash
            </Button>
            <Button
              variant="outline"
              className="h-32 flex flex-col items-center justify-center gap-4 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all text-lg font-medium"
              onClick={() => handleCheckout("online")}
              disabled={isProcessing}
            >
              <Wifi className="w-8 h-8" />
              Online / UPI
            </Button>
          </div>
          {isProcessing && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
