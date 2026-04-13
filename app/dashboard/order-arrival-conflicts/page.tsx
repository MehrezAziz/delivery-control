import { OrderArrivalConflictsView } from "@/components/order-arrival-conflicts-view";

export default function OrderArrivalConflictsPage() {
  return (
    <OrderArrivalConflictsView
      listUrl="/api/admin/order-arrival-conflicts"
      resolveUrlPrefix="/api/admin/order-arrival-conflicts"
      orderDetailPrefix="/dashboard/orders"
    />
  );
}
