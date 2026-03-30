"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Headphones } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Delivery Control Panel</CardTitle>
          <p className="text-sm text-muted-foreground">Select your role to continue</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            className="w-full h-20 flex items-center gap-4 text-left justify-start px-6"
            onClick={() => router.push("/login/admin")}
          >
            <Shield className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <div className="font-semibold text-base">Administrator</div>
              <div className="text-xs text-muted-foreground">Full platform management access</div>
            </div>
          </Button>
          <Button
            variant="outline"
            className="w-full h-20 flex items-center gap-4 text-left justify-start px-6"
            onClick={() => router.push("/login/customer-service")}
          >
            <Headphones className="h-8 w-8 text-muted-foreground shrink-0" />
            <div>
              <div className="font-semibold text-base">Customer Service</div>
              <div className="text-xs text-muted-foreground">Support and user management</div>
            </div>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
