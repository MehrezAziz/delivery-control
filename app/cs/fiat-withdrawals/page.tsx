import { FiatWithdrawalsPanel } from "@/components/fiat-withdrawals-panel";

export default function CsFiatWithdrawalsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Fiat payout queue</h1>
      <FiatWithdrawalsPanel />
    </div>
  );
}
