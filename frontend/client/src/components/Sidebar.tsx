import { Link, useLocation } from "wouter";
import { useAuthStore, useLogout } from "@/hooks/use-auth";
import { useSettings } from "@/hooks/use-settings";
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
  CalendarDays,
  Currency,
  Settings,
  ClipboardList,
  DollarSign,
  UtensilsCrossed,
  ChevronRight,
  ChefHat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["ADMIN"] },
  { label: "My Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["STAFF"] },
  { label: "POS", href: "/pos", icon: Store, roles: ["ADMIN", "STAFF"] },
  { label: "Kitchen", href: "/kds", icon: ChefHat, roles: ["ADMIN", "STAFF"] },
  { label: "Menu", href: "/manage-menu", icon: UtensilsCrossed, roles: ["ADMIN"] },
  { label: "Orders", href: "/orders", icon: Receipt, roles: ["ADMIN", "STAFF"] },
  { label: "Reports", href: "/reports", icon: BarChart3, roles: ["ADMIN"] },
  { label: "Expenses", href: "/expenses", icon: Wallet, roles: ["ADMIN", "STAFF"] },
  { label: "Vendors", href: "/vendors", icon: ShoppingBag, roles: ["ADMIN"] },
  { label: "Partners", href: "/partners-ledger", icon: Currency, roles: ["ADMIN"] },
  { label: "Staff", href: "/staff", icon: Users, roles: ["ADMIN"] },
  { label: "Roster", href: "/roster", icon: CalendarDays, roles: ["ADMIN"] },
  { label: "Attendance", href: "/attendance", icon: ClipboardList, roles: ["ADMIN"] },
  { label: "Payroll", href: "/payroll", icon: DollarSign, roles: ["ADMIN"] },
  { label: "Settings", href: "/settings", icon: Settings, roles: ["ADMIN"] },
];

function SidebarInner({ onClose }: { onClose?: () => void }) {
  const [location] = useLocation();
  const { user } = useAuthStore();
  const logout = useLogout();
  const { data: settings } = useSettings();

  const visibleItems = NAV_ITEMS
    .filter(item => item.roles.includes(user?.role ?? ""))
    .filter(item => !(item.label === "Partners" && !settings?.enable_partners));

  const initial = (user?.name?.[0] ?? "U").toUpperCase();

  return (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      {/* Logo */}
      <div className="px-6 pt-6 pb-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <svg width="36" height="36" viewBox="0 0 90 90" fill="none" className="shrink-0" aria-hidden="true">
            <rect width="90" height="90" rx="16" fill="#2563eb"/>
            <path d="M 28 20 L 28 70" stroke="white" strokeWidth="9" strokeLinecap="round"/>
            <path d="M 62 20 L 28 45" stroke="white" strokeWidth="9" strokeLinecap="round"/>
            <path d="M 36 40 L 62 70" stroke="white" strokeWidth="9" strokeLinecap="round"/>
          </svg>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight leading-none">
              Kang<span className="text-[#5b8cff]">POS</span>
            </h1>
            <p className="text-[11px] text-sidebar-foreground/50 mt-0.5 leading-none">Business Terminal</p>
          </div>
        </div>
      </div>

      {/* Nav label */}
      <div className="px-5 pt-4 pb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35">Navigation</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 pb-3 overflow-y-auto no-scrollbar space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.label + item.href} href={item.href}>
              <div
                onClick={onClose}
                className={cn(
                  "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-150 relative",
                  isActive
                    ? "bg-primary text-white font-medium nav-active-glow"
                    : "text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-white" : "text-sidebar-foreground/50 group-hover:text-sidebar-accent-foreground")} />
                <span className="text-sm flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-sidebar-accent/60">
          <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-none">{user?.name}</p>
            <p className="text-[11px] text-sidebar-foreground/45 capitalize mt-0.5 leading-none">{user?.role?.toLowerCase()}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="text-sidebar-foreground/40 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 bg-sidebar text-sidebar-foreground p-2.5 rounded-xl shadow-lg border border-sidebar-border"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-screen w-60 flex-col fixed left-0 top-0 z-40 border-r border-sidebar-border">
        <SidebarInner />
      </div>

      {/* Mobile overlay */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden transition-opacity duration-300",
          open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
        <div className={cn(
          "absolute left-0 top-0 h-full w-60 flex flex-col transition-transform duration-300 border-r border-sidebar-border",
          open ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex justify-end p-3 bg-sidebar border-b border-sidebar-border">
            <button onClick={() => setOpen(false)} className="p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-white hover:bg-sidebar-accent transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <SidebarInner onClose={() => setOpen(false)} />
        </div>
      </div>
    </>
  );
}
