"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Driver {
  id: string;
  userId: string;
  firstName: string | null;
  secondName: string | null;
  phone: string | null;
  vehicleType: string | null;
  status: string;
  approvedAt: string | null;
}

export default function CSDriversPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/cs/drivers")
      .then(r => {
        if (!r.ok) return r.json().then(d => { throw new Error(d.error); });
        return r.json();
      })
      .then(setDrivers)
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
      <h1 className="text-2xl font-semibold mb-6">Driver Management</h1>
      <Card>
        <CardHeader><CardTitle>Drivers ({drivers.length})</CardTitle></CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <p className="text-muted-foreground text-sm">No drivers found.</p>
          ) : (
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
                    <TableCell>{d.firstName} {d.secondName}</TableCell>
                    <TableCell>{d.phone || "-"}</TableCell>
                    <TableCell>{d.vehicleType || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={d.status === "VERIFIED" ? "default" : "secondary"}>
                        {d.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/cs/drivers/${d.id}`}>
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
