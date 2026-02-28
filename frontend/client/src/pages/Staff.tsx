import { Sidebar } from "@/components/Sidebar";
import { useStaffWithBalance,Staff as StaffType,useStaffSummary,useStaffTransaction, useStaffHistory,useUpdateStaff, useDeactivateStaff } from "@/hooks/use-staff";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCreateStaff } from "@/hooks/use-staff";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { DenominationSelector } from "@/components/DenominationSelector";
import { StatCard } from "@/components/StatCard";
import {
  Wallet,
  IndianRupee,
  AlertTriangle,
  TrendingUp
} from "lucide-react";



export default function Staff() {
  const { data: currentDay } = useCurrentBusinessDay();
  const { data: staff } = useStaffWithBalance();
  const { mutate: createStaff } = useCreateStaff();
  const { mutate: addTransaction } = useStaffTransaction();
  const { data: summary } = useStaffSummary();
  const { mutate: updateStaff } = useUpdateStaff();
const { mutate: deactivateStaff } = useDeactivateStaff();

const [selectedStaff, setSelectedStaff] = useState<StaffType | null>(null);
const [transactionOpen, setTransactionOpen] = useState(false);
const [amount, setAmount] = useState(0);
const [type, setType] = useState<"payment" | "adjustment">("payment");
const [reason, setReason] = useState("");
const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "online">("cash");
const [deductFromGalla, setDeductFromGalla] = useState(false);
const [historyOpen, setHistoryOpen] = useState(false);
const [historyStaff, setHistoryStaff] = useState<StaffType | null>(null);
const [editOpen, setEditOpen] = useState(false);
const [editStaff, setEditStaff] = useState<StaffType | null>(null);
const [editForm, setEditForm] = useState({
  name: "",
  role: "",
  phone: "",
  salary: "",
});


const { data: history } = useStaffHistory(historyStaff?.id || null);
const [selectedNotes, setSelectedNotes] = useState([
  { note: 500, qty: 0 },
  { note: 200, qty: 0 },
  { note: 100, qty: 0 },
  { note: 50, qty: 0 },
  { note: 20, qty: 0 },
  { note: 10, qty: 0 },
  { note: 5, qty: 0 },
  { note: 2, qty: 0 },
  { note: 1, qty: 0 },
]);

const [open, setOpen] = useState(false);
const [newStaff, setNewStaff] = useState({
  name: "",
  role: "",
  phone: "",
  salary: "",
  opening_balance: "",
});
const openTransactionModal = (member: StaffType) => {
  setSelectedStaff(member);
  setAmount(0);
  setReason("");
  setType("payment");
  setTransactionOpen(true);
};

const openEditModal = (member: StaffType) => {
  setEditStaff(member);
  setEditForm({
    name: member.name,
    role: member.role || "",
    phone: member.phone || "",
    salary: String(member.salary),
  });
  setEditOpen(true);
};

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <div className="flex justify-between items-center mb-6">
  <h1 className="text-3xl font-bold">Staff Members</h1>

  <Button onClick={() => setOpen(true)}>
    Add Staff
  </Button>
</div>
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
  <StatCard
    title="Total Salary"
    value={`₹${summary?.totalSalary || 0}`}
    icon={Wallet}
  />

  <StatCard
    title="Paid This Month"
    value={`₹${summary?.paidThisMonth || 0}`}
    icon={IndianRupee}
  />

  <StatCard
    title="Unpaid This Month"
    value={`₹${summary?.unpaidThisMonth > 0 ? summary.unpaidThisMonth : 0}`}
    icon={AlertTriangle}
  />

  <StatCard
    title="Salary Credit"
    value={`₹${summary?.totalCredit || 0}`}
    icon={TrendingUp}
  />
</div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
{staff?.map((member: StaffType) => (
              <Card
  key={member.id}
  className="hover:shadow-lg transition-all cursor-pointer"
  onClick={() => {
    setHistoryStaff(member);
    setHistoryOpen(true);
  }}
>
  <CardHeader className="flex flex-row items-center justify-between">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg">
        {member.name.charAt(0)}
      </div>
      <CardTitle>{member.name}</CardTitle>
    </div>

    <Badge variant={member.is_active ? "default" : "destructive"}>
      {member.is_active ? "Active" : "Inactive"}
    </Badge>
  </CardHeader>

  <CardContent>
    <div className="flex justify-between text-sm mt-2">
      <span>Role</span>
      <span className="capitalize font-medium">{member.role}</span>
    </div>

    <div className="flex justify-between text-sm mt-2">
      <span>Salary</span>
      <span>₹{member.salary}</span>
    </div>

    <div className="flex justify-between text-sm mt-2">
      <span>Balance</span>
      <span className={`font-semibold ${
        Number(member.balance) > 0 ? "text-red-600" : "text-green-600"
      }`}>
        ₹{member.balance}
      </span>
      
    </div>

  <div className="mt-4 flex gap-2">
  <Button
    size="sm"
    variant="outline"
    onClick={(e) => {
      e.stopPropagation();
      openTransactionModal(member);
    }}
  >
    Pay
  </Button>

  <Button
    size="sm"
    variant="secondary"
    onClick={(e) => {
      e.stopPropagation();
      openEditModal(member);
    }}
  >
    Edit
  </Button>
</div>

  </CardContent>
</Card>
          ))}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Add New Staff</DialogTitle>
    </DialogHeader>

    <div className="space-y-4 mt-4">
      <Input
        placeholder="Name"
        value={newStaff.name}
        onChange={(e) =>
          setNewStaff({ ...newStaff, name: e.target.value })
        }
      />

      <Input
        placeholder="Role"
        value={newStaff.role}
        onChange={(e) =>
          setNewStaff({ ...newStaff, role: e.target.value })
        }
      />

      <Input
        placeholder="Phone"
        value={newStaff.phone}
        onChange={(e) =>
          setNewStaff({ ...newStaff, phone: e.target.value })
        }
      />

      <Input
        type="number"
        placeholder="Salary"
        value={newStaff.salary}
        onChange={(e) =>
          setNewStaff({
            ...newStaff,
            salary: e.target.value,
          })
        }
      />

      <Input
  type="number"
  placeholder="Opening Balance (optional)"
  value={newStaff.opening_balance}
  onChange={(e) =>
    setNewStaff({
      ...newStaff,
      opening_balance: e.target.value,
    })
  }
/>

      <Button
        className="w-full"
        onClick={() => {
          if (!newStaff.name.trim()) return;

            createStaff(newStaff, {
              onSuccess: () => {
                setOpen(false);
                setNewStaff({
  name: "",
  role: "",
  phone: "",
  salary: "",
  opening_balance: "",
});
              },
            });
        }}
      >
        Save Staff
      </Button>
    </div>
  </DialogContent>
</Dialog>
<Dialog open={transactionOpen} onOpenChange={setTransactionOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Pay / Adjust Staff</DialogTitle>
      <DialogDescription>
    Record staff payment or balance adjustment.
  </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 mt-4">

  <select
    value={type}
    onChange={(e) => setType(e.target.value as any)}
    className="w-full border rounded-md p-2"
  >
    <option value="payment">Payment (You Pay Staff)</option>
    <option value="adjustment">Adjustment (Manual Correction)</option>
  </select>

  <select
    value={paymentMethod}
    onChange={(e) =>
      setPaymentMethod(e.target.value as any)
    }
    className="w-full border rounded-md p-2"
  >
    <option value="cash">Cash</option>
    <option value="card">Card</option>
    <option value="online">Online</option>
  </select>

  {paymentMethod === "cash" && (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        checked={deductFromGalla}
        onChange={(e) =>
          setDeductFromGalla(e.target.checked)
        }
      />
      <label>Deduct from Galla</label>
    </div>
  )}

  {paymentMethod === "cash" && deductFromGalla && (
  <DenominationSelector
    breakdown={selectedNotes}
    setBreakdown={setSelectedNotes}
    title="Cash Used"
  />
)}

  <Input
    type="number"
    placeholder="Amount"
    value={amount || ""}
    onChange={(e) =>
      setAmount(Number(e.target.value))
    }
  />

  <Input
    placeholder="Reason"
    value={reason}
    onChange={(e) =>
      setReason(e.target.value)
    }
  />

  <Button
    className="w-full"
    onClick={() => {
      if (!selectedStaff || amount <= 0) return;

      const denominationObject = Object.fromEntries(
        selectedNotes
          .filter((n) => n.qty > 0)
          .map((n) => [n.note, n.qty])
      );

      addTransaction({
  staffId: selectedStaff.id,
  amount,
  type,
  reason,
  payment_method: paymentMethod,
  deduct_from_galla: deductFromGalla,
  denominations:
    paymentMethod === "cash" && deductFromGalla
      ? denominationObject
      : undefined,
  businessDayId: currentDay?.id,
},
        {
          onSuccess: () => {
            setTransactionOpen(false);
  setDeductFromGalla(false);
  setSelectedNotes([
    { note: 500, qty: 0 },
    { note: 200, qty: 0 },
    { note: 100, qty: 0 },
    { note: 50, qty: 0 },
    { note: 20, qty: 0 },
    { note: 10, qty: 0 },
    { note: 5, qty: 0 },
    { note: 2, qty: 0 },
    { note: 1, qty: 0 },
  ]);
          },
        }
      );
    }}
  >
    Confirm
  </Button>
</div>
  </DialogContent>
</Dialog>

<Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
  <DialogContent className="max-w-3xl">
    <DialogHeader>
      <DialogTitle>
        Salary History — {historyStaff?.name}
      </DialogTitle>
      <DialogDescription>
        Complete payment and adjustment history.
      </DialogDescription>
    </DialogHeader>

    <div className="mt-4 space-y-3 max-h-[400px] overflow-y-auto">
      {history?.length === 0 && (
        <p className="text-muted-foreground">
          No transactions found.
        </p>
      )}

      {history && (() => {
  let runningBalance = 0;

  return history.map((txn: any) => {
    if (txn.type === "payment") {
      runningBalance -= Number(txn.amount);
    } else {
      runningBalance += Number(txn.amount);
    }

    return (
      <div
        key={txn.id}
        className="border rounded-lg p-4 flex justify-between items-center"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {txn.type === "payment" ? (
              <IndianRupee size={16} className="text-green-600" />
            ) : (
              <AlertTriangle size={16} className="text-amber-600" />
            )}
            <span className="font-medium capitalize">
              {txn.type}
            </span>

            {txn.payment_method && (
              <Badge variant="secondary">
                {txn.payment_method}
              </Badge>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            {new Date(txn.created_at).toLocaleString()}
          </p>

          {txn.reason && (
            <p className="text-xs text-gray-500">
              {txn.reason}
            </p>
          )}
        </div>

        <div className="text-right space-y-1">
          <div
            className={`font-semibold ${
              txn.type === "payment"
                ? "text-green-600"
                : "text-amber-600"
            }`}
          >
            ₹{txn.amount}
          </div>

          <div className="text-xs text-muted-foreground">
            Balance: ₹{runningBalance}
          </div>
        </div>
      </div>
    );
  });
})()}
    </div>
  </DialogContent>
</Dialog>
<Dialog open={editOpen} onOpenChange={setEditOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Edit Staff</DialogTitle>
      <DialogDescription>
        Update staff details or deactivate.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4 mt-4">
      <Input
        placeholder="Name"
        value={editForm.name}
        onChange={(e) =>
          setEditForm({ ...editForm, name: e.target.value })
        }
      />

      <Input
        placeholder="Role"
        value={editForm.role}
        onChange={(e) =>
          setEditForm({ ...editForm, role: e.target.value })
        }
      />

      <Input
        placeholder="Phone"
        value={editForm.phone}
        onChange={(e) =>
          setEditForm({ ...editForm, phone: e.target.value })
        }
      />

      <Input
        type="number"
        placeholder="Salary"
        value={editForm.salary}
        onChange={(e) =>
          setEditForm({ ...editForm, salary: e.target.value })
        }
      />

      <Button
        className="w-full"
        onClick={() => {
          if (!editStaff) return;

          updateStaff({
            id: editStaff.id,
            name: editForm.name,
            role: editForm.role,
            phone: editForm.phone,
            salary: Number(editForm.salary),
            is_active: true,
          });

          setEditOpen(false);
        }}
      >
        Save Changes
      </Button>

      <Button
        variant="destructive"
        className="w-full"
        onClick={() => {
          if (!editStaff) return;

          deactivateStaff(editStaff.id);
          setEditOpen(false);
        }}
      >
        Deactivate Staff
      </Button>
    </div>
  </DialogContent>
</Dialog>
      </main>
    </div>
  );
}
