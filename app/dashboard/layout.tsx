"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Truck,
  DollarSign,
  Shield,
  Settings,
  UserPlus,
  LogOut,
  Menu,
  X,
  ClipboardList,
  MessageSquare,
  Package,
  AlertTriangle,
  Wallet,
  Bot,
  Smartphone,
  Coins,
  Gamepad2,
  Sparkles,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/orders", label: "Orders", icon: Package },
      { href: "/dashboard/disputes", label: "Disputes", icon: AlertTriangle },
      { href: "/dashboard/order-arrival-conflicts", label: "Arrival incidents", icon: AlertTriangle },
    ],
  },
  {
    label: "Users & fleet",
    items: [
      { href: "/dashboard/users", label: "Users", icon: Users },
      { href: "/dashboard/drivers", label: "Driver Approval", icon: Truck },
      { href: "/dashboard/restrictions", label: "Restrictions", icon: Shield },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/dashboard/finances", label: "Driver Finances", icon: Wallet },
      { href: "/dashboard/customer-finances", label: "Customer Finances", icon: Coins },
      { href: "/dashboard/fiat-withdrawals", label: "Fiat payouts", icon: DollarSign },
      { href: "/dashboard/pricing", label: "Country Pricing", icon: DollarSign },
      { href: "/dashboard/coin-config", label: "Country coin config", icon: Coins },
    ],
  },
  {
    label: "Partners",
    items: [
      { href: "/dashboard/delivery-companies", label: "Delivery Companies", icon: Truck },
      { href: "/dashboard/delivery-companies/refunds", label: "Company Refund Approvals", icon: DollarSign },
      { href: "/dashboard/delivery-companies/budgets", label: "Company budgets & wallet", icon: Wallet },
    ],
  },
  {
    label: "Support",
    items: [
      { href: "/dashboard/customer-service", label: "Customer Service", icon: UserPlus },
      { href: "/dashboard/support", label: "Support Tickets", icon: MessageSquare },
      { href: "/dashboard/ai-support", label: "AI Support", icon: Bot },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/games", label: "Games", icon: Gamepad2 },
      { href: "/dashboard/device-push", label: "Mobile push (FCM)", icon: Smartphone },
      { href: "/dashboard/system-config", label: "System Config", icon: Settings },
      { href: "/dashboard/action-logs", label: "Action Logs", icon: ClipboardList },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const panelTitle = "Admin Panel";

  useEffect(() => {
    const sessionActive = sessionStorage.getItem("session_active");
    if (!sessionActive) {
      fetch("/api/auth/logout", { method: "POST" }).then(() => {
        window.location.href = "/login/admin";
      });
    }
  }, []);

  async function handleLogout() {
    sessionStorage.removeItem("session_active");
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);

  return (
    <div className="flex h-screen bg-background">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card shadow-sm transition-transform lg:relative lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Sidebar header */}
        <div className="shrink-0 border-b bg-gradient-to-br from-primary/10 via-card to-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
                <Sparkles className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-foreground truncate">Delivery Control</h1>
                <p className="text-[11px] text-muted-foreground">Admin panel</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable nav — logout is last item, scrolls with content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <nav className="flex flex-col gap-5 p-3 pb-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                  {group.label}
                </p>
                <div className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setSidebarOpen(false)}
                        className={cn(
                          "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                          active
                            ? "bg-primary/10 font-medium text-primary border-l-2 border-primary pl-2"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border-l-2 border-transparent",
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active && "text-primary")} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="border-t pt-3 mt-1">
              <button
                type="button"
                onClick={() => void handleLogout()}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4 shrink-0" />
                Logout
              </button>
            </div>
          </nav>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <header className="relative z-50 flex shrink-0 items-center gap-4 border-b bg-card/80 backdrop-blur-sm px-4 py-3 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-sm font-medium text-muted-foreground">{panelTitle}</h2>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <NotificationBell />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
