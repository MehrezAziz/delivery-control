import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Truck, ShoppingCart, AlertTriangle } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [customerCount, driverCount, orderCount, pendingDrivers] = await Promise.all([
    prisma.customer.count(),
    prisma.driver.count(),
    prisma.order.count(),
    prisma.driver.count({ where: { status: "PENDING_REVIEW" } }),
  ]);

  const stats = [
    { label: "Customers", value: customerCount, icon: Users, color: "text-blue-600" },
    { label: "Drivers", value: driverCount, icon: Truck, color: "text-green-600" },
    { label: "Orders", value: orderCount, icon: ShoppingCart, color: "text-purple-600" },
    { label: "Pending Drivers", value: pendingDrivers, icon: AlertTriangle, color: "text-orange-600" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(s => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`h-4 w-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">Statistics details will be added later.</p>
    </div>
  );
}
