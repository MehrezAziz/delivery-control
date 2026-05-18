"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Users, Truck, DollarSign, Shield, Settings, UserPlus, LogOut, Menu, X, ClipboardList, MessageSquare, Package, AlertTriangle, Wallet, Bot, Smartphone, Coins, Gamepad2,
} from "lucide-react";
import { NotificationBell } from "@/components/notification-bell";
import { ThemeToggle } from "@/components/theme-toggle";

const allNavItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/orders", label: "Orders", icon: Package },
  { href: "/dashboard/disputes", label: "Disputes", icon: AlertTriangle },
  { href: "/dashboard/users", label: "Users", icon: Users },
  { href: "/dashboard/drivers", label: "Driver Approval", icon: Truck },
  { href: "/dashboard/finances", label: "Driver Finances", icon: Wallet },
  { href: "/dashboard/customer-finances", label: "Customer Finances", icon: Coins },
  { href: "/dashboard/fiat-withdrawals", label: "Fiat payouts", icon: DollarSign },
  { href: "/dashboard/pricing", label: "Country Pricing", icon: DollarSign },
  { href: "/dashboard/coin-config", label: "Country coin config", icon: Coins },
  { href: "/dashboard/games", label: "Games", icon: Gamepad2 },
  { href: "/dashboard/customer-service", label: "Customer Service", icon: UserPlus },
  { href: "/dashboard/delivery-companies", label: "Delivery Companies", icon: Truck },
  { href: "/dashboard/delivery-companies/refunds", label: "Company Refund Approvals", icon: DollarSign },
  { href: "/dashboard/delivery-companies/budgets", label: "Company budgets & wallet", icon: DollarSign },
  { href: "/dashboard/order-arrival-conflicts", label: "Arrival incidents", icon: AlertTriangle },
  { href: "/dashboard/support", label: "Support Tickets", icon: MessageSquare },
  { href: "/dashboard/ai-support", label: "AI Support", icon: Bot },
  { href: "/dashboard/restrictions", label: "Restrictions", icon: Shield },
  { href: "/dashboard/system-config", label: "System Config", icon: Settings },
  { href: "/dashboard/device-push", label: "Mobile push (FCM)", icon: Smartphone },
  { href: "/dashboard/action-logs", label: "Action Logs", icon: ClipboardList },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  /** Always show the full nav. Route access for Customer Service is enforced by middleware + APIs — shrinking the sidebar hid CS panel links and caused a confusing “flash”. Use /cs/… for CS-specific tools (e.g. company wallet). */
  const navItems = allNavItems;
  const panelTitle = "Admin Panel";

  // Session security: if sessionStorage flag is missing (window was closed), force re-auth
  useEffect(() => {
    const sessionActive = sessionStorage.getItem("session_active");
    if (!sessionActive) {
      // Clear cookie and redirect — closing the window means re-login is required
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
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between p-4">
          <h1 className="text-lg font-semibold text-foreground">Delivery Control</h1>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Separator />
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive(item.href) ? "bg-accent font-medium text-accent-foreground" : "hover:bg-accent/50 text-muted-foreground"}`}>
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <Separator className="mb-2" />
          <Button variant="ghost" className="w-full justify-start gap-3 text-sm text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b bg-card px-4 py-3 lg:px-6">
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
