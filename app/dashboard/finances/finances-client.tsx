"use client";

import { Fragment, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface DriverAccount {
  id: string;
  driverId: string;
  balance: number;
  currency: string;
  completedDeliveries: number;
  driverName: string;
  phone: string | null;
  driverStatus: string;
  createdAt: string;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  referenceId: string | null;
  referenceType: string | null;
  description: string | null;
  balanceAfter: number;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  PLATFORM_FEE: "bg-red-100 text-red-700",
  DEPOSIT: "bg-green-100 text-green-700",
  BONUS: "bg-blue-100 text-blue-700",
  PENALTY: "bg-orange-100 text-orange-700",
  ADJUSTMENT: "bg-purple-100 text-purple-700",
  DISPUTE_DEBIT: "bg-red-100 text-red-700",
  WITHDRAWAL: "bg-yellow-100 text-yellow-700",
  REFUND: "bg-gray-100 text-gray-700",
};

type BalanceFilter = "all" | "negative" | "positive" | "zero";
type DateFilter = "all" | "today" | "week" | "month" | "year";

function getDateRange(filter: DateFilter): Date | null {
  if (filter === "all") return null;
  const now = new Date();
  if (filter === "today") return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (filter === "week") {
    const d = new Date(now);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }
  if (filter === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (filter === "year") return new Date(now.getFullYear(), 0, 1);
  return null;
}

export default function FinancesClient({ accounts }: { accounts: DriverAccount[] }) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);
  const [negativeBalanceInfo, setNegativeBalanceInfo] = useState<{ negativeBalanceSince: string; daysRemainingToPay: number; maxNegativeDays: number } | null>(null);
  const [search, setSearch] = useState("");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  // Deposit/adjustment form
  const [amount, setAmount] = useState("");
  const [txType, setTxType] = useState("DEPOSIT");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const filtered = useMemo(() => {
    let result = accounts;
    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(a => a.driverName.toLowerCase().includes(q) || (a.phone || "").includes(q));
    }
    // Balance filter
    if (balanceFilter === "negative") result = result.filter(a => a.balance < 0);
    else if (balanceFilter === "positive") result = result.filter(a => a.balance > 0);
    else if (balanceFilter === "zero") result = result.filter(a => a.balance === 0);
    // Date filter (by account creation)
    const dateStart = getDateRange(dateFilter);
    if (dateStart) result = result.filter(a => new Date(a.createdAt) >= dateStart);
    return result;
  }, [accounts, search, balanceFilter, dateFilter]);

  async function toggleExpand(accountId: string) {
    if (expandedId === accountId) { setExpandedId(null); return; }
    setExpandedId(accountId);
    setTransactions([]);
    setNegativeBalanceInfo(null);
    setAmount(""); setDescription(""); setTxType("DEPOSIT");
    setError(""); setSuccess("");
    setLoadingTx(true);
    try {
      const res = await fetch(`/api/drivers/finances/${accountId}`);
      const data = await res.json();
      if (data.transactions) setTransactions(data.transactions);
      if (data.negativeBalanceInfo) setNegativeBalanceInfo(data.negativeBalanceInfo);
    } catch {} finally { setLoadingTx(false); }
  }

  async function handleSubmit(accountId: string) {
    setError(""); setSuccess("");
    const num = parseFloat(amount);
    if (!num || isNaN(num)) { setError("Enter a valid amount"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/drivers/finances/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: num, type: txType, description: description || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed"); return; }
      setSuccess(`Balance updated to ${data.newBalance.toFixed(2)}`);
      setAmount(""); setDescription("");
      const res2 = await fetch(`/api/drivers/finances/${accountId}`);
      const data2 = await res2.json();
      if (data2.transactions) setTransactions(data2.transactions);
      setTimeout(() => router.refresh(), 500);
    } catch { setError("Network error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Search</label>
          <Input placeholder="Name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Balance</label>
          <select value={balanceFilter} onChange={e => setBalanceFilter(e.target.value as BalanceFilter)}
            className="h-9 rounded-md border px-3 text-sm bg-card">
            <option value="all">All</option>
            <option value="negative">Negative (debt)</option>
            <option value="positive">Positive (credit)</option>
            <option value="zero">Zero</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Period</label>
          <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)}
            className="h-9 rounded-md border px-3 text-sm bg-card">
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="year">This year</option>
          </select>
        </div>
        <div className="text-sm text-muted-foreground self-end pb-1">
          {filtered.length} of {accounts.length} drivers
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Driver</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Deliveries</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No drivers match filters</TableCell></TableRow>
            ) : filtered.map(acc => (
              <Fragment key={acc.id}>
                <TableRow className={acc.balance < 0 ? "bg-red-50/50" : ""}>
                  <TableCell className="font-medium">{acc.driverName}</TableCell>
                  <TableCell>{acc.phone || "-"}</TableCell>
                  <TableCell>
                    <Badge variant={acc.driverStatus === "VERIFIED" ? "default" : "secondary"}>{acc.driverStatus}</Badge>
                  </TableCell>
                  <TableCell>{acc.completedDeliveries}</TableCell>
                  <TableCell className={`text-right font-bold ${acc.balance < 0 ? "text-red-600" : acc.balance > 0 ? "text-green-600" : ""}`}>
                    {acc.balance.toFixed(2)} {acc.currency}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => toggleExpand(acc.id)}>
                      {expandedId === acc.id ? "Close" : "Manage"}
                    </Button>
                  </TableCell>
                </TableRow>
                {expandedId === acc.id && (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="bg-muted rounded-lg p-4 space-y-4 border">
                        {negativeBalanceInfo && (
                          <div className={`rounded-lg p-3 ${negativeBalanceInfo.daysRemainingToPay <= 0 ? 'bg-red-50 border border-red-200' : 'bg-orange-50 border border-orange-200'}`}>
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{negativeBalanceInfo.daysRemainingToPay <= 0 ? '🚫' : '⚠️'}</span>
                              <div>
                                {negativeBalanceInfo.daysRemainingToPay <= 0 ? (
                                  <p className="text-sm font-semibold text-red-700">Account Paused — exceeded {negativeBalanceInfo.maxNegativeDays} days with negative balance</p>
                                ) : (
                                  <p className="text-sm font-semibold text-orange-700">{negativeBalanceInfo.daysRemainingToPay} day{negativeBalanceInfo.daysRemainingToPay !== 1 ? 's' : ''} remaining to pay fees (max {negativeBalanceInfo.maxNegativeDays} days)</p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">Negative since: {new Date(negativeBalanceInfo.negativeBalanceSince).toLocaleDateString()}</p>
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="space-y-3">
                          <p className="text-sm font-semibold text-foreground">Record Transaction</p>
                          <div className="flex flex-wrap gap-3 items-end">
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Type</label>
                              <select value={txType} onChange={e => setTxType(e.target.value)}
                                className="h-9 rounded-md border px-3 text-sm bg-card">
                                <option value="DEPOSIT">Deposit (driver pays debt)</option>
                                <option value="ADJUSTMENT">Adjustment</option>
                                <option value="BONUS">Bonus</option>
                                <option value="PENALTY">Penalty</option>
                              </select>
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs text-muted-foreground">Amount (+ credit, - debit)</label>
                              <Input type="number" step="0.01" placeholder="e.g. 50.00"
                                value={amount} onChange={e => setAmount(e.target.value)} className="w-36" />
                            </div>
                            <div className="space-y-1 flex-1 min-w-[200px]">
                              <label className="text-xs text-muted-foreground">Description</label>
                              <Input placeholder="Optional note" value={description}
                                onChange={e => setDescription(e.target.value)} />
                            </div>
                            <Button size="sm" onClick={() => handleSubmit(acc.id)} disabled={saving}>
                              {saving ? "Saving..." : "Submit"}
                            </Button>
                          </div>
                          {error && <p className="text-sm text-red-500">{error}</p>}
                          {success && <p className="text-sm text-green-600">{success}</p>}
                        </div>
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">Recent Transactions</p>
                          {loadingTx ? (
                            <p className="text-sm text-muted-foreground">Loading...</p>
                          ) : transactions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No transactions yet</p>
                          ) : (
                            <div className="max-h-64 overflow-y-auto rounded border bg-card">
                              <table className="w-full text-sm">
                                <thead className="bg-muted sticky top-0">
                                  <tr>
                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Date</th>
                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Type</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Amount</th>
                                    <th className="text-right px-3 py-2 font-medium text-muted-foreground">Balance After</th>
                                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Description</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {transactions.map(tx => (
                                    <tr key={tx.id} className="border-t">
                                      <td className="px-3 py-2 text-muted-foreground">
                                        {new Date(tx.createdAt).toLocaleDateString()} {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                      </td>
                                      <td className="px-3 py-2">
                                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[tx.type] || "bg-gray-100 text-gray-700"}`}>
                                          {tx.type.replace(/_/g, " ")}
                                        </span>
                                      </td>
                                      <td className={`px-3 py-2 text-right font-medium ${tx.amount < 0 ? "text-red-600" : "text-green-600"}`}>
                                        {tx.amount > 0 ? "+" : ""}{tx.amount.toFixed(2)}
                                      </td>
                                      <td className="px-3 py-2 text-right text-muted-foreground">{tx.balanceAfter.toFixed(2)}</td>
                                      <td className="px-3 py-2 text-muted-foreground max-w-[200px] truncate">{tx.description || "—"}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </Fragment>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
