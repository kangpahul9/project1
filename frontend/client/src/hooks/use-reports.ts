import { useQuery } from "@tanstack/react-query";
import { get } from "@/lib/api";

// ================= TYPES =================

// 🔥 FULL DAILY
interface DailyReport {
  totalSales: number;
  totalOrders: number;
  paidOrders: number;
  unpaidOrders: number;
  totalCreditGiven: number;
  totalOutstanding: number;

  totalCash: number;
  totalCard: number;
  totalOnline: number;

  totalRefunds: number;
  netSales: number;
  growthPercentage?: number;
}

// 🔥 CHART
interface ChartPoint {
  date: string;
  totalSales: number;
  refunds: number;
  netSales: number;
}

// 🔥 SUMMARY (weekly/monthly)
interface SummaryReport extends DailyReport {
  previousSales: number;
  growthPercentage: number;
}

// 🔥 TOP PRODUCTS
interface TopProduct {
  item_name: string;
  total_quantity: number;
  total_revenue: number;
}

// 🔥 PRODUCT ANALYTICS
interface ProductAnalytics {
  summary: {
    total_quantity: number;
    total_revenue: number;
  };
  trend: {
    date: string;
    qty: number;
    revenue: number;
  }[];
}

// 🔥 HOURLY
interface HourlyReport {
  hourly: {
    hour: number;
    orders: number;
    sales: number;
  }[];
  peakHour: {
    hour: number;
    orders: number;
    sales: number;
  } | null;
  weakestHour: {
    hour: number;
    orders: number;
    sales: number;
  } | null;
}

// 🔥 STAFF
interface StaffReport {
  staffId: number;
  name: string;
  hoursWorked: number;
  salaryPaid: number;
  costPerHour: number;
}

// ================= DAILY =================

export function useDailyReport(date?: string) {
  return useQuery({
    queryKey: ["reports", "daily", date],
    enabled: !!date,

    queryFn: () =>
      get<DailyReport>("/reports/daily", {
        params: { date },
      }),

    staleTime: 1000 * 60,
  });
}

// ================= WEEKLY =================

export function useWeeklyReport() {
  return useQuery({
    queryKey: ["reports", "weekly"],
    queryFn: () => get<ChartPoint[]>("/reports/weekly"),
    staleTime: 1000 * 60,
  });
}

// ================= MONTHLY =================

export function useMonthlyReport() {
  return useQuery({
    queryKey: ["reports", "monthly"],
    queryFn: () => get<ChartPoint[]>("/reports/monthly"),
    staleTime: 1000 * 60,
  });
}

// ================= SUMMARIES =================

export function useWeeklySummary() {
  return useQuery({
    queryKey: ["reports", "weekly-summary"],
    queryFn: () => get<SummaryReport>("/reports/weekly-summary"),
    staleTime: 1000 * 60,
  });
}

export function useMonthlySummary() {
  return useQuery({
    queryKey: ["reports", "monthly-summary"],
    queryFn: () => get<SummaryReport>("/reports/monthly-summary"),
    staleTime: 1000 * 60,
  });
}

// ================= TOP PRODUCTS =================

export function useTopProducts(
  range: "7d" | "30d" | "custom" = "7d",
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ["reports", "top-products", range, startDate, endDate],
    enabled: range !== "custom" || (!!startDate && !!endDate),
    queryFn: () =>
      get<TopProduct[]>("/reports/top-products", {
        params: { range, startDate, endDate },
      }),
  });
}

// ================= PRODUCT ANALYTICS =================

export function useProductAnalytics(
  query?: string,
  range: "7d" | "30d" | "custom" = "7d",
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ["reports", "product-analytics", query, range, startDate, endDate],
    enabled: !!query && (range !== "custom" || (!!startDate && !!endDate)),
    queryFn: () =>
      get<ProductAnalytics>("/reports/product-analytics", {
        params: { query, range, startDate, endDate },
      }),
  });
}

// ================= HOURLY =================

export function useHourlyReport(
  range: "7d" | "30d" | "custom" = "7d",
  startDate?: string,
  endDate?: string
) {
  return useQuery({
    queryKey: ["reports", "hourly", range, startDate, endDate],
    enabled: range !== "custom" || (!!startDate && !!endDate),
    queryFn: () =>
      get<HourlyReport>("/reports/hourly", {
        params: { range, startDate, endDate },
      }),
  });
}

// ================= STAFF =================

export function useStaffReport(range: "7d" | "14d" | "30d" = "14d") {
  return useQuery({
    queryKey: ["reports", "staff", range],
    queryFn: () =>
      get<StaffReport[]>("/reports/staff", {
        params: { range },
      }),
  });
}

// ================= EXPORT =================

export function useExportReport() {
  return async ({
    module,
    range = "7d",
    startDate,
    endDate,
  }: {
    module: string;
    range?: string;
    startDate?: string;
    endDate?: string;
  }) => {
    const url = `${import.meta.env.VITE_API_URL}/reports/export?module=${module}&range=${range}${
      startDate ? `&startDate=${startDate}` : ""
    }${endDate ? `&endDate=${endDate}` : ""}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!res.ok) {
      throw new Error("Export failed");
    }

    const blob = await res.blob();

    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${module}_${range}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    // 🔥 prevent memory leak
    window.URL.revokeObjectURL(downloadUrl);
  };
}