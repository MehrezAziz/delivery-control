"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CustomerStatusIndicator } from "@/components/customer-status-indicator";
import { Button } from "@/components/ui/button";

interface Customer {
  id: string;
  userId: string;
  firstName: string | null;
  secondName: string | null;
  phone: string | null;
  email: string | null;
  customerStatus: string;
  completedOrders: number;
}

export default function CSCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cs/customers")
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error); });
        return r.json();
      })
      .then(setCustomers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return (
    <Card>
      <CardContent className="py-8">
        <p className="text-sm text-red-500 text-center">{error}</p>
      </CardContent>
    </Card>
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Customer Management</h1>
      <Card>
        <CardHeader><CardTitle>Customers ({customers.length})</CardTitle></CardHeader>
        <CardContent>
          {customers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No customers found.</p>
          ) : (
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
                    <TableCell>{c.firstName} {c.secondName}</TableCell>
                    <TableCell>{c.phone || "-"}</TableCell>
                    <TableCell>{c.email || "-"}</TableCell>
                    <TableCell>
                      <CustomerStatusIndicator status={c.customerStatus} />
                    </TableCell>
                    <TableCell>{c.completedOrders}</TableCell>
                    <TableCell>
                      <Link href={`/cs/customers/${c.id}`}>
                        <Button variant="outline" size="sm">View</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
