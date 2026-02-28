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

export default function Vendors() {
  const { data: vendors, isLoading } = useVendorSummary();
  const { mutate: createVendor } = useCreateVendor();

  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

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

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-3xl font-bold mb-6">Vendors</h1>

        {/* ADD VENDOR */}
        <div className="mb-6 flex gap-3">
          <Input
            placeholder="Vendor name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Phone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
<Button type="button" onClick={handleCreate}>
  Add
</Button>        </div>

        {/* SUMMARY GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {vendors?.map((vendor: any) => (
            <Card
              key={vendor.id}
              className="cursor-pointer hover:shadow-lg"
              onClick={() => setSelectedVendor(vendor)}
            >
              <CardHeader>
                <CardTitle>{vendor.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Total Unpaid: ₹{vendor.total_unpaid}</p>
                <p>Total Paid: ₹{vendor.total_paid}</p>
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
                className="flex justify-between border p-3 mb-2 rounded"
              >
                <div>
                  ₹{expense.amount} — {expense.description}
                  <p className="text-sm text-gray-500">
                    {new Date(expense.created_at).toLocaleDateString()} by{" "}
                    {expense.uploaded_by}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedExpenses.includes(expense.id)}
                  onChange={() => toggleExpense(expense.id)}
                />
              </div>
            ))}

            <h3 className="text-xl font-semibold mt-8 mb-4">
  Settlement History
</h3>

{settlements?.map((s: any) => (
  <div
    key={s.id}
    className="border p-4 rounded mb-2 bg-gray-50"
  >
    <div className="flex justify-between">
      <span>₹{s.total_paid}</span>
      <span className="text-sm text-gray-500">
        {new Date(s.created_at).toLocaleDateString()}
      </span>
    </div>
    <div className="text-sm text-gray-600">
      Method: {s.payment_method}
    </div>
  </div>
))}

            {/* SETTLEMENT SECTION */}
            {selectedExpenses.length > 0 && (
  <div className="mt-6 border p-6 rounded bg-white space-y-4">
    <div className="text-lg font-semibold">
      Total Due: ₹{totalSelected}
    </div>

    <Input
  type="number"
  placeholder="Final amount paid"
  value={finalAmount}
  disabled={paymentMethod === "cash" && deductFromGalla}
  onChange={(e) => setFinalAmount(Number(e.target.value))}
/>

    <select
      value={paymentMethod}
      onChange={(e) =>
        setPaymentMethod(e.target.value as any)
      }
      className="border p-2 w-full"
    >
      <option value="card">Card</option>
      <option value="online">Online</option>
<option value="cash">Cash</option>    </select>

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
  className="w-full"
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
  ...(paymentMethod === "cash" && deductFromGalla && {
    denominations: denominationObject
  })
});

  setSelectedExpenses([]);
  setFinalAmount(0);
  setDeductFromGalla(false);
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