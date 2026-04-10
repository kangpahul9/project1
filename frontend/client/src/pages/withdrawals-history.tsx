import {
  useWithdrawalHistory,
  useDepositHistory,
} from "@/hooks/use-withdraw";
import { Sidebar } from "@/components/Sidebar";
import { Loader2 } from "lucide-react";
import { useState, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { useSettings } from "@/hooks/use-settings";

export default function WithdrawalHistory() {
  const [range, setRange] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [mode, setMode] = useState<"withdrawal" | "deposit">("withdrawal");

  const { data: settings } = useSettings();

  const today = new Date();

  const computedFilters = useMemo(() => {
    if (range === "weekly") {
      const weekAgo = new Date();
      weekAgo.setDate(today.getDate() - 7);
      return {
        from: weekAgo.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      };
    }

    if (range === "monthly") {
      const monthAgo = new Date();
      monthAgo.setMonth(today.getMonth() - 1);
      return {
        from: monthAgo.toISOString().split("T")[0],
        to: today.toISOString().split("T")[0],
      };
    }

    return {};
  }, [range]);

  const { data: withdrawalData, isLoading: loadingWithdrawals } =
    useWithdrawalHistory(computedFilters);

  const { data: depositData, isLoading: loadingDeposits } =
    useDepositHistory(computedFilters);

  const data = mode === "withdrawal" ? withdrawalData : depositData;
  const isLoading =
    mode === "withdrawal" ? loadingWithdrawals : loadingDeposits;

  const totalAmount = useMemo(() => {
    return (
      data?.reduce((sum: number, w: any) => sum + Number(w.amount), 0) || 0
    );
  }, [data]);
const totalWithdrawals = useMemo(() => {
  return (
    withdrawalData?.reduce(
      (sum: number, w: any) => sum + Number(w.amount),
      0
    ) || 0
  );
}, [withdrawalData]);

const totalDeposits = useMemo(() => {
  return (
    depositData?.reduce(
      (sum: number, d: any) => sum + Number(d.amount),
      0
    ) || 0
  );
}, [depositData]);

const netImpact = totalDeposits - totalWithdrawals;

  const totalTransactions = data?.length || 0;

  const reasonBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    data?.forEach((w: any) => {
      map[w.reason] = (map[w.reason] || 0) + Number(w.amount);
    });

    return Object.entries(map).map(([reason, amount]) => ({
      reason,
      amount,
    }));
  }, [data]);

  const exportCSV = () => {
    if (!data) return;

    const headers = ["Date", "Amount", "Reason", "Owner"];
    const rows = data.map((w: any) => [
      new Date(w.created_at).toLocaleString(),
      w.amount,
      w.reason,
      w.owner_name || "-"
    ]);

    const csv =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csv);
    link.download =
      mode === "withdrawal" ? "withdrawals.csv" : "deposits.csv";
    link.click();
  };

  return (
    <div className="flex bg-gray-50 min-h-screen overflow-hidden">
      <Sidebar />
<main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 overflow-y-auto">
         <div className="flex items-center justify-between mb-6">
  <div>
    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
      {mode === "withdrawal"
            ? "Withdrawal Analytics"
            : "Deposit Analytics"}
    </h1>
    <p className="text-sm text-gray-500">
      Track cash flow, withdrawals & deposits
    </p>
  </div>
</div>

        {/* TOGGLE */}
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl w-fit mb-6">

  <button
    onClick={() => setMode("withdrawal")}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
      mode === "withdrawal"
        ? "bg-white shadow text-red-600"
        : "text-gray-600"
    }`}
  >
    Withdrawals
  </button>

  <button
    onClick={() => setMode("deposit")}
    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
      mode === "deposit"
        ? "bg-white shadow text-green-600"
        : "text-gray-600"
    }`}
  >
    Deposits
  </button>

  <button
    onClick={exportCSV}
    className="ml-4 bg-black text-white px-3 py-2 rounded-lg text-sm"
  >
    Export
  </button>

</div>

<div className="mb-4 text-sm text-gray-500">
  {totalTransactions} transactions in this period
</div>

        {/* SUMMARY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">

  {/* TOTAL WITHDRAWALS */}
  <div className="bg-white p-5 rounded-2xl shadow-sm border hover:shadow-md transition">
  <p className="text-xs text-gray-500">Total Withdrawals</p>
  <p className="text-2xl font-bold text-red-600 mt-1">
    ₹{totalWithdrawals}
  </p>
</div>

  {/* TOTAL DEPOSITS */}
  <div className="bg-white p-6 rounded-xl shadow">
    <h3>Total Deposits</h3>
    <p className="text-2xl font-bold mt-2 text-green-600">
      ₹{totalDeposits}
    </p>
  </div>

  {/* NET IMPACT */}
  <div className="bg-white p-6 rounded-xl shadow">
    <h3>Net Impact</h3>
    <p
      className={`text-2xl font-bold mt-2 ${
        netImpact >= 0 ? "text-green-600" : "text-red-600"
      }`}
    >
      ₹{netImpact}
    </p>
  </div>

</div>

        {isLoading ? (
          <Loader2 className="animate-spin" />
        ) : (
          <>
            <div className="bg-white rounded-2xl shadow-sm border p-5 mb-8 overflow-hidden">
  <ResponsiveContainer width="100%" height={250}>
    <BarChart layout="vertical" data={reasonBreakdown}>
      <CartesianGrid strokeDasharray="2 2" stroke="#eee" />
      <XAxis type="number" hide />
      <YAxis 
        type="category" 
        dataKey="reason" 
        width={50}
        tick={{ fontSize: 12 }}
      />
      <Tooltip />
      <Bar dataKey="amount" radius={[6, 6, 6, 6]} />
    </BarChart>
  </ResponsiveContainer>
</div>

            <div className="bg-white rounded-xl shadow p-6">
              <div className="overflow-x-auto">
  <table className="w-full text-left min-w-[600px]">
                <thead className="border-b">
                  <tr>
                    <th className="py-2">Date</th>
                    <th>Amount</th>
                    <th>Reason</th>
                    <th>User</th>
                  </tr>
                </thead>
                <tbody>
  {data?.map((w: any) => (
    <tr key={w.id} className="border-b last:border-0">
      <td className="py-3 text-sm text-gray-600">
        {new Date(w.created_at).toLocaleString()}
      </td>
      <td className="font-semibold">
        ₹{w.amount}
      </td>
      <td className="text-gray-600">{w.reason}</td>
      <td className="text-gray-500 text-sm">
        {w.owner_name || "-"}
      </td>
    </tr>
  ))}
</tbody>
              </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}