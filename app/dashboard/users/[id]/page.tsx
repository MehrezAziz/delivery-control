import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import UserStatusForm from "./user-status-form";
import { CustomerStatusIndicator } from "@/components/customer-status-indicator";


export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ type?: string }> }) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        
        <h1 className="text-2xl font-semibold">User Details</h1>
        <Link href="/dashboard/users">
          <Button variant="outline" size="sm">← Go back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Basic Info</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div><span className="text-sm text-muted-foreground">Name:</span> <span className="ml-2">{user.firstName} {user.secondName}</span></div>
          <div><span className="text-sm text-muted-foreground">Phone:</span> <span className="ml-2">{user.phone || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Email:</span> <span className="ml-2">{user.googleEmail || user.myEmail || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Gender:</span> <span className="ml-2">{user.userGender || "-"}</span></div>
          <div><span className="text-sm text-muted-foreground">Role:</span> <Badge className="ml-2">{user.role}</Badge></div>
          <div><span className="text-sm text-muted-foreground">Created:</span> <span className="ml-2">{user.createdAt.toLocaleDateString()}</span></div>
        </CardContent>
      </Card>

      {/* Addresses (for both customer and driver) */}
      {user.addresses.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Addresses ({user.addresses.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.addresses.map((addr, i) => (
                <div key={addr.id} className="border rounded p-3 text-sm">
                  <div className="font-medium">Address {i + 1}</div>
                  <div className="grid gap-2 sm:grid-cols-2 mt-2 text-muted-foreground">
                    <div>Street: {addr.street || "-"}</div>
                    <div>Delegation: {addr.delegation.nameDelegation}</div>
                    <div>Governorate: {addr.delegation.governorate.nameGovernorate}</div>
                    <div>Country: {addr.delegation.governorate.country.name}</div>
                    {addr.latitude && addr.longitude && (
                      <div className="sm:col-span-2">Coords: {addr.latitude}, {addr.longitude}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isCustomer && user.customer && (
        <Card>
          <CardHeader><CardTitle>Customer Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">Status:</span>
                <CustomerStatusIndicator status={user.customer.customerStatus} />
              </div>
              <div><span className="text-sm text-muted-foreground">Completed Orders:</span> <span className="ml-2">{user.customer.completedOrders}</span></div>
            </div>
            <Separator />
            <UserStatusForm userId={user.id} userType="customer" currentStatus={user.customer.customerStatus} />
          </CardContent>
        </Card>
      )}

      {isDriver && user.driver && (
        <Card>
          <CardHeader><CardTitle>Driver Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div><span className="text-sm text-muted-foreground">Status:</span> <Badge className="ml-2">{user.driver.status}</Badge></div>
              <div><span className="text-sm text-muted-foreground">Vehicle:</span> <span className="ml-2">{user.driver.vehicleType || "-"}</span></div>
              <div><span className="text-sm text-muted-foreground">Approved At:</span> <span className="ml-2">{user.driver.approvedAt?.toLocaleDateString() || "-"}</span></div>
              <div><span className="text-sm text-muted-foreground">Has Documents:</span> <span className="ml-2">{hasDocuments ? "Yes" : "No"}</span></div>
            </div>
            <Separator />
            <UserStatusForm userId={user.id} userType="driver" currentStatus={user.driver.status} hasDocuments={hasDocuments} />
          </CardContent>
        </Card>
      )}

      {user.userRestrictions.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Restrictions History</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {user.userRestrictions.map(r => (
                <div key={r.id} className="border rounded p-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={r.liftedAt ? "secondary" : "destructive"}>{r.type}</Badge>
                    {r.liftedAt && <span className="text-xs text-muted-foreground">(Lifted)</span>}
                  </div>
                  <p className="text-sm mt-1">{r.reason}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {r.startDate.toLocaleDateString()} - {r.endDate?.toLocaleDateString() || "Permanent"}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
