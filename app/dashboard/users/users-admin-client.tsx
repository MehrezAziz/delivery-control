"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CustomerStatusIndicator } from "@/components/customer-status-indicator";
import {
  Users,
  User,
  Truck,
  Search,
  ChevronRight,
  Mail,
  Phone,
  ShoppingBag,
  Car,
  ShieldCheck,
  UserCheck,
} from "lucide-react";

export type CustomerRow = {
  id: string;
  userId: string;
  firstName: string;
  secondName: string;
  phone: string | null;
  email: string | null;
  customerStatus: string;
  completedOrders: number;
  createdAt: string;
};

export type DriverRow = {
  id: string;
  userId: string;
  firstName: string;
  secondName: string;
  phone: string | null;
  vehicleType: string | null;
  status: string;
  createdAt: string;
};

function initials(first: string, second: string) {
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase() || "?";
}

function fullName(first: string, second: string) {
  return `${first ?? ""} ${second ?? ""}`.trim() || "—";
}

function driverStatusClass(status: string) {
  if (status === "VERIFIED") return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";
  if (status === "PENDING_REVIEW") return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  if (status === "REJECTED" || status === "SUSPENDED") return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  if (status === "PAUSED") return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
  return "bg-muted text-muted-foreground";
}

function formatDriverStatus(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function matchesSearch(
  q: string,
  fields: (string | null | undefined)[],
) {
  const hay = fields.filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

export function UsersAdminClient({
  customers,
  drivers,
}: {
  customers: CustomerRow[];
  drivers: DriverRow[];
}) {
  const [tab, setTab] = useState("customers");
  const [search, setSearch] = useState("");

  const q = search.trim().toLowerCase();

  const filteredCustomers = useMemo(() => {
    if (!q) return customers;
    return customers.filter((c) =>
      matchesSearch(q, [
        c.firstName,
        c.secondName,
        c.phone,
        c.email,
        c.customerStatus,
        c.userId,
      ]),
    );
  }, [customers, q]);

  const filteredDrivers = useMemo(() => {
    if (!q) return drivers;
    return drivers.filter((d) =>
      matchesSearch(q, [
        d.firstName,
        d.secondName,
        d.phone,
        d.vehicleType,
        d.status,
        d.userId,
      ]),
    );
  }, [drivers, q]);

  const activeCustomers = customers.filter((c) => c.customerStatus === "ACTIVE").length;
  const verifiedDrivers = drivers.filter((d) => d.status === "VERIFIED").length;
  const pendingDrivers = drivers.filter((d) => d.status === "PENDING_REVIEW").length;

  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50/50 via-background to-background dark:from-violet-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative p-6 sm:p-8 space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
              <Users className="h-3.5 w-3.5" />
              Platform users
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
              <Users className="h-8 w-8 opacity-90" />
              User Management
            </h1>
            <p className="text-violet-100 text-sm max-w-2xl">
              Browse customers and drivers, review account status, and open profiles for detailed
              management. Showing the 100 most recently registered per role.
            </p>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/15">
            <HeroStat icon={<User className="h-3.5 w-3.5" />} label="Customers" value={customers.length} />
            <HeroStat icon={<UserCheck className="h-3.5 w-3.5" />} label="Active" value={activeCustomers} />
            <HeroStat icon={<Truck className="h-3.5 w-3.5" />} label="Drivers" value={drivers.length} />
            <HeroStat icon={<ShieldCheck className="h-3.5 w-3.5" />} label="Verified" value={verifiedDrivers} />
          </div>
        </div>

        {/* Search + tabs */}
        <Card className="overflow-hidden border-violet-200/50 dark:border-violet-800/30">
          <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" />
          <CardContent className="pt-5 pb-4">
            <div className="relative max-w-md mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone, email, status…"
                className="pl-9"
              />
            </div>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="grid w-full max-w-md grid-cols-2 h-10">
                <TabsTrigger value="customers" className="gap-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                  <User className="h-4 w-4" />
                  Customers
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] tabular-nums">
                    {filteredCustomers.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="drivers" className="gap-2 data-[state=active]:bg-violet-600 data-[state=active]:text-white">
                  <Truck className="h-4 w-4" />
                  Drivers
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] tabular-nums">
                    {filteredDrivers.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="customers" className="mt-4">
                <UserTable
                  type="customer"
                  rows={filteredCustomers}
                  emptyMessage={search ? "No customers match your search." : "No customers yet."}
                />
              </TabsContent>

              <TabsContent value="drivers" className="mt-4">
                {pendingDrivers > 0 && tab === "drivers" && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {pendingDrivers} driver{pendingDrivers === 1 ? "" : "s"} pending review
                  </p>
                )}
                <UserTable
                  type="driver"
                  rows={filteredDrivers}
                  emptyMessage={search ? "No drivers match your search." : "No drivers yet."}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function HeroStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="px-4 py-3 text-center sm:px-5">
      <div className="flex items-center justify-center gap-1.5 text-violet-200 text-[10px] uppercase tracking-wide mb-0.5">
        {icon}
        {label}
      </div>
      <p className="text-xl font-bold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function UserTable({
  type,
  rows,
  emptyMessage,
}: {
  type: "customer" | "driver";
  rows: CustomerRow[] | DriverRow[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="py-14 text-center space-y-3 rounded-xl border border-dashed">
        <div className="mx-auto w-12 h-12 rounded-xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
          {type === "customer" ? (
            <User className="h-6 w-6 text-violet-600" />
          ) : (
            <Truck className="h-6 w-6 text-violet-600" />
          )}
        </div>
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden border-0 shadow-none">
      <CardHeader className="py-3 px-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {type === "customer" ? "Customer accounts" : "Driver accounts"}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="rounded-xl border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-muted/30">
                <TableHead>User</TableHead>
                <TableHead>Contact</TableHead>
                {type === "driver" && <TableHead>Vehicle</TableHead>}
                <TableHead>Status</TableHead>
                {type === "customer" && <TableHead>Orders</TableHead>}
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {type === "customer"
                ? (rows as CustomerRow[]).map((c) => (
                    <TableRow
                      key={c.id}
                      className="group hover:bg-violet-50/50 dark:hover:bg-violet-950/15"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-600 text-white text-xs font-semibold">
                            {initials(c.firstName, c.secondName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {fullName(c.firstName, c.secondName)}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                              {c.userId.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5 text-sm">
                          {c.phone && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Phone className="h-3 w-3 shrink-0" />
                              {c.phone}
                            </div>
                          )}
                          {c.email && (
                            <div className="flex items-center gap-1.5 text-muted-foreground truncate max-w-[180px]">
                              <Mail className="h-3 w-3 shrink-0" />
                              <span className="truncate">{c.email}</span>
                            </div>
                          )}
                          {!c.phone && !c.email && <span className="text-muted-foreground">—</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <CustomerStatusIndicator status={c.customerStatus} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 tabular-nums text-sm font-medium">
                          <ShoppingBag className="h-3.5 w-3.5 text-muted-foreground" />
                          {c.completedOrders}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/users/${c.userId}?type=customer`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-70 group-hover:opacity-100 text-violet-600"
                          >
                            View
                            <ChevronRight className="h-4 w-4 ml-0.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))
                : (rows as DriverRow[]).map((d) => (
                    <TableRow
                      key={d.id}
                      className="group hover:bg-violet-50/50 dark:hover:bg-violet-950/15"
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-slate-600 text-white text-xs font-semibold">
                            {initials(d.firstName, d.secondName)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">
                              {fullName(d.firstName, d.secondName)}
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono truncate">
                              {d.userId.slice(0, 8)}…
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {d.phone ? (
                          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            {d.phone}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-sm">
                          <Car className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          {d.vehicleType || "—"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${driverStatusClass(d.status)}`}
                        >
                          {formatDriverStatus(d.status)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Link href={`/dashboard/users/${d.userId}?type=driver`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-70 group-hover:opacity-100 text-violet-600"
                          >
                            View
                            <ChevronRight className="h-4 w-4 ml-0.5" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
