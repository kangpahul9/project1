import { Sidebar } from "@/components/Sidebar";
import { useExpenses, useCreateExpense } from "@/hooks/use-expenses";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { format } from "date-fns";

export default function Expenses() {
  const { data: expenses, isLoading } = useExpenses();
  const { data: currentDay } = useCurrentBusinessDay();
  const { mutate: createExpense, isPending } = useCreateExpense();
  const [open, setOpen] = useState(false);

  const form = useForm({
  defaultValues: {
    description: "",
    amount: 0,
    category: "supplies",
    paymentMode: "cash",
  }
});

  const onSubmit = (data: any) => {
    if (!currentDay) return; // Should be handled by disabling button
    if (!data.description.trim()) {
  alert("Description is required");
  return;
}

if (data.amount <= 0) {
  alert("Amount must be greater than 0");
  return;
}
    createExpense({ ...data, businessDayId: currentDay.id }, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      }
    });
  };

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold font-display text-gray-900">Expenses</h1>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button disabled={!currentDay} className="shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record New Expense</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Amount (₹)</FormLabel>
                          <FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Category</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="supplies">Supplies</SelectItem>
                              <SelectItem value="salary">Salary</SelectItem>
                              <SelectItem value="utility">Utility</SelectItem>
                              <SelectItem value="maintenance">Maintenance</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <FormField
                      control={form.control}
                      name="paymentMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Mode</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="cash">Cash</SelectItem>
                              <SelectItem value="online">Online</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isPending}>
                    {isPending ? "Saving..." : "Record Expense"}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Total Expenses Summary */}
{!isLoading && (
  <div className="mb-6 bg-white p-6 rounded-xl shadow">
    <h3 className="text-lg font-semibold">Total Expenses</h3>
    <p className="text-2xl font-bold text-red-600 mt-2">
      ₹{
        expenses?.reduce(
          (sum: number, e: any) => sum + Number(e.amount),
          0
        ) || 0
      }
    </p>
  </div>
)}

        {isLoading && (
  <div className="text-center py-10 text-muted-foreground">
    Loading expenses...
  </div>
)}

{!isLoading && (
  <div className="grid gap-4">
    {expenses?.map((expense: any) => (
      <Card key={expense.id} className="hover:shadow-md transition-all">
        <CardContent className="flex items-center justify-between p-6">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">{expense.description}</h3>
              <p className="text-sm text-muted-foreground">
                {format(new Date(expense.created_at), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-bold text-lg text-red-600">
              -₹{expense.amount}
            </p>
            <p className="text-xs text-muted-foreground uppercase">
              {expense.payment_method}
            </p>
          </div>
        </CardContent>
      </Card>
    ))}

    {expenses?.length === 0 && (
      <div className="text-center py-12 text-muted-foreground">
        No expenses recorded.
      </div>
    )}
  </div>
)}
      </main>
    </div>
    
  );
  
}

