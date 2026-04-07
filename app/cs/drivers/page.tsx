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
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
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
        <CardHeader>
          <CardTitle>Drivers ({drivers.length})</CardTitle>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name/phone"
              className="border rounded px-2 py-1 text-sm"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="INCOMPLETE">Incomplete</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="PAUSED">Paused</option>
            </select>
          </div>
        </CardHeader>
        <CardContent>
          {drivers.filter((d) => {
            const name = `${d.firstName || ""} ${d.secondName || ""}`.toLowerCase();
            const matchSearch =
              !search ||
              name.includes(search.toLowerCase()) ||
              (d.phone || "").toLowerCase().includes(search.toLowerCase());
            const matchStatus = statusFilter === "ALL" || d.status === statusFilter;
            return matchSearch && matchStatus;
          }).length === 0 ? (
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
                {drivers
                  .filter((d) => {
                    const name = `${d.firstName || ""} ${d.secondName || ""}`.toLowerCase();
                    const matchSearch =
                      !search ||
                      name.includes(search.toLowerCase()) ||
                      (d.phone || "").toLowerCase().includes(search.toLowerCase());
                    const matchStatus = statusFilter === "ALL" || d.status === statusFilter;
                    return matchSearch && matchStatus;
                  })
                  .map(d => (
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
