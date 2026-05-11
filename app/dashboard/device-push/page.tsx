import { StaffDevicePushPanel } from "@/components/staff-device-push-panel";

export default function AdminDevicePushPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mobile push (FCM)</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Link this browser session&apos;s staff account to a device token for payout alerts and other high-priority pushes.
        </p>
      </div>
      <StaffDevicePushPanel />
    </div>
  );
}
