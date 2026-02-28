import { Sidebar } from "@/components/Sidebar";
import { useCurrentBusinessDay } from "@/hooks/use-business-days";
import { useDailyReport,useWeeklyReport,useWeeklySummary,useMonthlyReport,useMonthlySummary } from "@/hooks/use-reports";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line
} from "recharts";


export default function Reports() {
    const [selectedDate, setSelectedDate] = useState(
  new Date().toISOString().split("T")[0]
);
  const { data: report, isLoading } = useDailyReport(selectedDate);
  const { data: weeklySummary } = useWeeklySummary();
const { data: monthlySummary } = useMonthlySummary();

const [reportType, setReportType] = useState<"daily" | "weekly" | "monthly">("daily");

const { data: weeklyData } = useWeeklyReport();
const { data: monthlyData } = useMonthlyReport();



  if (reportType === "daily" && isLoading) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-64 p-8 flex items-center justify-center">
        <Loader2 className="animate-spin w-6 h-6" />
      </main>
    </div>
  );
}

const chartData =
  reportType === "daily"
    ? [
        { date: selectedDate, total_sales: report?.totalSales || 0 }
      ]
    : reportType === "weekly"
    ? weeklyData || []
    : monthlyData || [];

    const activeReport =
  reportType === "daily"
    ? report
    : reportType === "weekly"
    ? weeklySummary
    : monthlySummary;


    const paymentData = [
  { name: "Cash", value: activeReport?.totalCash || 0 },
  { name: "Card", value: activeReport?.totalCard || 0 },
  { name: "Online", value: activeReport?.totalOnline || 0 },
  { name: "Credit", value: activeReport?.totalCreditGiven || 0 },
].filter(item => item.value > 0);

const handleExport = async () => {
  const token = localStorage.getItem("token");

  const res = await fetch(
    `${import.meta.env.VITE_API_URL}/reports/export?type=${reportType}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${reportType}-report.csv`;
  a.click();
};


function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return null;

  const isPositive = value > 0;

  return (
    <div
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${
        isPositive
          ? "bg-green-100 text-green-700"
          : "bg-red-100 text-red-700"
      }`}
    >
      {isPositive ? "▲" : "▼"} {Math.abs(value)}%
    </div>
  );
}

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />

      <main className="flex-1 ml-64 p-8">
        <div className="flex items-center justify-between mb-6">
  <h1 className="text-2xl font-bold capitalize">
    {reportType} Report
  </h1>

  <div className="flex bg-white rounded-lg shadow p-1">
    <input
  type="date"
  value={selectedDate}
  onChange={(e) => setSelectedDate(e.target.value)}
  className="border px-3 py-2 rounded-md"
/>
    {["daily", "weekly", "monthly"].map((type) => (
      <button
        key={type}
        onClick={() => setReportType(type as any)}
        className={`px-4 py-2 rounded-md text-sm font-medium transition ${
          reportType === type
            ? "bg-primary text-white"
            : "text-gray-600 hover:bg-gray-100"
        }`}
      >
        {type.charAt(0).toUpperCase() + type.slice(1)}
      </button>
    ))}
    <button
  onClick={handleExport}
  className="px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700"
>
  Export CSV
</button>
  </div>
</div>



        {/* ================== KPI CARDS ================== */}
        <div className="grid grid-cols-3 gap-6">
<div>
  <Card
    title="Total Sales"
    value={`₹${activeReport?.totalSales || 0}`}
  />
  {activeReport?.growthPercentage !== undefined && (
    <div className="mt-2">
      <GrowthBadge value={activeReport.growthPercentage} />
    </div>
  )}
</div>          <Card title="Cash Sales" value={`₹${activeReport?.totalCash || 0}`} />
          <Card title="Card Sales" value={`₹${activeReport?.totalCard || 0}`} />
          <Card title="Online Sales" value={`₹${activeReport?.totalOnline || 0}`} />
          <Card title="Credit Given" value={`₹${activeReport?.totalCreditGiven || 0}`} />
          <Card title="Total Orders" value={activeReport?.totalOrders || 0} />
          <Card title="Paid Orders" value={activeReport?.paidOrders || 0} />
          <Card title="Unpaid Orders" value={activeReport?.unpaidOrders || 0} />
          <Card title="Outstanding Amount" value={`₹${activeReport?.totalOutstanding || 0}`} />
        </div>

        {/* ================== CHARTS SECTION ================== */}
        <div className="grid grid-cols-2 gap-8 mt-12">
          
          {/* PAYMENT PIE */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Payment Breakdown</h2>

            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
  data={paymentData}
  dataKey="value"
  outerRadius={110}
  label={({ name, percent }) =>
    `${name} ${(percent * 100).toFixed(0)}%`
  }
  labelLine={false}
>
  {["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b"]
    .slice(0, paymentData.length)
    .map((color, index) => (
      <Cell key={index} fill={color} />
    ))}
</Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* ORDERS BAR */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border">
            <h2 className="text-lg font-semibold mb-4">Orders Overview</h2>

            <ResponsiveContainer width="100%" height={300}>
  <LineChart data={chartData}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Line
      type="monotone"
      dataKey="total_sales"
      stroke="#6366f1"
      strokeWidth={3}
      dot={{ r: 4 }}
    />
  </LineChart>
</ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border hover:shadow-md transition">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="text-3xl font-bold mt-2 text-gray-800">{value}</div>
    </div>
  );
}