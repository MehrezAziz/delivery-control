"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Headphones,
  Mail,
  Phone,
  MapPin,
  Pencil,
  Shield,
  BarChart3,
  KeyRound,
  Users,
} from "lucide-react";
import { CsRolePicker } from "@/components/admin/cs-role-picker";
import { CS_ROLE_CATEGORIES, formatCsRole } from "@/lib/cs-roles";

interface CSUser {
  id: string;
  roles: string[];
  financialAnalyticsMaxDays: number;
  superUser: {
    id: string;
    pseudo: string;
    email: string;
    telephone: string;
    status: string;
  };
}

function RoleBadges({ roles }: { roles: string[] }) {
  if (roles.length === 0) {
    return <span className="text-xs text-muted-foreground italic">No permissions</span>;
  }

  return (
    <div className="space-y-2">
      {CS_ROLE_CATEGORIES.map((category) => {
        const matched = category.roles.filter((r) => roles.includes(r));
        if (matched.length === 0) return null;
        return (
          <div key={category.id}>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              {category.label}
            </p>
            <div className="flex flex-wrap gap-1">
              {matched.map((r) => (
                <Badge key={r} variant="secondary" className="text-[11px] font-normal">
                  {formatCsRole(r)}
                </Badge>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function initials(pseudo: string): string {
  return pseudo
    .split(/[\s._-]+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function CSTable({ csUsers }: { csUsers: CSUser[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editRoles, setEditRoles] = useState<string[]>([]);
  const [newPassword, setNewPassword] = useState("");
  const [editMaxDays, setEditMaxDays] = useState<number>(7);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function startEdit(cs: CSUser) {
    setEditingId(cs.id);
    setEditRoles([...cs.roles]);
    setEditMaxDays(cs.financialAnalyticsMaxDays || 7);
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

  async function handleSave(csId: string) {
    setError("");
    setSuccess("");

    if (editRoles.length === 0) {
      setError("Select at least one permission");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setSaving(true);
    try {
      const body: {
        roles: string[];
        financialAnalyticsMaxDays: number;
        password?: string;
      } = { roles: editRoles, financialAnalyticsMaxDays: editMaxDays };
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
      <Card className="border-dashed">
        <CardContent className="py-14 text-center space-y-3">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
            <Users className="h-7 w-7 text-teal-600" />
          </div>
          <p className="font-medium">No customer service accounts yet</p>
          <p className="text-sm text-muted-foreground">
            Create the first account using the form above.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Headphones className="h-5 w-5 text-teal-600" />
          Accounts
          <Badge variant="secondary" className="font-normal">
            {csUsers.length}
          </Badge>
        </h2>
      </div>

      <div className="space-y-4">
        {csUsers.map((cs) => {
          const isEditing = editingId === cs.id;
          const isActive = cs.superUser.status === "ACTIVE";

          return (
            <Card
              key={cs.id}
              className={`overflow-hidden transition-shadow ${isEditing ? "ring-2 ring-teal-500/40 shadow-md" : "hover:shadow-sm"}`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 text-white font-semibold text-sm">
                      {initials(cs.superUser.pseudo)}
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base truncate">{cs.superUser.pseudo}</CardTitle>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge
                          variant={isActive ? "default" : "secondary"}
                          className={isActive ? "bg-emerald-600 hover:bg-emerald-600 text-xs" : "text-xs"}
                        >
                          {cs.superUser.status}
                        </Badge>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {cs.roles.length} permission{cs.roles.length === 1 ? "" : "s"}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          Analytics: {cs.financialAnalyticsMaxDays}d max
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link href={`/dashboard/customer-service/${cs.id}/governorates`}>
                      <Button variant="outline" size="sm">
                        <MapPin className="h-3.5 w-3.5 mr-1.5" />
                        Coverage
                      </Button>
                    </Link>
                    {isEditing ? (
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    ) : (
                      <Button variant="outline" size="sm" onClick={() => startEdit(cs)}>
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {!isEditing && (
                  <>
                    <div className="grid gap-2 sm:grid-cols-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{cs.superUser.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        <span>{cs.superUser.telephone}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        Permissions by category
                      </p>
                      <RoleBadges roles={cs.roles} />
                    </div>
                  </>
                )}

                {isEditing && (
                  <div className="rounded-xl border bg-muted/20 p-4 sm:p-5 space-y-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-teal-600" />
                        <Label className="text-base">Permissions</Label>
                        <span className="text-xs text-muted-foreground ml-auto tabular-nums">
                          {editRoles.length} selected
                        </span>
                      </div>
                      <CsRolePicker
                        selected={editRoles}
                        onChange={setEditRoles}
                        disabled={saving}
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-muted-foreground" />
                          <Label>Analytics max range (days)</Label>
                        </div>
                        <Input
                          type="number"
                          min={1}
                          max={3650}
                          value={editMaxDays}
                          onChange={(e) => setEditMaxDays(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <KeyRound className="h-4 w-4 text-muted-foreground" />
                          <Label>New password</Label>
                        </div>
                        <Input
                          type="password"
                          placeholder="Leave empty to keep current"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                        />
                      </div>
                    </div>

                    {error && (
                      <p className="text-sm text-red-600 dark:text-red-400 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2">
                        {error}
                      </p>
                    )}
                    {success && (
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
                        {success}
                      </p>
                    )}

                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        onClick={() => void handleSave(cs.id)}
                        disabled={saving}
                        className="bg-teal-600 hover:bg-teal-700"
                      >
                        {saving ? "Saving…" : "Save changes"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
