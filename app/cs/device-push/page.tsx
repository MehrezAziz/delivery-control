import { StaffDevicePushPanel } from "@/components/staff-device-push-panel";

export default function CsDevicePushPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mobile push (FCM)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Register your device token to receive push notifications for fiat payout requests and other staff alerts.
        </p>
      </div>
      <StaffDevicePushPanel />
    </div>
  );
}
