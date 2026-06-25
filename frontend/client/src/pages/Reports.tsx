import { Sidebar } from "@/components/Sidebar";
import {
  useDailyReport, useWeeklyReport, useWeeklySummary, useMonthlyReport,
  useMonthlySummary, useTopProducts, useProductAnalytics, useHourlyReport
} from "@/hooks/use-reports";
import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import {
  Loader2, Search, TrendingUp, Clock, BarChart3,
  Download, Calendar, ArrowUpRight, ArrowDownRight,
  ChevronRight, ArrowLeft, CalendarDays, CalendarRange,
  Award, Flame,
} from "lucide-react";
import { withApiBase } from "@/lib/api-base";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend, LineChart, Line
} from "recharts";

// ── types ────────────────────────────────────────────────────────────────────
type ReportView = "daily" | "weekly" | "monthly" | "top-items" | "item-search" | "hourly";

// ── helpers ──────────────────────────────────────────────────────────────────
function GrowthBadge({ value }: { value: number }) {
  if (value === 0) return null;
  const pos = value > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
      pos
        ? "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
        : "bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400"
    )}>
      {pos ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(value)}%
    </span>
  );
}

function KpiCard({ title, value, sub }: { title: string; value: any; sub?: React.ReactNode }) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 hover:shadow-md transition-shadow">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <div className="mt-2">{sub}</div>}
    </div>
  );
}

function ReportTile({
  icon: Icon,
  iconBg,
  iconClass,
  label,
  desc,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconClass: string;
  label: string;
  desc: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-xl border border-transparent hover:border-border bg-muted/40 hover:bg-muted transition-all group"
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", iconBg)}>
        <Icon className={cn("w-4 h-4", iconClass)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground transition shrink-0" />
    </button>
  );
}

function SectionGroup({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b bg-muted/30 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="font-semibold text-sm text-foreground">{title}</h2>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );
}

const PRIMARY = "hsl(214, 100%, 50%)";
const CHART_COLORS = ["#22c55e", "#3b82f6", "#8b5cf6", "#f59e0b"];

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════
export default function Reports() {
  const { format } = useCurrency();

  // which report is open (null = hub)
  const [activeView, setActiveView] = useState<ReportView | null>(null);

  // sales report state
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);

  // item analytics state
  const [itemRange, setItemRange] = useState<"7d" | "30d" | "custom">("7d");
  const [itemStartDate, setItemStartDate] = useState("");
  const [itemEndDate, setItemEndDate] = useState("");
  const [appliedStart, setAppliedStart] = useState("");
  const [appliedEnd, setAppliedEnd] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");

  // data hooks
  const { data: report, isLoading: dailyLoading } = useDailyReport(selectedDate);
  const { data: weeklySummary, isLoading: weeklyLoading } = useWeeklySummary();
  const { data: monthlySummary, isLoading: monthlyLoading } = useMonthlySummary();
  const { data: weeklyData } = useWeeklyReport();
  const { data: monthlyData } = useMonthlyReport();
  const { data: topProducts, isLoading: topLoading } = useTopProducts(itemRange, appliedStart, appliedEnd);
  const { data: productAnalytics, isLoading: analyticsLoading } = useProductAnalytics(submittedSearch || undefined, itemRange, appliedStart, appliedEnd);
  const { data: hourlyData, isLoading: hourlyLoading } = useHourlyReport(itemRange, appliedStart, appliedEnd);

  const handleExport = async (type: "daily" | "weekly" | "monthly") => {
    const token = localStorage.getItem("token");
    const res = await fetch(withApiBase(`/reports/export?type=${type}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${type}-report.csv`;
    a.click();
  };

  const rangeLabel = itemRange === "custom"
    ? (appliedStart && appliedEnd ? `${appliedStart} → ${appliedEnd}` : "Custom range")
    : `Last ${itemRange === "7d" ? "7" : "30"} days`;

  // ── shared range controls (used inside item analytics views) ──
  const RangeControls = () => (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex gap-1 bg-muted/50 border rounded-xl p-1">
        {(["7d", "30d", "custom"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setItemRange(r)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              itemRange === r
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "Custom"}
          </button>
        ))}
      </div>
      {itemRange === "custom" && (
        <div className="flex items-center gap-2 flex-wrap">
          <Input type="date" value={itemStartDate} onChange={(e) => setItemStartDate(e.target.value)} className="w-36 h-9 text-sm" />
          <span className="text-muted-foreground text-sm">to</span>
          <Input type="date" value={itemEndDate} onChange={(e) => setItemEndDate(e.target.value)} className="w-36 h-9 text-sm" />
          <Button size="sm" disabled={!itemStartDate || !itemEndDate}
            onClick={() => { setAppliedStart(itemStartDate); setAppliedEnd(itemEndDate); }}>
            Apply
          </Button>
        </div>
      )}
    </div>
  );

  // ── back button + detail header ──
  const DetailHeader = ({ icon: Icon, title, right }: {
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    right?: React.ReactNode;
  }) => (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={() => setActiveView(null)}>
          <ArrowLeft className="w-4 h-4" /> Reports
        </Button>
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-primary shrink-0" />
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </div>
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );

  // ══════════════════════════════════════════════════════
  // DAILY REPORT
  // ══════════════════════════════════════════════════════
  const DailyReportView = () => {
    const paymentData = [
      { name: "Cash",   value: report?.totalCash || 0 },
      { name: "Online", value: report?.totalOnline || 0 },
      { name: "Credit", value: report?.totalCreditGiven || 0 },
    ].filter(d => d.value > 0);

    return (
      <>
        <DetailHeader
          icon={Calendar}
          title="Daily Report"
          right={
            <>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="pl-9 w-44" />
              </div>
              <Button variant="outline" className="gap-2" onClick={() => handleExport("daily")}>
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            </>
          }
        />
        {dailyLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin w-6 h-6 text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <KpiCard title="Total Sales"   value={format(report?.totalSales || 0)}
                sub={report?.growthPercentage !== undefined ? <GrowthBadge value={report.growthPercentage} /> : undefined} />
              <KpiCard title="Cash Sales"    value={format(report?.totalCash || 0)} />
              <KpiCard title="Online Sales"  value={format(report?.totalOnline || 0)} />
              <KpiCard title="Credit Given"  value={format(report?.totalCreditGiven || 0)} />
              <KpiCard title="Total Orders"  value={report?.totalOrders || 0} />
              <KpiCard title="Paid Orders"   value={report?.paidOrders || 0} />
              <KpiCard title="Unpaid Orders" value={report?.unpaidOrders || 0} />
              <KpiCard title="Outstanding"   value={format(report?.totalOutstanding || 0)} />
            </div>
            {paymentData.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                <h2 className="text-base font-semibold text-foreground mb-5">Payment Breakdown</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={paymentData} dataKey="value" outerRadius={90}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {CHART_COLORS.slice(0, paymentData.length).map((c, i) => <Cell key={i} fill={c} />)}
                    </Pie>
                    <Tooltip formatter={(val: any) => format(Number(val))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </>
    );
  };

  // ══════════════════════════════════════════════════════
  // WEEKLY REPORT
  // ══════════════════════════════════════════════════════
  const WeeklyReportView = () => {
    const paymentData = [
      { name: "Cash",   value: weeklySummary?.totalCash || 0 },
      { name: "Online", value: weeklySummary?.totalOnline || 0 },
      { name: "Credit", value: weeklySummary?.totalCreditGiven || 0 },
    ].filter(d => d.value > 0);

    return (
      <>
        <DetailHeader
          icon={CalendarDays}
          title="Weekly Report"
          right={
            <Button variant="outline" className="gap-2" onClick={() => handleExport("weekly")}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          }
        />
        {weeklyLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin w-6 h-6 text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <KpiCard title="Total Sales"   value={format(weeklySummary?.totalSales || 0)}
                sub={weeklySummary?.growthPercentage !== undefined ? <GrowthBadge value={weeklySummary.growthPercentage} /> : undefined} />
              <KpiCard title="Cash Sales"    value={format(weeklySummary?.totalCash || 0)} />
              <KpiCard title="Online Sales"  value={format(weeklySummary?.totalOnline || 0)} />
              <KpiCard title="Credit Given"  value={format(weeklySummary?.totalCreditGiven || 0)} />
              <KpiCard title="Total Orders"  value={weeklySummary?.totalOrders || 0} />
              <KpiCard title="Paid Orders"   value={weeklySummary?.paidOrders || 0} />
              <KpiCard title="Unpaid Orders" value={weeklySummary?.unpaidOrders || 0} />
              <KpiCard title="Outstanding"   value={format(weeklySummary?.totalOutstanding || 0)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {paymentData.length > 0 && (
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-base font-semibold text-foreground mb-5">Payment Breakdown</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={paymentData} dataKey="value" outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {CHART_COLORS.slice(0, paymentData.length).map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip formatter={(val: any) => format(Number(val))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {(weeklyData || []).length > 0 && (
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-base font-semibold text-foreground mb-5">Daily Trend (This Week)</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={weeklyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(val: any) => format(Number(val))} />
                      <Line type="monotone" dataKey="total_sales" stroke={PRIMARY} strokeWidth={3} dot={{ r: 4 }} name="Sales" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </>
    );
  };

  // ══════════════════════════════════════════════════════
  // MONTHLY REPORT
  // ══════════════════════════════════════════════════════
  const MonthlyReportView = () => {
    const paymentData = [
      { name: "Cash",   value: monthlySummary?.totalCash || 0 },
      { name: "Online", value: monthlySummary?.totalOnline || 0 },
      { name: "Credit", value: monthlySummary?.totalCreditGiven || 0 },
    ].filter(d => d.value > 0);

    return (
      <>
        <DetailHeader
          icon={CalendarRange}
          title="Monthly Report"
          right={
            <Button variant="outline" className="gap-2" onClick={() => handleExport("monthly")}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          }
        />
        {monthlyLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin w-6 h-6 text-primary" /></div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <KpiCard title="Total Sales"   value={format(monthlySummary?.totalSales || 0)}
                sub={monthlySummary?.growthPercentage !== undefined ? <GrowthBadge value={monthlySummary.growthPercentage} /> : undefined} />
              <KpiCard title="Cash Sales"    value={format(monthlySummary?.totalCash || 0)} />
              <KpiCard title="Online Sales"  value={format(monthlySummary?.totalOnline || 0)} />
              <KpiCard title="Credit Given"  value={format(monthlySummary?.totalCreditGiven || 0)} />
              <KpiCard title="Total Orders"  value={monthlySummary?.totalOrders || 0} />
              <KpiCard title="Paid Orders"   value={monthlySummary?.paidOrders || 0} />
              <KpiCard title="Unpaid Orders" value={monthlySummary?.unpaidOrders || 0} />
              <KpiCard title="Outstanding"   value={format(monthlySummary?.totalOutstanding || 0)} />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {paymentData.length > 0 && (
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-base font-semibold text-foreground mb-5">Payment Breakdown</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie data={paymentData} dataKey="value" outerRadius={90}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {CHART_COLORS.slice(0, paymentData.length).map((c, i) => <Cell key={i} fill={c} />)}
                      </Pie>
                      <Tooltip formatter={(val: any) => format(Number(val))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              {(monthlyData || []).length > 0 && (
                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                  <h2 className="text-base font-semibold text-foreground mb-5">Daily Trend (This Month)</h2>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip formatter={(val: any) => format(Number(val))} />
                      <Line type="monotone" dataKey="total_sales" stroke={PRIMARY} strokeWidth={3} dot={{ r: 3 }} name="Sales" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </>
        )}
      </>
    );
  };

  // ══════════════════════════════════════════════════════
  // TOP ITEMS
  // ══════════════════════════════════════════════════════
  const TopItemsView = () => (
    <>
      <DetailHeader
        icon={Flame}
        title="Top Items"
        right={<RangeControls />}
      />
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Best Selling Items</h3>
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
        </div>
        {topLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin w-5 h-5 text-primary" /></div>
        ) : !topProducts?.length ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No data for this period</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
                  <tr>
                    <th className="px-6 py-3 text-left w-10">#</th>
                    <th className="px-6 py-3 text-left">Item</th>
                    <th className="px-6 py-3 text-right">Qty Sold</th>
                    <th className="px-6 py-3 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {topProducts.map((p, i) => (
                    <tr key={i} className="hover:bg-muted/30 transition-colors">
                      <td className="px-6 py-3 text-muted-foreground font-mono text-xs">{i + 1}</td>
                      <td className="px-6 py-3 font-medium text-foreground">{p.item_name}</td>
                      <td className="px-6 py-3 text-right font-semibold tabular-nums">{Number(p.total_quantity)}</td>
                      <td className="px-6 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {format(Number(p.total_revenue))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-border/50">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topProducts.slice(0, 8).map(p => ({
                  name: p.item_name.length > 14 ? p.item_name.slice(0, 14) + "…" : p.item_name,
                  qty: Number(p.total_quantity),
                  revenue: Number(p.total_revenue),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip formatter={(val: any, name) => [name === "revenue" ? format(Number(val)) : val, name === "revenue" ? "Revenue" : "Qty"]} />
                  <Legend />
                  <Bar dataKey="qty" fill={PRIMARY} name="Qty Sold" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenue" fill="#10b981" name="Revenue" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </>
  );

  // ══════════════════════════════════════════════════════
  // ITEM SEARCH
  // ══════════════════════════════════════════════════════
  const ItemSearchView = () => (
    <>
      <DetailHeader icon={Search} title="Item Search" right={<RangeControls />} />
      <div className="space-y-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="e.g. Butter Chicken, Lassi…"
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSubmittedSearch(itemSearch)}
            />
          </div>
          <Button onClick={() => setSubmittedSearch(itemSearch)}>Search</Button>
        </div>

        {!submittedSearch && (
          <div className="bg-card rounded-2xl border border-border/60 p-10 text-center text-muted-foreground">
            <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Search for any menu item to see how it's performing</p>
            <p className="text-xs mt-1 opacity-70">e.g. "How many Butter Chicken sold this month?"</p>
          </div>
        )}

        {submittedSearch && (
          analyticsLoading ? (
            <div className="p-10 flex justify-center"><Loader2 className="animate-spin w-5 h-5 text-primary" /></div>
          ) : !productAnalytics ? (
            <div className="bg-card rounded-2xl border border-border/60 p-10 text-center text-muted-foreground text-sm">
              No results for "{submittedSearch}"
            </div>
          ) : (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-card rounded-2xl border border-border/60 p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Total Sold</p>
                  <p className="text-3xl font-bold text-foreground">{Number(productAnalytics.summary?.total_quantity || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">units · {rangeLabel}</p>
                </div>
                <div className="bg-card rounded-2xl border border-border/60 p-5">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Total Revenue</p>
                  <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{format(Number(productAnalytics.summary?.total_revenue || 0))}</p>
                  <p className="text-xs text-muted-foreground mt-1">for "{submittedSearch}"</p>
                </div>
              </div>
              {productAnalytics.trend?.length > 0 && (
                <div className="bg-card rounded-2xl border border-border/60 p-6">
                  <h3 className="font-semibold text-foreground mb-5">Daily Trend — "{submittedSearch}"</h3>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={productAnalytics.trend.map((t: any) => ({
                      date: String(t.date).slice(5),
                      qty: Number(t.qty),
                      revenue: Number(t.revenue),
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="qty" stroke={PRIMARY} strokeWidth={2} dot={{ r: 3 }} name="Qty" />
                      <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Revenue" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )
        )}
      </div>
    </>
  );

  // ══════════════════════════════════════════════════════
  // HOURLY
  // ══════════════════════════════════════════════════════
  const HourlyView = () => (
    <>
      <DetailHeader icon={Clock} title="Hourly Pattern" right={<RangeControls />} />
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Hourly Sales Pattern</h3>
          <span className="text-xs text-muted-foreground">{rangeLabel}</span>
        </div>
        {hourlyLoading ? (
          <div className="p-10 flex justify-center"><Loader2 className="animate-spin w-5 h-5 text-primary" /></div>
        ) : !hourlyData?.hourly?.length ? (
          <div className="p-10 text-center text-muted-foreground text-sm">No data for this period</div>
        ) : (
          <div className="p-6">
            <div className="flex flex-wrap gap-3 mb-6">
              {hourlyData.peakHour && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-2 text-sm">
                  <span className="text-muted-foreground">Peak: </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                    {hourlyData.peakHour.hour}:00 — {format(hourlyData.peakHour.sales)}
                  </span>
                </div>
              )}
              {hourlyData.weakestHour && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 text-sm">
                  <span className="text-muted-foreground">Weakest: </span>
                  <span className="font-semibold text-amber-700 dark:text-amber-300">
                    {hourlyData.weakestHour.hour}:00 — {format(hourlyData.weakestHour.sales)}
                  </span>
                </div>
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={hourlyData.hourly.map((h: any) => ({
                hour: `${h.hour}:00`,
                orders: h.orders,
                sales: Number(h.sales),
              }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                <Tooltip formatter={(val: any, name) => [name === "sales" ? format(Number(val)) : val, name === "sales" ? "Sales" : "Orders"]} />
                <Legend />
                <Bar dataKey="orders" fill={PRIMARY} name="Orders" radius={[4, 4, 0, 0]} />
                <Bar dataKey="sales" fill="#10b981" name="Sales" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );

  // ══════════════════════════════════════════════════════
  // HUB (default landing)
  // ══════════════════════════════════════════════════════
  const Hub = () => (
    <>
      <div className="mb-7">
        <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2.5">
          <BarChart3 className="w-6 h-6 text-primary shrink-0" />
          Reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Choose a report to view</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Sales Reports group */}
        <SectionGroup
          icon={TrendingUp}
          title="Sales Reports"
          description="Revenue, orders, and payment breakdowns"
        >
          <ReportTile
            icon={Calendar}
            iconBg="bg-blue-50 dark:bg-blue-950/40"
            iconClass="text-blue-600 dark:text-blue-400"
            label="Daily Report"
            desc="Today's totals, cash vs online, unpaid orders"
            onClick={() => setActiveView("daily")}
          />
          <ReportTile
            icon={CalendarDays}
            iconBg="bg-violet-50 dark:bg-violet-950/40"
            iconClass="text-violet-600 dark:text-violet-400"
            label="Weekly Report"
            desc="7-day summary with day-by-day trend chart"
            onClick={() => setActiveView("weekly")}
          />
          <ReportTile
            icon={CalendarRange}
            iconBg="bg-indigo-50 dark:bg-indigo-950/40"
            iconClass="text-indigo-600 dark:text-indigo-400"
            label="Monthly Report"
            desc="Month-to-date totals and daily trend"
            onClick={() => setActiveView("monthly")}
          />
        </SectionGroup>

        {/* Item Analytics group */}
        <SectionGroup
          icon={Award}
          title="Item Analytics"
          description="Dig into what's selling and when"
        >
          <ReportTile
            icon={Flame}
            iconBg="bg-orange-50 dark:bg-orange-950/40"
            iconClass="text-orange-500 dark:text-orange-400"
            label="Top Items"
            desc="Best selling items by quantity and revenue"
            onClick={() => setActiveView("top-items")}
          />
          <ReportTile
            icon={Search}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            iconClass="text-emerald-600 dark:text-emerald-400"
            label="Item Search"
            desc="Deep dive into any single menu item's performance"
            onClick={() => setActiveView("item-search")}
          />
          <ReportTile
            icon={Clock}
            iconBg="bg-amber-50 dark:bg-amber-950/40"
            iconClass="text-amber-600 dark:text-amber-400"
            label="Hourly Pattern"
            desc="Find your peak and quietest hours of the day"
            onClick={() => setActiveView("hourly")}
          />
        </SectionGroup>
      </div>
    </>
  );

  // ══════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-0 lg:ml-60 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8">
        <div className="w-full">
        {activeView === null       && <Hub />}
        {activeView === "daily"    && <DailyReportView />}
        {activeView === "weekly"   && <WeeklyReportView />}
        {activeView === "monthly"  && <MonthlyReportView />}
        {activeView === "top-items"   && <TopItemsView />}
        {activeView === "item-search" && <ItemSearchView />}
        {activeView === "hourly"      && <HourlyView />}
        </div>
      </main>
    </div>
  );
}
