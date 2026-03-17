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

      <main className="flex-1 ml-64 p-8">

        <h1 className="text-3xl font-bold mb-6">
          Partner Ledger
        </h1>

        {/* ================= SUMMARY ================= */}

        <div className="grid grid-cols-3 gap-6 mb-8">

          <div className="bg-white p-6 rounded-xl shadow">
            <h3>Total Sales</h3>
            <p className="text-2xl font-bold mt-2 text-green-600">
              ₹{data.total_sales}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3>Total Expenses</h3>
            <p className="text-2xl font-bold mt-2 text-red-600">
              ₹{data.total_expenses}
            </p>
          </div>

          <div className="bg-white p-6 rounded-xl shadow">
            <h3>Total Profit</h3>
            <p className="text-2xl font-bold mt-2 text-blue-600">
              ₹{data.total_profit}
            </p>
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
  className="bg-white p-6 rounded-xl shadow border cursor-pointer hover:shadow-lg transition"
              >

                <h2 className="text-lg font-bold mb-4">
                  {p.name}
                </h2>

                <div className="space-y-2 text-sm">

                  <div className="flex justify-between">
                    <span>Deposits</span>
                    <span className="text-green-600">
                      ₹{p.deposits}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Withdrawals</span>
                    <span className="text-red-600">
                      ₹{p.withdrawals}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Expenses Paid</span>
                    <span className="text-green-500">
                      ₹{p.expenses_paid}
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span>Profit Share</span>
                    <span className="text-blue-600">
                      ₹{Math.round(p.profit_share)}
                    </span>
                  </div>

                </div>

                <div className="border-t mt-4 pt-4 flex justify-between font-semibold">

                  <span>Net Balance</span>

                  <span
                    className={
                      positive
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  >
                    ₹{Math.round(p.net_balance)}
                  </span>

                </div>

              </div>
            );
          })}

        </div>

      </main>

    </div>
  );
}