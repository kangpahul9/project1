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

export default function WithdrawalHistory() {
  const [range, setRange] = useState<"weekly" | "monthly" | "custom">("weekly");
  const [mode, setMode] = useState<"withdrawal" | "deposit">("withdrawal");

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

    const headers = ["Date", "Amount", "Reason", "User"];
    const rows = data.map((w: any) => [
      new Date(w.created_at).toLocaleString(),
      w.amount,
      w.reason,
      w.user_name || "-",
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
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <h1 className="text-3xl font-bold mb-6">
          {mode === "withdrawal"
            ? "Withdrawal Analytics"
            : "Deposit Analytics"}
        </h1>

        {/* TOGGLE */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setMode("withdrawal")}
            className={`px-4 py-2 rounded ${
              mode === "withdrawal"
                ? "bg-red-600 text-white"
                : "bg-white"
            }`}
          >
            Withdrawals
          </button>

          <button
            onClick={() => setMode("deposit")}
            className={`px-4 py-2 rounded ${
              mode === "deposit"
                ? "bg-green-600 text-white"
                : "bg-white"
            }`}
          >
            Deposits
          </button>

          <button
            onClick={exportCSV}
            className="ml-auto bg-green-600 text-white px-4 py-2 rounded"
          >
            Export CSV
          </button>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-3 gap-6 mb-8">

  {/* TOTAL WITHDRAWALS */}
  <div className="bg-white p-6 rounded-xl shadow">
    <h3>Total Withdrawals</h3>
    <p className="text-2xl font-bold mt-2 text-red-600">
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
            <div className="bg-white rounded-xl shadow p-6 mb-8">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart layout="vertical" data={reasonBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="reason" width={150} />
                  <Tooltip />
                  <Bar dataKey="amount" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl shadow p-6">
              <table className="w-full text-left">
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
                    <tr key={w.id}>
                      <td>{new Date(w.created_at).toLocaleString()}</td>
                      <td>₹{w.amount}</td>
                      <td>{w.reason}</td>
                      <td>{w.user_name || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}