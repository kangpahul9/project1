import { Link, useLocation } from "wouter";
import { useAuthStore, useLogout } from "@/hooks/use-auth";
import { 
  LayoutDashboard, 
  Store, 
  Receipt, 
  Wallet, 
  Users, 
  LogOut,
  ShoppingBag,
  BarChart3
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "POS", href: "/pos", icon: Store },
  { label: "Orders", href: "/orders", icon: Receipt },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Vendors", href: "/vendors", icon: ShoppingBag },
  { label: "Staff", href: "/staff", icon: Users },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuthStore();
  const logout = useLogout();

  return (
<div className="hidden lg:flex h-screen w-64 bg-card border-r flex-col fixed left-0 top-0 z-50">
      <div className="p-6">
        <h1 className="text-2xl font-bold font-display bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
          KangPOS
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Continental Dhaba</p>
      </div>

      <nav className="flex-1 px-4 space-y-2">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 group",
                  isActive 
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" 
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "stroke-2" : "stroke-[1.5]")} />
                <span className={cn("font-medium", isActive ? "font-semibold" : "")}>
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {user?.name?.[0] || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
          <button 
            onClick={logout}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
