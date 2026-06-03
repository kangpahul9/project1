import { Switch, Route, Redirect, Router as WouterRouter } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/hooks/use-auth";
import React from "react";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-8">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠</span>
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Something went wrong</h1>
            <p className="text-muted-foreground text-sm mb-6">{this.state.error?.message || "An unexpected error occurred."}</p>
            <button
              className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = "/"; }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import Pos from "@/pages/Pos";
import Orders from "@/pages/Orders";
import Expenses from "@/pages/Expenses";
import Vendors from "@/pages/Vendors";
import Staff from "@/pages/Staff";
import NotFound from "@/pages/not-found";
import UnpaidOrders from "@/pages/unpaid";
import Reports from "@/pages/Reports";
import PrintBill from "@/pages/PrintBill";
import WithdrawalHistory from "@/pages/withdrawals-history";
import Roster from "@/pages/Roster";
import Settings from "@/pages/Settings";
import PartnerLedger from "@/pages/partners-ledger";
import PartnerHistory from "./pages/partner-history";
import BankHistory from "./pages/BankHistory";
import DeletedOrders from "./pages/deleted-orders";
import StaffDashboard from "@/pages/StaffDashboard";
import AttendanceLogs from "@/pages/AttendanceLogs";
import Payroll from "@/pages/Payroll";
import ManageMenu from "@/pages/ManageMenu";
import KDS from "@/pages/KDS";
import { ChatWidget } from "@/components/ChatWidget";

function ProtectedRoute({
  component: Component,
  roles
}: {
  component: React.ComponentType<any>;
  roles?: string[];
}) {
  const { user } = useAuthStore();
  if (!user) return <Redirect to="/login" />;
  if (roles && !roles.includes(user.role)) return <Redirect to="/pos" />;
  return <Component />;
}

function RootRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Redirect to="/login" />;
  return <Redirect to="/dashboard" />;
}

function DashboardRoute() {
  const { user } = useAuthStore();
  if (!user) return <Redirect to="/login" />;
  if (user.role === "STAFF") return <StaffDashboard />;
  return <Dashboard />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={RootRedirect} />
      <Route path="/dashboard" component={DashboardRoute} />
      <Route path="/pos"><ProtectedRoute component={Pos} /></Route>
      <Route path="/orders"><ProtectedRoute component={Orders} /></Route>
      <Route path="/expenses"><ProtectedRoute component={Expenses} /></Route>
      <Route path="/vendors"><ProtectedRoute component={Vendors} roles={["ADMIN"]} /></Route>
      <Route path="/staff"><ProtectedRoute component={Staff} roles={["ADMIN"]} /></Route>
      <Route path="/unpaid"><ProtectedRoute component={UnpaidOrders} roles={["ADMIN"]} /></Route>
      <Route path="/reports"><ProtectedRoute component={Reports} roles={["ADMIN"]} /></Route>
      <Route path="/print/:billNumber"><ProtectedRoute component={PrintBill} /></Route>
      <Route path="/withdrawals-history"><ProtectedRoute component={WithdrawalHistory} roles={["ADMIN"]} /></Route>
      <Route path="/roster"><ProtectedRoute component={Roster} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} roles={["ADMIN"]} /></Route>
      <Route path="/partners/:id/ledger"><ProtectedRoute component={PartnerHistory} /></Route>
      <Route path="/partners-ledger"><ProtectedRoute component={PartnerLedger} /></Route>
      <Route path="/bank-history"><ProtectedRoute component={BankHistory} /></Route>
      <Route path="/deleted-orders"><ProtectedRoute component={DeletedOrders} /></Route>
      <Route path="/staff-dashboard"><ProtectedRoute component={StaffDashboard} roles={["STAFF"]} /></Route>
      <Route path="/attendance"><ProtectedRoute component={AttendanceLogs} roles={["ADMIN"]} /></Route>
      <Route path="/payroll"><ProtectedRoute component={Payroll} roles={["ADMIN"]} /></Route>
      <Route path="/manage-menu"><ProtectedRoute component={ManageMenu} roles={["ADMIN"]} /></Route>
      <Route path="/kds"><ProtectedRoute component={KDS} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ToastContainer
          position="top-right"
          autoClose={3000}
          hideProgressBar={false}
          newestOnTop
          closeOnClick
          pauseOnHover
          draggable
          theme="light"
          toastClassName="!rounded-xl !shadow-lg !border !border-border !text-sm !font-medium"
        />
        <ErrorBoundary>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
            <Router />
          </WouterRouter>
        </ErrorBoundary>
        <ChatWidget />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
