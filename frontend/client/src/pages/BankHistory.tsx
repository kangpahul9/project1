import { Sidebar } from "@/components/Sidebar";
import { useBankHistory } from "@/hooks/use-bank";
import { Loader2 } from "lucide-react";

export default function BankHistory() {
  const { data, isLoading } = useBankHistory();

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <h1 className="text-3xl font-bold mb-6">Bank Ledger</h1>

        <div className="bg-white rounded-xl shadow border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 text-left">
              <tr>
                <th className="p-3">Amount</th>
                <th className="p-3">Type</th>
                <th className="p-3">Source</th>
                <th className="p-3">Description</th>
                <th className="p-3">Date</th>
              </tr>
            </thead>

            <tbody>
              {data?.map((tx: any) => (
                <tr key={tx.id} className="border-t">
                  <td className="p-3 font-semibold">
                    ₹{Number(tx.amount).toLocaleString()}
                  </td>

                  <td
                    className={`p-3 font-medium ${
                      tx.type === "credit"
                        ? "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    {tx.type.toUpperCase()}
                  </td>

                  <td className="p-3 capitalize">
                    {tx.source.replace("_", " ")}
                  </td>

                  <td className="p-3 text-muted-foreground">
                    {tx.description || "-"}
                  </td>

                  <td className="p-3 text-xs text-gray-500">
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
      </main>
    </div>
  );
}