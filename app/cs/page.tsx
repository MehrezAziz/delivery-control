"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Headphones } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  READ_DRIVER_PROFILE: "Read Driver Profile",
  READ_CUSTOMER_PROFILE: "Read Customer Profile",
  UPDATE_DRIVER_STATUS: "Update Driver Status",
  UPDATE_CUSTOMER_STATUS: "Update Customer Status",
  VERIFY_ACCOUNTS: "Verify Accounts",
  ACCEPT_LOCAL_PAYMENT: "Accept Local Payment",
  VIEW_DELIVERIES: "View Deliveries",
  MANAGE_DISPUTES: "Manage Disputes",
  MANAGE_SUPPORT_TICKETS: "Manage Support Tickets",
  VIEW_FINANCIAL_REPORTS: "View Financial Reports",
};

interface MeData {
  pseudo: string;
  email: string;
  csRoles: string[];
}

export default function CSDashboardPage() {
  const [me, setMe] = useState<MeData | null>(null);

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(setMe);
  }, []);

  if (!me) return <div className="text-sm text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Customer Service Dashboard</h1>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <Headphones className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Welcome, {me.pseudo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">{me.email}</div>
          <div>
            <div className="text-sm font-medium mb-2">Your Permissions</div>
            {me.csRoles.length === 0 ? (
              <p className="text-sm text-muted-foreground">No permissions assigned. Contact your administrator.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {me.csRoles.map(role => (
                  <Badge key={role} variant="outline">{ROLE_LABELS[role] || role}</Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
