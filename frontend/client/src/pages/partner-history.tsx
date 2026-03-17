import { Sidebar } from "@/components/Sidebar";
import { usePartnerHistory } from "@/hooks/use-partners";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";

export default function PartnerHistory() {

  const [, params] = useRoute("/partners/:id/ledger");

  const partnerId = Number(params?.id);

  const { data, isLoading } = usePartnerHistory(partnerId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  console.log("Partner ID:", partnerId);
console.log("Ledger data:", data);

  return (
    <div className="flex bg-gray-50 min-h-screen">

      <Sidebar />

      <main className="flex-1 ml-64 p-8">

        <h1 className="text-3xl font-bold mb-6">
          Partner Ledger
        </h1>

        <div className="bg-white rounded-xl shadow p-6">

          <table className="w-full text-left">

            <thead className="border-b">

              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Reason</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>

            </thead>

            <tbody>

              {data?.map((row: any, i: number) => (

                <tr key={i} className="border-b">

                  <td>
                    {new Date(row.created_at).toLocaleString()}
                  </td>

                  <td className="capitalize">
                    {row.type}
                  </td>

                  <td>
                    {row.reason || "-"}
                  </td>

                  <td>
                    {row.description || "-"}
                  </td>

                  <td
                    className={
                      row.type === "withdrawal"
                      ? "text-red-600"
                        : "text-green-600"
                        
                    }
                  >
                    ₹{row.amount}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </main>

    </div>
  );
}