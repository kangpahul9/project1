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




// Protected Route Wrapper
function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { user } = useAuthStore();
  
  if (!user) {
    return <Redirect to="/login" />;
  }
  
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      
      {/* Protected Routes */}
      <Route path="/" component={() => <Redirect to="/dashboard" />} />
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
        <ProtectedRoute component={Vendors} />
      </Route>
      <Route path="/staff">
        <ProtectedRoute component={Staff} />
      </Route>
      <Route path="/unpaid">
        <ProtectedRoute component={UnpaidOrders} />
      </Route>
      <Route path="/reports">
        <ProtectedRoute component={Reports} />
      </Route>
      <Route path="/print/:billNumber">
        <ProtectedRoute component={PrintBill} />
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
