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
  BarChart3,
  Menu,
  X,
  CalendarDays
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "POS", href: "/pos", icon: Store },
  { label: "Orders", href: "/orders", icon: Receipt },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Expenses", href: "/expenses", icon: Wallet },
  { label: "Vendors", href: "/vendors", icon: ShoppingBag },
  { label: "Staff", href: "/staff", icon: Users },
  { label: "Roster", href: "/roster", icon: CalendarDays },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user } = useAuthStore();
  const logout = useLogout();
  const [open, setOpen] = useState(false);

  const SidebarContent = () => (
    <>
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
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t">
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
            {user?.name?.[0] || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-muted-foreground capitalize">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            className="text-muted-foreground hover:text-destructive"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Hamburger for mobile */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-card p-2 rounded-md shadow"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex h-screen w-64 bg-card border-r flex-col fixed left-0 top-0 z-40">
        <SidebarContent />
      </div>

      {/* Mobile Sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Overlay */}
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setOpen(false)}
        />

        {/* Slide panel */}
        <div
          className={cn(
            "absolute left-0 top-0 h-full w-64 bg-card border-r flex flex-col transition-transform duration-300",
            open ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="flex justify-end p-4">
            <button onClick={() => setOpen(false)}>
              <X className="w-6 h-6" />
            </button>
          </div>
          <SidebarContent />
        </div>
      </div>
    </>
  );
}