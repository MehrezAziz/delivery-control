"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Users,
  Truck,
  LogOut,
  Menu,
  X,
  Headphones,
  MessageSquare,
  Package,
  AlertTriangle,
  Wallet,
  ShieldAlert,
  LineChart,
  Smartphone,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon: React.ComponentType<{ className?: string }> };

export default function CSLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [csRoles, setCsRoles] = useState<string[]>([]);

  useEffect(() => {
    const sessionActive = sessionStorage.getItem("session_active");
    if (!sessionActive) {
      fetch("/api/auth/logout", { method: "POST" }).then(() => {
        window.location.href = "/login/customer-service";
      });
    }
  }, []);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((me) => setCsRoles(me?.csRoles || []))
      .catch(() => setCsRoles([]));
  }, []);

  async function handleLogout() {
    sessionStorage.removeItem("session_active");
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: "Overview",
      items: [{ href: "/cs", label: "Dashboard", icon: LayoutDashboard }],
    },
    {
      label: "People",
      items: [
        { href: "/cs/customers", label: "Customers", icon: Users },
        { href: "/cs/drivers", label: "Drivers", icon: Truck },
      ],
    },
    {
      label: "Operations",
      items: [
        ...(csRoles.includes("VIEW_DELIVERIES") ? [{ href: "/cs/orders", label: "Orders", icon: Package }] : []),
        { href: "/cs/disputes", label: "Disputes", icon: AlertTriangle },
        { href: "/cs/order-arrival-conflicts", label: "Arrival incidents", icon: ShieldAlert },
      ],
    },
    {
      label: "Partners",
      items: [
        ...(csRoles.includes("SEE_DELIVERY_COMPANY") || csRoles.includes("MANAGE_DELIVERY_COMPANY")
          ? [{ href: "/cs/delivery-companies", label: "Delivery Companies", icon: Truck }]
          : []),
        ...(csRoles.includes("MANAGE_COMPANY_FINANCE") && csRoles.includes("SEE_DELIVERY_COMPANY")
          ? [{ href: "/cs/delivery-companies/budgets", label: "Company wallet & budgets", icon: Wallet }]
          : []),
      ],
    },
    {
      label: "Support & finance",
      items: [
        { href: "/cs/support", label: "Support", icon: MessageSquare },
        { href: "/cs/analytics", label: "Analytics", icon: LineChart },
        { href: "/cs/finances", label: "Finances", icon: Wallet },
        ...(csRoles.includes("PROCESS_WITHDRAWALS") || csRoles.includes("MANAGE_FINANCIAL_REPORTS")
          ? [{ href: "/cs/fiat-withdrawals", label: "Fiat payouts", icon: Wallet }]
          : []),
      ],
    },
    {
      label: "System",
      items: [{ href: "/cs/device-push", label: "Mobile push (FCM)", icon: Smartphone }],
    },
  ].filter((g) => g.items.length > 0);

  const isActive = (href: string) =>
    href === "/cs" ? pathname === "/cs" : pathname.startsWith(href);

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
        <div className="shrink-0 border-b bg-gradient-to-br from-teal-500/10 via-card to-card p-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white shadow-sm">
                <Headphones className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="text-sm font-bold tracking-tight text-foreground truncate">CS Panel</h1>
                <p className="text-[11px] text-muted-foreground">Customer service</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden shrink-0" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

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
                            ? "bg-teal-500/10 font-medium text-teal-700 dark:text-teal-300 border-l-2 border-teal-600 pl-2"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground border-l-2 border-transparent",
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", active && "text-teal-600 dark:text-teal-400")} />
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
          <h2 className="text-sm font-medium text-muted-foreground">Customer Service Panel</h2>
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
