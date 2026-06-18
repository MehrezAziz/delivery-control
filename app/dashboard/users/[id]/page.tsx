import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { heroBackLinkClass } from "@/lib/hero-link-classes";
import { cn } from "@/lib/utils";
import UserStatusForm from "./user-status-form";
import { CustomerStatusIndicator } from "@/components/customer-status-indicator";
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  MapPin,
  Shield,
  Calendar,
  ShoppingBag,
  Truck,
  Ban,
} from "lucide-react";

export const dynamic = "force-dynamic";

function initials(first: string | null, second: string | null) {
  return `${first?.[0] ?? ""}${second?.[0] ?? ""}`.toUpperCase() || "?";
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { id } = await params;
  const { type } = await searchParams;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      customer: true,
      driver: { include: { driverVerifications: { orderBy: { submittedAt: "desc" as const }, take: 1 } } },
      addresses: {
        include: {
          delegation: {
            include: { governorate: { include: { country: true } } },
          },
        },
      },
      userRestrictions: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!user) notFound();

  const isCustomer = type === "customer" || !!user.customer;
  const isDriver = type === "driver" || !!user.driver;
  const hasDocuments = (user.driver?.driverVerifications?.length ?? 0) > 0;
  const activeRestrictions = user.userRestrictions.filter((r) => !r.liftedAt).length;

  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50/50 via-background to-background dark:from-violet-950/10">
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 via-indigo-600 to-slate-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.1),transparent_50%)]" />
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-5">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white/15 text-2xl font-bold backdrop-blur-sm">
                {initials(user.firstName, user.secondName)}
              </div>
              <div className="flex-1 min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href="/dashboard/users" className={heroBackLinkClass}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
                    Back to users
                  </Link>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  {user.firstName} {user.secondName}
                </h1>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-white/15 hover:bg-white/20 text-white border-white/20">
                    <User className="h-3 w-3 mr-1" />
                    {user.role}
                  </Badge>
                  {isCustomer && user.customer && (
                    <Badge className="bg-white/10 text-white/95 border-white/15">
                      <ShoppingBag className="h-3 w-3 mr-1" />
                      Customer
                    </Badge>
                  )}
                  {isDriver && user.driver && (
                    <Badge className="bg-white/10 text-white/95 border-white/15">
                      <Truck className="h-3 w-3 mr-1" />
                      {user.driver.status.replace(/_/g, " ")}
                    </Badge>
                  )}
                  {activeRestrictions > 0 && (
                    <Badge className="bg-red-500/80 text-white border-red-400/30">
                      <Ban className="h-3 w-3 mr-1" />
                      {activeRestrictions} restriction{activeRestrictions === 1 ? "" : "s"}
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-violet-100">
                  {user.phone && (
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      {user.phone}
                    </span>
                  )}
                  {(user.googleEmail || user.myEmail) && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" />
                      {user.googleEmail || user.myEmail}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="relative border-t border-white/20 grid grid-cols-2 sm:grid-cols-4 divide-x divide-white/15">
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-violet-200">Addresses</p>
              <p className="text-lg font-bold tabular-nums">{user.addresses.length}</p>
            </div>
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-violet-200">Restrictions</p>
              <p className="text-lg font-bold tabular-nums">{user.userRestrictions.length}</p>
            </div>
            {isCustomer && user.customer && (
              <div className="px-4 py-3 text-center">
                <p className="text-[10px] uppercase tracking-wide text-violet-200">Orders</p>
                <p className="text-lg font-bold tabular-nums">{user.customer.completedOrders}</p>
              </div>
            )}
            <div className="px-4 py-3 text-center">
              <p className="text-[10px] uppercase tracking-wide text-violet-200">Joined</p>
              <p className="text-sm font-semibold mt-0.5">{user.createdAt.toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <Card className="overflow-hidden border-violet-200/50 dark:border-violet-800/30">
          <div className="h-0.5 bg-gradient-to-r from-violet-500 via-indigo-500 to-blue-500" />
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-violet-600" />
              Basic information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { icon: User, label: "Full name", value: `${user.firstName} ${user.secondName}` },
                { icon: Phone, label: "Phone", value: user.phone || "—" },
                { icon: Mail, label: "Email", value: user.googleEmail || user.myEmail || "—" },
                { icon: Shield, label: "Gender", value: user.userGender || "—" },
                { icon: Shield, label: "Role", value: user.role },
                { icon: Calendar, label: "Created", value: user.createdAt.toLocaleDateString() },
              ].map((row) => (
                <div key={row.label} className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-1">
                    <row.icon className="h-3.5 w-3.5" />
                    {row.label}
                  </p>
                  <p className="text-sm font-medium">{row.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {user.addresses.length > 0 && (
          <Card className="overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-blue-500 to-cyan-500" />
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4 text-blue-600" />
                Addresses ({user.addresses.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {user.addresses.map((addr, i) => (
                  <div
                    key={addr.id}
                    className="rounded-xl border bg-gradient-to-br from-blue-50/50 to-transparent dark:from-blue-950/15 p-4"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40 text-xs font-bold text-blue-700 dark:text-blue-300">
                        {i + 1}
                      </div>
                      <span className="font-medium text-sm">Address {i + 1}</span>
                    </div>
                    <div className="space-y-1.5 text-sm text-muted-foreground">
                      <p><span className="text-foreground font-medium">Street:</span> {addr.street || "—"}</p>
                      <p><span className="text-foreground font-medium">Delegation:</span> {addr.delegation.nameDelegation}</p>
                      <p><span className="text-foreground font-medium">Governorate:</span> {addr.delegation.governorate.nameGovernorate}</p>
                      <p><span className="text-foreground font-medium">Country:</span> {addr.delegation.governorate.country.name}</p>
                      {addr.latitude && addr.longitude && (
                        <p className="text-xs font-mono pt-1">{addr.latitude}, {addr.longitude}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {isCustomer && user.customer && (
          <Card className="overflow-hidden border-emerald-200/40 dark:border-emerald-800/30">
            <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-emerald-600" />
                Customer profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <CustomerStatusIndicator status={user.customer.customerStatus} />
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Completed orders</p>
                  <p className="text-xl font-bold tabular-nums">{user.customer.completedOrders}</p>
                </div>
              </div>
              <Separator />
              <UserStatusForm userId={user.id} userType="customer" currentStatus={user.customer.customerStatus} />
            </CardContent>
          </Card>
        )}

        {isDriver && user.driver && (
          <Card className="overflow-hidden border-sky-200/40 dark:border-sky-800/30">
            <div className="h-0.5 bg-gradient-to-r from-sky-500 to-blue-500" />
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4 text-sky-600" />
                Driver profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <Badge>{user.driver.status.replace(/_/g, " ")}</Badge>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Vehicle</p>
                  <p className="font-medium">{user.driver.vehicleType || "—"}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Approved</p>
                  <p className="font-medium">{user.driver.approvedAt?.toLocaleDateString() || "—"}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-xs text-muted-foreground mb-1">Documents</p>
                  <Badge variant={hasDocuments ? "default" : "secondary"}>
                    {hasDocuments ? "Submitted" : "None"}
                  </Badge>
                </div>
              </div>
              <Separator />
              <UserStatusForm
                userId={user.id}
                userType="driver"
                currentStatus={user.driver.status}
                hasDocuments={hasDocuments}
              />
            </CardContent>
          </Card>
        )}

        {user.userRestrictions.length > 0 && (
          <Card className="overflow-hidden border-red-200/40 dark:border-red-800/30">
            <div className="h-0.5 bg-gradient-to-r from-red-500 to-rose-500" />
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Ban className="h-4 w-4 text-red-600" />
                Restrictions history
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {user.userRestrictions.map((r) => (
                  <div
                    key={r.id}
                    className={cn(
                      "rounded-xl border p-4",
                      !r.liftedAt && "border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-800/40",
                    )}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={r.liftedAt ? "secondary" : "destructive"}>{r.type}</Badge>
                      {r.liftedAt && <span className="text-xs text-muted-foreground">Lifted</span>}
                    </div>
                    <p className="text-sm mt-2">{r.reason}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {r.startDate.toLocaleDateString()} — {r.endDate?.toLocaleDateString() || "Permanent"}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
