import { Sidebar } from "@/components/Sidebar";
import { usePartnerLedger } from "@/hooks/use-partners";
import { Loader2 } from "lucide-react";
import { useLocation } from "wouter";

export default function PartnerLedger() {

  const { data, isLoading } = usePartnerLedger();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen">

      <Sidebar />

      <main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">

        <h1 className="text-3xl font-bold mb-6">
          Partner Ledger
        </h1>

        {/* ================= SUMMARY ================= */}

       <div className="bg-white p-6 rounded-xl shadow border mb-8 space-y-4">

  <h2 className="text-lg font-semibold">Business Overview</h2>

  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

    <div className="p-4 rounded-lg bg-green-50">
      <p className="text-sm text-gray-500">Total Sales</p>
      <p className="text-2xl font-bold text-green-600">
        ₹{data.total_sales}
      </p>
    </div>

    <div className="p-4 rounded-lg bg-red-50">
      <p className="text-sm text-gray-500">Total Expenses</p>
      <p className="text-2xl font-bold text-red-600">
        ₹{data.total_expenses}
      </p>
    </div>

    <div className={`p-4 rounded-lg ${
      data.total_profit >= 0 ? "bg-blue-50" : "bg-yellow-50"
    }`}>
      <p className="text-sm text-gray-500">Net Result</p>

      <p className={`text-2xl font-bold ${
        data.total_profit >= 0
          ? "text-blue-600"
          : "text-yellow-600"
      }`}>
        ₹{data.total_profit}
      </p>

      {data.total_profit < 0 && (
        <p className="text-xs text-yellow-700 mt-1">
          ⚠ Loss — expenses exceed sales
        </p>
      )}
    </div>

  </div>
</div>

        {/* ================= PARTNER CARDS ================= */}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {data.partners.map((p: any) => {

            const positive = p.net_balance >= 0;

            return (
              <div
  key={p.id}
  onClick={() => navigate(`/partners/${p.id}/ledger`)}
className="bg-white p-6 rounded-xl shadow border cursor-pointer hover:shadow-xl hover:scale-[1.01] transition-all">

                <div className="flex justify-between items-center">
  <h2 className="text-lg font-bold">{p.name}</h2>

  <span className="text-xs text-gray-400">
    Tap to view →
  </span>

  <span className={`text-xs px-2 py-1 rounded-full ${
    p.net_balance >= 0
      ? "bg-green-100 text-green-700"
      : "bg-red-100 text-red-700"
  }`}>
    {p.net_balance >= 0 ? "In Profit" : "Owes"}
  </span>
</div>


                <div className="space-y-3 text-sm">
                  

                  

                  <div className="flex justify-between">
  <span className="text-gray-500">Deposits</span>
  <span className="font-semibold text-green-600">
    ₹{p.deposits}
  </span>
</div>

<div className="flex justify-between">
  <span className="text-gray-500">Withdrawals</span>
  <span className="font-semibold text-red-600">
    ₹{p.withdrawals}
  </span>
</div>

<div className="flex justify-between">
  <span className="text-gray-500">Expenses Paid</span>
  <span className="font-semibold text-green-500">
    ₹{p.expenses_paid}
  </span>
</div>

<div className="flex justify-between">
  <span className="text-gray-500">Profit Share</span>
  <span className="font-semibold text-blue-600">
    ₹{Math.round(p.profit_share)}
  </span>
</div>

                </div>

                <div className="border-t pt-4 flex justify-between items-center">
  <span className="text-sm text-gray-500">Net Balance</span>

  <span
    className={`text-lg font-bold ${
      positive ? "text-green-600" : "text-red-600"
    }`}
  >
    ₹{Math.round(p.net_balance)}
  </span>
</div>

<div className={`mt-4 p-3 rounded-lg text-center ${
  p.net_balance >= 0
    ? "bg-green-50 text-green-700"
    : "bg-red-50 text-red-700"
}`}>
  {p.net_balance >= 0
    ? `Businesss owes ${p.name}`
    : `${p.name} owes business`}
</div>

              </div>
            );
          })}

        </div>

      </main>

    </div>
  );
}