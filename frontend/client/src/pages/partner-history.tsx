import { Sidebar } from "@/components/Sidebar";
import { usePartnerHistory } from "@/hooks/use-partners";
import { useRoute } from "wouter";
import { Loader2 } from "lucide-react";

export default function PartnerHistory() {

  const [, params] = useRoute("/partners/:id/ledger");

  const partnerId = Number(params?.id);

  let runningBalance = 0;

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

      <main className="flex-1 ml-0 lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">

        <div className="mb-6">
<h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">
      Partner Ledger
  </h1>
  <p className="text-sm text-gray-500">
    Track all transactions with this partner
  </p>

  
</div>



        <div className="space-y-4">

          {data?.length === 0 && (
  <div className="text-center py-12 text-gray-400">
    No transactions yet.
  </div>
)}



 {data?.map((row: any, i: number) => {

  if (row.type === "withdrawal" || row.type === "expense") {
    runningBalance -= Number(row.amount);
  } else {
    runningBalance += Number(row.amount);
  }

  const isOut = row.type === "withdrawal" || row.type === "expense";

  return (
    <div
      key={i}
className={`bg-white p-4 sm:p-5 lg:p-6 rounded-xl shadow-sm border-l-4 ${
  isOut ? "border-l-red-500" : "border-l-green-500"
} hover:shadow-md transition space-y-3`}    >

      {/* TOP ROW */}
      <div className="flex justify-between items-center">

        <div>
<p className="text-xs sm:text-sm lg:text-xl text-gray-400 ">
              {new Date(row.created_at).toLocaleString()}
          </p>

          <span className={`inline-block mt-1 text-xs sm:text-sm lg:text-xl px-2 py-0.5 rounded-full ${
            isOut
              ? "bg-red-100 text-red-700"
              : "bg-green-100 text-green-700"
          }`}>
            {isOut ? "Debit" : "Credit"}
          </span>
        </div>

        <p className={`text-lg sm:text-xl lg:text-2xl font-bold ${
          isOut ? "text-red-600" : "text-green-600"
        }`}>
          {isOut ? "-" : "+"}₹{row.amount}
        </p>

      </div>

      {/* DESCRIPTION */}
      <p className="text-sm text-gray-700 lg:text-2xl">
        {row.reason || row.description || "-"}
      </p>

      {/* RUNNING BALANCE */}
      <div className="flex justify-between items-center border-t pt-2 text-xs lg:text-base text-gray-500">

<span className="text-gray-400">Running Balance</span>
<span className={`text-sm font-bold ${          runningBalance >= 0
            ? "text-green-600"
            : "text-red-600"
        }`}>
          ₹{runningBalance}
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