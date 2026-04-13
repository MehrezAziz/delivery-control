function statusColor(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "#22c55e";
    case "CREATED":
    case "VERIFIED":
      return "#9ca3af";
    case "SUSPENDED":
      return "#f97316";
    case "BLOCKED":
      return "#ef4444";
    default:
      return "#9ca3af";
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "CREATED":
      return "Created";
    case "VERIFIED":
      return "Verified";
    case "SUSPENDED":
      return "Suspended";
    case "BLOCKED":
      return "Blocked";
    default:
      return status;
  }
}

/** Customer account status with colored dot: green active, gray created/verified, orange suspended, red blocked. */
export function CustomerStatusIndicator({ status }: { status: string }) {
  const color = statusColor(status);
  const label = statusLabel(status);
  return (
    <span className="inline-flex items-center gap-2" title={status}>
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      <span className="font-medium">{label}</span>
    </span>
  );
}
