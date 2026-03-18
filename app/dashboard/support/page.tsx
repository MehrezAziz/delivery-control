"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Ticket {
  id: string;
  userId: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  createdAt: string;
  user: { id: string; firstName: string | null; secondName: string | null; role: string; phone: string | null };
  customerService: { superUser: { pseudo: string } } | null;
  messages: { content: string; senderType: string; timestamp: string }[];
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  OPEN: "destructive",
  IN_PROGRESS: "default",
  RESOLVED: "secondary",
  CLOSED: "outline",
};

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  URGENT: "destructive",
  HIGH: "destructive",
  MEDIUM: "default",
  LOW: "secondary",
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    const url = filter === "ALL" ? "/api/cs/support" : `/api/cs/support?status=${filter}`;
    fetch(url)
      .then(async r => { if (!r.ok) { const d = await r.json(); throw new Error(d.error); } return r.json(); })
      .then(setTickets)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [filter]);

  if (loading) return <div className="text-sm text-muted-foreground">Loading...</div>;
  if (error) return <Card><CardContent className="py-8"><p className="text-sm text-red-500 text-center">{error}</p></CardContent></Card>;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Support Tickets (Admin View)</h1>

      <div className="flex gap-2 mb-4 flex-wrap">
        {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map(s => (
          <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => { setLoading(true); setFilter(s); }}>
            {s.replace("_", " ")}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>All Tickets ({tickets.length})</CardTitle></CardHeader>
        <CardContent>
          {tickets.length === 0 ? (
            <p className="text-muted-foreground text-sm">No tickets found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned To</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.map(t => (
                  <TableRow key={t.id}>
                    <TableCell>{t.user.firstName} {t.user.secondName}</TableCell>
                    <TableCell><Badge variant="outline">{t.user.role}</Badge></TableCell>
                    <TableCell className="text-sm">{t.category.replace("_", " ")}</TableCell>
                    <TableCell><Badge variant={PRIORITY_VARIANT[t.priority] || "secondary"}>{t.priority}</Badge></TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[t.status] || "secondary"}>{t.status.replace("_", " ")}</Badge></TableCell>
                    <TableCell className="text-sm">{t.customerService?.superUser.pseudo || "Unassigned"}</TableCell>
                    <TableCell className="text-xs">{new Date(t.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Link href={`/dashboard/support/${t.id}`}>
                        <Button variant="outline" size="sm">View Chat</Button>
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
