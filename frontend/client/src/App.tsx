import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuthStore } from "@/hooks/use-auth";

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



// Protected Route Wrapper
function ProtectedRoute({
  component: Component,
  roles
}: {
  component: React.ComponentType<any>;
  roles?: string[];
}) {
  const { user } = useAuthStore();

  if (!user) {
    return <Redirect to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Redirect to="/pos" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes */}
<Route path="/">
  {() => {
    const { user } = useAuthStore();
    if (!user) return <Redirect to="/login" />;

    return user.role === "STAFF"
      ? <Redirect to="/dashboard" />
      : <Redirect to="/dashboard" />;
  }}
</Route>
      <Route path="/dashboard">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/pos">
        <ProtectedRoute component={Pos} />
      </Route>
      <Route path="/orders">
        <ProtectedRoute component={Orders} />
      </Route>
      <Route path="/expenses">
        <ProtectedRoute component={Expenses} />
      </Route>
      <Route path="/vendors">
        <ProtectedRoute component={Vendors}  roles={["ADMIN"]} />
      </Route>
      <Route path="/staff">
        <ProtectedRoute component={Staff}  roles={["ADMIN"]} />
      </Route>
      <Route path="/unpaid">
        <ProtectedRoute component={UnpaidOrders}  roles={["ADMIN"]} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports}  roles={["ADMIN"]} />
      </Route>
      <Route path="/print/:billNumber">
        <ProtectedRoute component={PrintBill}  roles={["ADMIN"]} />
      </Route>
      <Route path="/withdrawals-history">
        <ProtectedRoute component={WithdrawalHistory}  roles={["ADMIN"]} />
      </Route>
      <Route path="/roster">
        <ProtectedRoute component={Roster} />
      </Route>

      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>

      

      <Route path="/partners/:id/ledger">
  <ProtectedRoute component={PartnerHistory} />
</Route>

<Route path="/partners-ledger">
        <ProtectedRoute component={PartnerLedger} />
      </Route>

      <Route path="/bank-history">
        <ProtectedRoute component={BankHistory} />
      </Route>


      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
