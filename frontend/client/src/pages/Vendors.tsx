import { Sidebar } from "@/components/Sidebar";
import {
  useVendorSummary,
  useCreateVendor,
  useVendorUnpaid,
  useSettleVendor,
  useVendorSettlements,
} from "@/hooks/use-vendors";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useEffect } from "react";
import { DenominationSelector } from "@/components/DenominationSelector";
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectContent
} from "@/components/ui/select";import { usePartners } from "@/hooks/use-partners";


export default function Vendors() {
  const { data: vendors, isLoading } = useVendorSummary();
  const { mutate: createVendor } = useCreateVendor();

  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const { data: partners } = usePartners();
const [partnerId, setPartnerId] = useState<number | null>(null);

  
  const { data: unpaid } = useVendorUnpaid(selectedVendor?.id);
  const { mutate: settleVendor } = useSettleVendor(selectedVendor?.id);
  const { data: settlements } = useVendorSettlements(selectedVendor?.id);

  const [selectedExpenses, setSelectedExpenses] = useState<number[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
  "card" | "online" | "cash"
>("card");

const [deductFromGalla, setDeductFromGalla] = useState<boolean>(false);

  const [finalAmount, setFinalAmount] = useState<number>(0);
const DENOMS = [500,200,100,50,20,10,5,2,1];

const [selectedNotes, setSelectedNotes] = useState(
  DENOMS.map(d => ({ note: d, qty: 0 }))
);
  const totalSelected =
  unpaid
    ?.filter((e: any) => selectedExpenses.includes(e.id))
    .reduce((sum: number, e: any) => sum + parseFloat(e.amount), 0) || 0;

const handleCreate = () => {
  console.log("Add clicked");

  if (!name.trim()) {
    console.log("Name empty");
    return;
  }

  createVendor(
    { name: name.trim(), phone },
    {
      onSuccess: () => {
        console.log("Success");
        setName("");
        setPhone("");
      },
      onError: (err) => {
        console.log("Error", err);
      }
    }
  );
};

console.log("selectedVendor", selectedVendor);
console.log("unpaid expenses", unpaid);

  const toggleExpense = (id: number) => {
    setSelectedExpenses((prev) =>
      prev.includes(id)
        ? prev.filter((e) => e !== id)
        : [...prev, id]
    );
  };

  useEffect(() => {
  setFinalAmount(totalSelected);
}, [totalSelected]);
 
useEffect(() => {
  if (paymentMethod === "cash" && deductFromGalla) {
    const denomTotal = selectedNotes.reduce(
      (sum, n) => sum + n.note * n.qty,
      0
    );

    setFinalAmount(denomTotal);
  }
}, [selectedNotes, paymentMethod, deductFromGalla]);


useEffect(() => {
  if (paymentMethod === "cash" && deductFromGalla) {
    setPartnerId(null);
  }
}, [paymentMethod, deductFromGalla]);

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">

        {/* ADD VENDOR */}
        <div className="mb-6 space-y-4">

  <h1 className="text-2xl sm:text-3xl font-bold">
    Vendors
  </h1>

  <div className="flex flex-col sm:flex-row gap-3">

    <Input
      placeholder="Vendor name"
      value={name}
      onChange={(e) => setName(e.target.value)}
      className="flex-1"
    />

    <Input
      placeholder="Phone"
      value={phone}
      onChange={(e) => setPhone(e.target.value)}
      className="flex-1"
    />

    <Button
      type="button"
      onClick={handleCreate}
      className="w-full sm:w-auto"
    >
      Add Vendor
    </Button>

  </div>
</div>

        {/* SUMMARY GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {vendors?.map((vendor: any) => (
            <Card
  key={vendor.id}
  className={`cursor-pointer transition rounded-xl ${
  selectedVendor?.id === vendor.id
    ? "border-primary bg-primary/5 shadow-md"
    : "hover:shadow-md bg-white"
}`}
  onClick={() => setSelectedVendor(vendor)}
>
              <CardHeader>
                <CardTitle>{vendor.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">Unpaid</p>
<p className="text-lg font-bold text-red-600">
  ₹{vendor.total_unpaid}
</p>

<p className="text-sm text-gray-500 mt-2">Paid</p>
<p className="text-lg font-bold text-green-600">
  ₹{vendor.total_paid}
</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* VENDOR DETAILS */}
        {selectedVendor && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold mb-4">
              {selectedVendor.name} — Unpaid Expenses
            </h2>

            {unpaid?.map((expense: any) => (
              <div
  key={expense.id}
  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border p-3 mb-2 rounded-lg bg-white shadow-sm"
>
  <div>
    <p className="font-semibold text-red-600">
      ₹{expense.amount}
    </p>

    <p className="text-sm">{expense.description}</p>

    <p className="text-xs text-gray-500">
      {new Date(expense.created_at).toLocaleDateString()} • {expense.uploaded_by}
    </p>
  </div>

  <input
    type="checkbox"
    className="w-5 h-5 accent-primary"
    checked={selectedExpenses.includes(expense.id)}
    onChange={() => toggleExpense(expense.id)}
  />
</div>
            ))}

            <h3 className="text-xl font-semibold mt-8 mb-4">
  Settlement History
</h3>

{settlements?.map((s: any) => (
    <div key={s.id} className="p-4 rounded-xl mb-2 bg-white shadow-sm border">
  <div className="flex justify-between items-center">
    <span className="font-bold text-green-600">
      +₹{s.total_paid}
    </span>

    <span className="text-xs text-gray-500">
      {new Date(s.created_at).toLocaleDateString()}
    </span>
  </div>

  <p className="text-xs text-gray-500 mt-1 uppercase">
    {s.payment_method}
  </p>
</div>
))}



            {/* SETTLEMENT SECTION */}
            {selectedExpenses.length > 0 && (
  <div className="mt-6 p-6 rounded-xl bg-white space-y-4 shadow-md border">
    <div className="flex justify-between items-center">
  <span className="text-sm text-gray-500">Total Due</span>
  <span className="text-xl font-bold text-red-600">
    ₹{totalSelected}
  </span>
</div>

    <Input
  type="number"
  placeholder="Final amount paid"
  value={finalAmount}
  disabled={paymentMethod === "cash" && deductFromGalla}
  onChange={(e) => setFinalAmount(Number(e.target.value))}
/>

{!(paymentMethod === "cash" && deductFromGalla) && (
  <div>
    <label className="text-sm font-medium">Paid By</label>

    <Select
      value={partnerId ? String(partnerId) : "staff"}
      onValueChange={(value) => {
        if (value === "staff") setPartnerId(null);
        else setPartnerId(Number(value));
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Select payer" />
      </SelectTrigger>

      <SelectContent>
        {partners?.map((p: any) => (
          <SelectItem key={p.id} value={String(p.id)}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
)}

   <Select
  value={paymentMethod}
  onValueChange={(val) => setPaymentMethod(val as any)}
>
  <SelectTrigger>
    <SelectValue />
  </SelectTrigger>
  <SelectContent>
    {/* <SelectItem value="card">Card</SelectItem> */}
    <SelectItem value="online">Online</SelectItem>
    <SelectItem value="cash">Cash</SelectItem>
  </SelectContent>
</Select>

    {paymentMethod === "cash" && (
  <div className="flex items-center gap-2">
    <input
      type="checkbox"
      checked={deductFromGalla}
      onChange={(e) => setDeductFromGalla(e.target.checked)}
    />
    <label>Deduct from Galla</label>
  </div>
)}

{paymentMethod === "cash" && deductFromGalla && (
  <DenominationSelector
  breakdown={selectedNotes}
  setBreakdown={setSelectedNotes}
  title="Cash Given"
/>
)}

    <Button
  className="w-full "
  onClick={() => {
  if (!finalAmount || finalAmount <= 0) return;

  if (finalAmount > totalSelected) {
    alert("Settlement amount cannot exceed total due");
    return;
  }

  if (paymentMethod === "cash" && deductFromGalla) {
    const calculatedTotal = selectedNotes.reduce(
      (sum, n) => sum + n.note * n.qty,
      0
    );

    if (calculatedTotal !== finalAmount) {
      alert("Selected denominations do not match final amount");
      return;
    }
  }

  const denominationObject = Object.fromEntries(
    selectedNotes
      .filter(n => n.qty > 0)
      .map(n => [n.note, n.qty])
  );

  settleVendor({
  expenseIds: selectedExpenses,
  payment_method: paymentMethod,
  final_amount: finalAmount,
  deduct_from_galla: deductFromGalla,
  partnerId,
  ...(paymentMethod === "cash" && deductFromGalla && {
    denominations: denominationObject
  })
});

  setSelectedExpenses([]);
  setFinalAmount(0);
  setDeductFromGalla(false);
  setPartnerId(null);
  setSelectedNotes(DENOMS.map(d => ({ note: d, qty: 0 })));
}}
>
  Confirm Settlement
</Button>
  </div>
)}
          </div>
        )}
      </main>
    </div>
  );
}