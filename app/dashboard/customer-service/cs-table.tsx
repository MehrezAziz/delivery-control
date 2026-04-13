"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ALL_ROLES = [
  "READ_DRIVER_PROFILE", "READ_CUSTOMER_PROFILE", "UPDATE_DRIVER_STATUS",
  "UPDATE_CUSTOMER_STATUS", "VERIFY_ACCOUNTS", "ACCEPT_LOCAL_PAYMENT",
  "VIEW_DELIVERIES", "MANAGE_DISPUTES", "MANAGE_SUPPORT_TICKETS",
  "VIEW_FINANCIAL_REPORTS", "MANAGE_FINANCIAL_REPORTS",
];

interface CSUser {
  id: string;
  roles: string[];
  superUser: {
    id: string;
    pseudo: string;
    email: string;
    telephone: string;
    status: string;
  };
}

export default function CSTable({ csUsers }: { csUsers: CSUser[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function startEdit(cs: CSUser) {
    setEditingId(cs.id);
    setEditRoles([...cs.roles]);
    setNewPassword("");
    setError("");
    setSuccess("");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditRoles([]);
    setNewPassword("");
    setError("");
    setSuccess("");
  }

  function toggleRole(role: string) {
    setEditRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  async function handleSave(csId: string) {
    setError("");
    setSuccess("");

    if (editRoles.length === 0) {
      setError("Select at least one role");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const body: any = { roles: editRoles };
      if (newPassword) body.password = newPassword;

      const res = await fetch(`/api/customer-service/${csId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to update");
        return;
      }
      setSuccess("Updated successfully");
      setNewPassword("");
      setTimeout(() => {
        setEditingId(null);
        setSuccess("");
        router.refresh();
      }, 1000);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (csUsers.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Customer Service Accounts (0)</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No customer service accounts yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader><CardTitle>Customer Service Accounts ({csUsers.length})</CardTitle></CardHeader>
      <CardContent className="space-y-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pseudo</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {csUsers.map(cs => (
              <Fragment key={cs.id}>
                <TableRow>
                  <TableCell className="font-medium">{cs.superUser.pseudo}</TableCell>
                  <TableCell>{cs.superUser.email}</TableCell>
                  <TableCell>{cs.superUser.telephone}</TableCell>
                  <TableCell>
                    <Badge variant={cs.superUser.status === "ACTIVE" ? "default" : "secondary"}>
                      {cs.superUser.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {cs.roles.map(r => (
                        <Badge key={r} variant="outline" className="text-xs">
                          {r.replace(/_/g, " ")}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Link href={`/dashboard/customer-service/${cs.id}/governorates`}>
                        <Button variant="secondary" size="sm">Coverage</Button>
                      </Link>
                      {editingId === cs.id ? (
                        <Button variant="ghost" size="sm" onClick={cancelEdit}>Cancel</Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => startEdit(cs)}>
                          Edit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                {editingId === cs.id && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="bg-muted rounded-lg p-4 space-y-4 border">
                        {/* Roles */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">Permissions</p>
                          <div className="flex flex-wrap gap-2">
                            {ALL_ROLES.map(role => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => toggleRole(role)}
                                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                                  editRoles.includes(role)
                                    ? "bg-primary text-primary-foreground border-primary"
                                    : "bg-card border-border hover:bg-accent"
                                }`}
                              >
                                {role.replace(/_/g, " ")}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">Change Password</p>
                          <Input
                            type="password"
                            placeholder="Leave empty to keep current password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="max-w-sm"
                          />
                        </div>

                        {error && <p className="text-sm text-red-500">{error}</p>}
                        {success && <p className="text-sm text-green-600">{success}</p>}

                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => handleSave(cs.id)} disabled={saving}>
                            {saving ? "Saving..." : "Save Changes"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={cancelEdit}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
