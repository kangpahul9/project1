import { Sidebar } from "@/components/Sidebar";
import { useBankHistory } from "@/hooks/use-bank";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

export default function BankHistory() {
  const { data, isLoading } = useBankHistory();

  const sortedData = useMemo(() => {
  return [...(data || [])].sort(
    (a: any, b: any) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime()
  );
}, [data]);

const dataWithBalance = useMemo(() => {
  let balance = 0;

  return sortedData.map((tx: any) => {
    const amount = Number(tx.amount);

    if (tx.type === "credit") {
      balance += amount;
    } else {
      balance -= amount;
    }

    return {
      ...tx,
      runningBalance: balance,
    };
  });
}, [sortedData]);

const displayData = [...dataWithBalance].reverse();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen pt-16 lg:pt-8">
      <Sidebar />

      <main className="flex-1 min-w-0 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <h1 className="text-3xl font-bold mb-6">Bank Ledger</h1>

        {/* MOBILE VIEW */}
<div className="space-y-3 sm:hidden">
  {displayData.map((tx: any) => (
    <div
      key={tx.id}
      className="bg-white rounded-2xl shadow-sm border p-4 flex items-center justify-between"
    >
      <div>
        <p className="font-semibold text-sm capitalize">
          {tx.source.replace("_", " ")}
        </p>

        <p className="text-xs text-gray-500">
          {new Date(tx.created_at).toLocaleString()}
        </p>

        {tx.description && (
          <p className="text-xs text-gray-400 mt-1">
            {tx.description}
          </p>
        )}
      </div>

      <div className="text-right">
  <p
    className={`font-bold text-sm ${
      tx.type === "credit"
        ? "text-green-600"
        : "text-red-600"
    }`}
  >
    {tx.type === "credit" ? "+" : "-"}₹
    {Number(tx.amount).toLocaleString()}
  </p>

  <p className="text-[11px] text-gray-500 mt-1">
    Bal: ₹{tx.runningBalance.toLocaleString()}
  </p>

  <span
    className={`text-[10px] px-2 py-1 rounded-full font-medium ${
      tx.type === "credit"
        ? "bg-green-100 text-green-700"
        : "bg-red-100 text-red-700"
    }`}
  >
    {tx.type.toUpperCase()}
  </span>
</div>
    </div>
  ))}
</div>

<div className="bg-white hidden sm:block rounded-2xl shadow-sm border p-4 sm:p-5 overflow-hidden">
  <div className="-mx-4 sm:mx-0 overflow-x-auto">
<table className="min-w-[700px] w-full text-sm">
              <thead className="bg-gray-100 text-left">
              <tr>
                <th className="px-3 py-3 whitespace-nowrap">Amount</th>
                <th className="px-3 py-3 whitespace-nowrap">Balance</th>
                <th className="px-3 py-3 whitespace-nowrap">Type</th>
                <th className="px-3 py-3 whitespace-nowrap">Source</th>
                <th className="px-3 py-3 whitespace-nowrap">Description</th>
                <th className="px-3 py-3 whitespace-nowrap">Date</th>
              </tr>
            </thead>

            

            <tbody>
              {displayData.map((tx: any) => (
                <tr key={tx.id} className="border-t">
                  <td className="px-3 py-3 whitespace-nowrap font-semibold">
                    ₹{Number(tx.amount).toLocaleString()}
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
  ₹{tx.runningBalance.toLocaleString()}
</td>

                  <td
                    className={`px-3 py-3 whitespace-nowrap font-medium ${
                      tx.type === "credit"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {tx.type.toUpperCase()}
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap capitalize">
                    {tx.source.replace("_", " ")}
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">
                    {tx.description || "-"}
                  </td>

                  <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500">
                    {new Date(tx.created_at).toLocaleString()}
                  </td>
                </tr>
              ))}

              {data?.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center p-6 text-gray-500">
                    No transactions yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </div>
      </main>
    </div>
  );
}