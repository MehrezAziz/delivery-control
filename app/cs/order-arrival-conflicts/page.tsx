import { OrderArrivalConflictsView } from "@/components/order-arrival-conflicts-view";

export default function CSOrderArrivalConflictsPage() {
  return (
    <OrderArrivalConflictsView
      listUrl="/api/cs/order-arrival-conflicts"
      resolveUrlPrefix="/api/cs/order-arrival-conflicts"
      orderDetailPrefix="/cs/orders"
    />
  );
}
