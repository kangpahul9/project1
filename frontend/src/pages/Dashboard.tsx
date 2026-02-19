import { useCurrentBusinessDay, useOpenBusinessDay, useCloseBusinessDay } from "@/hooks/use-business-days";
import { useAuthStore } from "@/hooks/use-auth";
import { StatCard } from "@/components/StatCard";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DollarSign, ShoppingBag, CreditCard, AlertCircle, TrendingUp, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useOrders } from "@/hooks/use-orders";
import { Loader2 } from "lucide-react";

// Schema for opening day
const openDaySchema = z.object({
  openingCash: z.coerce.number().min(0, "Opening cash cannot be negative"),
});

// Schema for closing day
const closeDaySchema = z.object({
  closingCash: z.coerce.number().min(0, "Closing cash cannot be negative"),
});

export default function Dashboard() {
  const { data: currentDay, isLoading } = useCurrentBusinessDay();
  const { mutate: openDay, isPending: isOpening } = useOpenBusinessDay();
  const { mutate: closeDay, isPending: isClosing } = useCloseBusinessDay();
  const { user } = useAuthStore();
  const { data: orders } = useOrders(currentDay?.id);
  
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);

  const openForm = useForm({
    resolver: zodResolver(openDaySchema),
    defaultValues: { openingCash: 0 },
  });

  const closeForm = useForm({
    resolver: zodResolver(closeDaySchema),
    defaultValues: { closingCash: 0 },
  });

  const onOpenDay = (data: z.infer<typeof openDaySchema>) => {
    if (!user) return;
    openDay({ ...data, openedBy: user.id }, {
      onSuccess: () => setOpenDialogOpen(false)
    });
  };

  const onCloseDay = (data: z.infer<typeof closeDaySchema>) => {
    if (!user || !currentDay) return;
    closeDay({ ...data, closedBy: user.id, id: currentDay.id }, {
      onSuccess: () => setCloseDialogOpen(false)
    });
  };

  // Derived stats
  const totalOrders = orders?.length || 0;
  const totalSales = orders?.reduce((acc, order) => acc + order.totalAmount, 0) || 0;
  const cashSales = orders?.filter(o => o.paymentMethod === 'cash').reduce((acc, o) => acc + o.totalAmount, 0) || 0;
  const onlineSales = orders?.filter(o => o.paymentMethod === 'online' || o.paymentMethod === 'card').reduce((acc, o) => acc + o.totalAmount, 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold font-display text-gray-900">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Overview of today's performance</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 ${
              currentDay 
                ? "bg-green-100 text-green-700 border border-green-200" 
                : "bg-amber-100 text-amber-700 border border-amber-200"
            }`}>
              {currentDay ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
              {currentDay ? "Business Open" : "Business Closed"}
            </div>

            {!currentDay ? (
              <Dialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20">
                    Start Business Day
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Open Business Day</DialogTitle>
                    <DialogDescription>Enter the opening cash amount in the register.</DialogDescription>
                  </DialogHeader>
                  <Form {...openForm}>
                    <form onSubmit={openForm.handleSubmit(onOpenDay)} className="space-y-4">
                      <FormField
                        control={openForm.control}
                        name="openingCash"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Opening Cash</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" disabled={isOpening}>
                          {isOpening ? "Opening..." : "Confirm Open"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            ) : (
              <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" className="shadow-lg shadow-destructive/20">
                    Close Business Day
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Close Business Day</DialogTitle>
                    <DialogDescription>
                      Enter the closing cash amount. This will finalize today's sales.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-2 text-sm text-muted-foreground bg-secondary/50 p-4 rounded-lg">
                    <div className="flex justify-between">
                      <span>Total Sales:</span>
                      <span className="font-semibold text-foreground">₹{totalSales}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cash Collected:</span>
                      <span className="font-semibold text-foreground">₹{cashSales}</span>
                    </div>
                  </div>
                  <Form {...closeForm}>
                    <form onSubmit={closeForm.handleSubmit(onCloseDay)} className="space-y-4">
                      <FormField
                        control={closeForm.control}
                        name="closingCash"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Closing Cash Counted</FormLabel>
                            <FormControl>
                              <Input type="number" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <DialogFooter>
                        <Button type="submit" variant="destructive" disabled={isClosing}>
                          {isClosing ? "Closing..." : "Confirm Close"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {currentDay ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <StatCard
              title="Total Sales"
              value={`₹${totalSales}`}
              icon={DollarSign}
              className="border-primary/50"
            />
            <StatCard
              title="Total Orders"
              value={totalOrders}
              icon={ShoppingBag}
              className="border-blue-500/50"
            />
            <StatCard
              title="Online Payments"
              value={`₹${onlineSales}`}
              icon={CreditCard}
              className="border-purple-500/50"
            />
            <StatCard
              title="Avg Order Value"
              value={`₹${totalOrders > 0 ? Math.round(totalSales / totalOrders) : 0}`}
              icon={TrendingUp}
              className="border-green-500/50"
            />
          </div>
        ) : (
          <div className="bg-white rounded-xl p-12 text-center border shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Store className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Business Closed</h3>
            <p className="text-gray-500 mt-2 max-w-sm mx-auto">
              Start a new business day to begin taking orders and tracking sales.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

// Helper component for empty state icon
function Store({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  );
}
