"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard, Users, Truck, LogOut, Menu, X, Headphones, MessageSquare, Package,
} from "lucide-react";

export default function CSLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Session security: if sessionStorage flag is missing (window was closed), force re-auth
  useEffect(() => {
    const sessionActive = sessionStorage.getItem("session_active");
    if (!sessionActive) {
      fetch("/api/auth/logout", { method: "POST" }).then(() => {
        window.location.href = "/login/customer-service";
      });
    }
  }, []);

  async function handleLogout() {
    sessionStorage.removeItem("session_active");
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // CS nav items — pages will check individual role permissions
  const navItems = [
    { href: "/cs", label: "Dashboard", icon: LayoutDashboard },
    { href: "/cs/customers", label: "Customers", icon: Users },
    { href: "/cs/drivers", label: "Drivers", icon: Truck },
    { href: "/cs/orders", label: "Orders", icon: Package },
    { href: "/cs/support", label: "Support", icon: MessageSquare },
  ];

  const isActive = (href: string) =>
    href === "/cs" ? pathname === "/cs" : pathname.startsWith(href);

  return (
    <div className="flex h-screen bg-zinc-50">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-zinc-600" />
            <h1 className="text-lg font-semibold">CS Panel</h1>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <Separator />
        <nav className="flex flex-col gap-1 p-2">
          {navItems.map(item => (
            <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${isActive(item.href) ? "bg-zinc-100 font-medium" : "hover:bg-zinc-50 text-muted-foreground"}`}>
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

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-4 border-b bg-white px-4 py-3 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h2 className="text-sm font-medium text-muted-foreground">Customer Service Panel</h2>
        </header>
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
