import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CustomerStatusIndicator } from "@/components/customer-status-indicator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const [customers, drivers] = await Promise.all([
    prisma.customer.findMany({
      include: { user: true },
      orderBy: { user: { createdAt: "desc" } },
      take: 100,
    }),
    prisma.driver.findMany({
      include: { user: true },
      orderBy: { user: { createdAt: "desc" } },
      take: 100,
    }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">User Management</h1>
      <Tabs defaultValue="customers">
        <TabsList>
          <TabsTrigger value="customers">Customers ({customers.length})</TabsTrigger>
          <TabsTrigger value="drivers">Drivers ({drivers.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Orders</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(c => (
                <TableRow key={c.id}>
                  <TableCell>{c.user.firstName} {c.user.secondName}</TableCell>
                  <TableCell>{c.user.phone || "-"}</TableCell>
                  <TableCell>{c.user.googleEmail || c.user.myEmail || "-"}</TableCell>
                  <TableCell><CustomerStatusIndicator status={c.customerStatus} /></TableCell>
                  <TableCell>{c.completedOrders}</TableCell>
                  <TableCell>
                    <Link href={`/dashboard/users/${c.user.id}?type=customer`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="drivers" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Vehicle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {drivers.map(d => (
                <TableRow key={d.id}>
                  <TableCell>{d.user.firstName} {d.user.secondName}</TableCell>
                  <TableCell>{d.user.phone || "-"}</TableCell>
                  <TableCell>{d.vehicleType || "-"}</TableCell>
                  <TableCell><Badge variant={d.status === "VERIFIED" ? "default" : "secondary"}>{d.status}</Badge></TableCell>
                  <TableCell>
                    <Link href={`/dashboard/users/${d.user.id}?type=driver`}>
                      <Button variant="outline" size="sm">View</Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </div>
  );
}
