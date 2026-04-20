"use client";

import Link from "next/link";
import { ComponentType, ReactNode, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { CompanyNotificationBell } from "@/components/company-notification-bell";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Bell,
  ChartColumn,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  LifeBuoy,
  Wallet,
  X,
} from "lucide-react";

type CompanyAuthMe = {
  companyId: string;
  companyName?: string | null;
  name?: string | null;
  contactEmail?: string | null;
  departmentId?: string | null;
  departmentLabel?: string | null;
  departmentAccountId?: string | null;
  onboardingCompleted?: boolean;
  actorRole?: "MAIN_ADMIN" | "DEPT_ADMIN" | "DEPT_OPERATOR" | "DEPT_VIEWER";
};

type NavItem = {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  showBadge?: boolean;
};

export default function CompanyLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<CompanyAuthMe | null>(null);

  useEffect(() => {
    if (pathname === "/company/login") return;
    fetch("/api/company-auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setProfile(data))
      .catch(() => setProfile(null));
  }, [pathname]);

  useEffect(() => {
    if (pathname === "/company/login") return;
    if (!profile?.companyId) return;
    const main = (profile.actorRole || "MAIN_ADMIN") === "MAIN_ADMIN";
    if (!main) return;
    if (pathname.startsWith("/company/departments")) return;
    void fetch("/api/company/departments")
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: unknown) => {
        const list = Array.isArray(rows) ? rows : [];
        if (list.length === 0) {
          router.replace("/company/departments");
        }
      })
      .catch(() => {});
  }, [pathname, profile, router]);

  useEffect(() => {
    if (pathname === "/company/login") return;
    if (!profile?.companyId) return;
    const t = window.setInterval(() => {
      void fetch("/api/company/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname || "" }),
      });
    }, 12_000);
    void fetch("/api/company/presence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname || "" }),
    });
    return () => window.clearInterval(t);
  }, [pathname, profile?.companyId]);

  const navItems = useMemo<NavItem[]>(
    () => {
      const isMain = (profile?.actorRole || "MAIN_ADMIN") === "MAIN_ADMIN";
      const items: NavItem[] = [
      { href: "/company/dashboard", label: "Overview", icon: LayoutDashboard },
      { href: "/company/notifications", label: "Notifications", icon: Bell },
      { href: "/company/orders", label: "Orders", icon: Package },
      ...(isMain ? [{ href: "/company/departments", label: "Departments", icon: Building2 }] : []),
      { href: "/company/wallet", label: "Wallet", icon: Wallet },
      { href: "/company/stats", label: "Statistics", icon: ChartColumn },
      ...(isMain ? [{ href: "/company/refunds", label: "Refunds", icon: Wallet }] : []),
      ...(isMain ? [{ href: "/company/api-keys", label: "API Keys", icon: KeyRound }] : []),
      { href: "/company/budgets", label: "Budgets", icon: Wallet },
      ...(isMain ? [{ href: "/company/department-accounts", label: "Department Accounts", icon: Building2 }] : []),
      { href: "/company/support", label: "Support", icon: LifeBuoy },
      ...(isMain ? [{
        href: "/company/setup",
        label: "Setup",
        icon: Settings,
        showBadge: profile?.onboardingCompleted === false,
      }] : []),
      ];
      return items;
    },
    [profile?.onboardingCompleted, profile?.actorRole],
  );

  const logout = async () => {
    await fetch("/api/company-auth/logout", { method: "POST" });
    router.push("/company/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/company/dashboard" ? pathname === "/company/dashboard" : pathname.startsWith(href);

  if (pathname === "/company/login") {
    return <main className="min-h-screen bg-background">{children}</main>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r bg-card/95 backdrop-blur transition-transform lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between p-4">
          <div>
            <p className="text-xs text-muted-foreground">Delivery Company</p>
            <h1 className="text-lg font-semibold">Control Portal</h1>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Separator />
        <nav className="space-y-1 p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-3">
                <item.icon className="h-4 w-4" />
                {item.label}
              </span>
              {item.showBadge && <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-600">Action</span>}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <Separator className="mb-2" />
          <Button variant="ghost" className="w-full justify-start gap-3 text-sm text-muted-foreground" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b bg-card/85 backdrop-blur">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-6">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="min-w-0">
              <h2 className="truncate text-sm font-medium">
                {profile?.companyName || profile?.name || "Delivery Company Workspace"}
              </h2>
              <p className="truncate text-xs text-muted-foreground">
                {(profile?.departmentId ? profile?.departmentLabel || profile?.contactEmail : profile?.contactEmail) ||
                  "Manage orders, wallet, and integrations"}
                {profile?.actorRole ? ` • ${profile.actorRole}` : ""}
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <CompanyNotificationBell />
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 lg:px-6">{children}</main>
      </div>
    </div>
  );
}
