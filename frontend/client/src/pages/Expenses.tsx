import { Sidebar } from "@/components/Sidebar";
import {
  useExpenses,
  useCreateExpense,
  useUploadExpenseImage,
  useDeleteExpense,
  useUpdateExpense
} from "@/hooks/use-expenses";
import {DenominationSelector} from "@/components/DenominationSelector";
// import { useStaff } from "@/hooks/use-staff";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Wallet, Eye,Download,Pencil, Trash2 } from "lucide-react";
import { useState,useEffect } from "react";
import { format } from "date-fns";
import { useVendorSummary } from "@/hooks/use-vendors";

export default function Expenses() {
  const { data: expenses, isLoading } = useExpenses();
  const { data: currentDay } = useCurrentBusinessDay();
  const { mutate: createExpense, isPending } = useCreateExpense();

  const uploadImage = useUploadExpenseImage();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { data: vendors } = useVendorSummary();
  // const { data: staff } = useStaff();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { mutate: deleteExpense } = useDeleteExpense();
const { mutate: updateExpense } = useUpdateExpense();

const [editingExpense, setEditingExpense] = useState<any>(null);

  const form = useForm({
    defaultValues: {
      description: "",
      amount: 0,
      category: "supplies",
      paymentMode: "online",
      vendorId: "",
      utilityType: "",
      isPaid: false,
    },
  });

  const [deductFromGalla, setDeductFromGalla] = useState(false);

const DENOMS = [500,200,100,50,20,10,5,2,1];
const [selectedNotes, setSelectedNotes] = useState(
  DENOMS.map(d => ({ note: d, qty: 0 }))
);

useEffect(() => {
  if (form.watch("paymentMode") === "cash" && deductFromGalla) {
    const total = selectedNotes.reduce(
      (sum, note) => sum + note.note * note.qty,
      0
    );

    form.setValue("amount", total);
  }
}, [selectedNotes, deductFromGalla, form.watch("paymentMode")]);

useEffect(() => {
  if (form.watch("paymentMode") === "cash" && deductFromGalla) {
    form.setValue("isPaid", true);
  }
}, [deductFromGalla, form.watch("paymentMode")]);

  const onSubmit = (data: any) => {
  if (!currentDay) return;

  if (!data.description.trim()) {
    alert("Description is required");
    return;
  }

  if (data.amount <= 0) {
    alert("Amount must be greater than 0");
    return;
  }

  const denominationObject = Object.fromEntries(
  selectedNotes
    .filter(n => n.qty > 0)
    .map(n => [n.note, n.qty])
);

const payload = {
  ...data,
  vendorId: data.vendorId ? Number(data.vendorId) : null,
  is_paid: data.isPaid,
  businessDayId: currentDay.id,
  document_url: uploadedUrl,
  deduct_from_galla: deductFromGalla,
  ...(data.paymentMode === "cash" && deductFromGalla && {
    denominations: denominationObject
  })
};

  if (editingExpense) {
    updateExpense(
      { id: editingExpense.id, ...payload },
      {
        onSuccess: () => {
          setOpen(false);
          setEditingExpense(null);
          form.reset();
        },
      }
    );
  } else {
    createExpense(payload, {
      onSuccess: () => {
        setOpen(false);
        form.reset();
      },
    });
  }
};
const handleEdit = (expense: any) => {
  setEditingExpense(expense);
  setOpen(true);

  form.reset({
    description: expense.description,
    amount: Number(expense.amount),
    category: expense.category,
    paymentMode: expense.payment_method,
    vendorId: expense.vendor_id?.toString() || "",
    utilityType: expense.utility_type || "",
    isPaid: expense.is_paid || false,
  });

  setUploadedUrl(expense.document_url || null);
};
  const selectedCategory = form.watch("category");

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
<div className="mb-6 space-y-4">          <h1 className="text-3xl font-bold font-display text-gray-900">
            Expenses
          </h1>
          <Input
  placeholder="Search expenses..."
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  className="mb-6"
/>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={!currentDay}
                className="shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Expense
              </Button>
              
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record New Expense</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
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
                          <FormControl>
                            <Input
                              type="number"
                              {...field}
                                disabled={form.watch("paymentMode") === "cash" && deductFromGalla}

                              onChange={(e) =>
                                field.onChange(Number(e.target.value))
                              }
                            />
                          </FormControl>
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
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="supplies">Supplies</SelectItem>
                              <SelectItem value="salary">Salary</SelectItem>
                              <SelectItem value="utility">Utility</SelectItem>
                              <SelectItem value="miscellaneous">Miscellaneous</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {selectedCategory === "supplies" && (
                      <FormField
                        control={form.control}
                        name="vendorId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Vendor</FormLabel>
                            <Select
                              value={String(field.value)}
                              onValueChange={(value) => field.onChange(value)}
                            >
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Select vendor" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {vendors?.map((vendor: any) => (
                                  <SelectItem
                                    key={vendor.id}
                                    value={String(vendor.id)}
                                  >
                                    {vendor.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                    )}
                    {/* {selectedCategory === "salary" && (
  <FormField
    control={form.control}
    name="staffId"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Staff</FormLabel>
        <Select
          value={String(field.value || "")}
          onValueChange={(value) => field.onChange(value)}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select staff" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {staff?.map((s: any) => (
              <SelectItem key={s.id} value={String(s.id)}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FormItem>
    )}
  />
)} */}

                    {selectedCategory === "utility" && (
  <FormField
    control={form.control}
    name="utilityType"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Utility Type</FormLabel>
        <Select
          value={field.value}
          onValueChange={field.onChange}
        >
          <FormControl>
            <SelectTrigger>
              <SelectValue placeholder="Select utility type" />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            <SelectItem value="rent">Rent</SelectItem>
            <SelectItem value="electricity">Electricity</SelectItem>
            <SelectItem value="water">Water</SelectItem>
            <SelectItem value="internet">Internet</SelectItem>
          </SelectContent>
        </Select>
      </FormItem>
    )}
  />
)}
                    <FormField
                      control={form.control}
                      name="paymentMode"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Payment Mode</FormLabel>
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select mode" />
                              </SelectTrigger>
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
                    <FormField
  control={form.control}
  name="isPaid"
  render={({ field }) => {
    const isCash = form.watch("paymentMode") === "cash";

    // If deducting from galla → force paid = true
    if (isCash && deductFromGalla && !field.value) {
      field.onChange(true);
    }

    return (
      <FormItem className="flex items-center gap-2">
        <FormControl>
          <input
            type="checkbox"
            checked={isCash && deductFromGalla ? true : field.value}
            disabled={isCash && deductFromGalla}
            onChange={(e) => field.onChange(e.target.checked)}
          />
        </FormControl>
        <FormLabel>
          Mark as Paid
          {isCash && deductFromGalla && (
            <span className="text-xs text-green-600 ml-2">
              (Auto Paid via Galla)
            </span>
          )}
        </FormLabel>
      </FormItem>
    );
  }}
/>
                    {form.watch("paymentMode") === "cash" && (
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={deductFromGalla}
      onChange={(e) => setDeductFromGalla(e.target.checked)}
    />
    <label>Deduct from Galla</label>
  </div>
)}
{form.watch("paymentMode") === "cash" && deductFromGalla && (
  <DenominationSelector
    breakdown={selectedNotes}
    setBreakdown={setSelectedNotes}
    title="Cash Used"
  />
)}
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        Upload Bill (Photo or Image)
                      </label>
                      <Input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={async (e) => {
                          if (!e.target.files?.length) return;

                          const file = e.target.files[0];
                          setSelectedFile(file);

                          try {
                            const url = await uploadImage(file);
                            setUploadedUrl(url);
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                      />

                      {uploadedUrl && (
                        <img
                          src={`${import.meta.env.VITE_API_URL}${uploadedUrl}`}
                          className="mt-3 w-24 h-24 object-cover rounded border"
                        />
                      )}
                    </div>
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
          <div className="mb-6 bg-white p-6 rounded-xl shadow space-y-4">
  <div className="flex justify-between items-center">
  <h3 className="text-lg font-semibold">Expense Analytics</h3>

  <Button
    variant="outline"
    size="sm"
    onClick={() => setFilterCategory(null)}
  >
    All Expenses
  </Button>
</div>

  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {["supplies","salary","utility","miscellaneous"].map(cat => {
      const total = expenses
        ?.filter((e:any)=>e.category===cat)
        .reduce((sum:number,e:any)=>sum+Number(e.amount),0) || 0;

      return (
        <div
  key={cat}
  onClick={() =>
    setFilterCategory(filterCategory === cat ? null : cat)
  }
  className={`p-3 rounded text-center cursor-pointer transition
    ${
      filterCategory === cat
        ? "bg-red-100"
        : "bg-gray-50 hover:bg-gray-100"
    }`}
>
          <p className="text-xs uppercase text-muted-foreground">{cat}</p>
          <p className="font-bold text-red-600">₹{total}</p>
        </div>
      );
    })}
  </div>
</div>
        )}

        {isLoading && (
          <div className="text-center py-10 text-muted-foreground">
            Loading expenses...
          </div>
        )}

        {!isLoading && (
          <div className="grid gap-4">
            {expenses
  ?.filter((e: any) =>
    filterCategory ? e.category === filterCategory : true
  )
  .filter((e: any) => {
  const term = searchTerm.toLowerCase();

  return (
    e.description?.toLowerCase().includes(term) ||
    e.vendor_name?.toLowerCase().includes(term)
  );
})
  .map((expense: any) => (
              <Card key={expense.id} className="hover:shadow-md transition-all">
                <CardContent className="flex items-center justify-between p-6">
  <div className="flex items-center gap-4">
    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600">
      <Wallet className="w-5 h-5" />
    </div>

    <div>
      <h3 className="font-semibold text-m ">{expense.description} {expense.category === "supplies" && expense.vendor_name && (
  <span className="inline-block mt-1 px-2 py-0.5 text-s bg-blue-50 text-blue-700 rounded-full"> 
    {expense.vendor_name}
  </span>
)}</h3>
      

      <p className="text-sm text-muted-foreground">
        {format(new Date(expense.created_at), "MMM d, yyyy")}
      </p>

      <p className="text-xs text-gray-500 capitalize">
  {expense.category}
</p>


      {expense.is_paid && (
  <span className="inline-block px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
    Paid
  </span>
)}
    </div>
  </div>

  <div className="flex items-center gap-6">
    {expense.document_url && (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() =>
            setPreviewUrl(
              `${import.meta.env.VITE_API_URL}${expense.document_url}`
            )
          }
          className="p-2 rounded hover:bg-gray-100"
        >
          <Eye className="w-5 h-5" />
        </button>

        <a
          href={`${import.meta.env.VITE_API_URL}${expense.document_url}`}
          download
          className="p-2 rounded hover:bg-gray-100"
        >
          <Download className="w-5 h-5" />
        </a>
        
      </div>
    )}
    <button
  disabled={expense.is_paid}
  onClick={() => handleEdit(expense)}
  className={`p-2 rounded ${
    expense.is_paid ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"
  }`}
>
  <Pencil className="w-4 h-4" />
</button>

<button
  disabled={expense.is_paid}
  onClick={() => {
    if (confirm("Delete this expense?")) {
      deleteExpense(expense.id);
    }
  }}
  className={`p-2 rounded text-red-600 ${
    expense.is_paid ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-100"
  }`}
>
  <Trash2 className="w-4 h-4" />
</button>

    <div className="text-right">
      <p className="font-bold text-lg text-red-600">
        -₹{expense.amount}
      </p>
      <p className="text-xs text-muted-foreground uppercase">
        {expense.payment_method}
      </p>
    </div>
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
        <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>Bill Preview</DialogTitle>
    </DialogHeader>

    {previewUrl && (
      <img
        src={previewUrl}
        className="w-full h-auto rounded"
      />
    )}
  </DialogContent>
</Dialog>
<Dialog
  open={open}
  onOpenChange={(val) => {
    setOpen(val);
    if (!val) {
      setEditingExpense(null);
      form.reset();
    }
  }}
></Dialog>
      </main>
    </div>
  );
}
