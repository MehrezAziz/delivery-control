"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Plus, RefreshCw, Check, X, Users, Activity, MessageSquareText, Trophy, Search, Clock, CalendarX, Play, Sparkles, ChevronLeft, AlertTriangle } from "lucide-react";
import { ImageUpload, MultiImageUpload } from "@/components/admin/image-upload";
import { getAdminAssetUrl } from "@/lib/asset-url";

const PLACEMENTS_CUSTOMER = [
  "CUSTOMER_HOME",
  "CUSTOMER_WALLET",
  "CUSTOMER_ORDERS",
  "CUSTOMER_PROFILE",
  "CUSTOMER_SETTINGS",
  "CUSTOMER_SUPPORT",
];
const PLACEMENTS_DRIVER = [
  "DRIVER_HOME",
  "DRIVER_EARNINGS",
  "DRIVER_TRANSACTIONS",
  "DRIVER_PROFILE",
  "DRIVER_SETTINGS",
  "DRIVER_SUPPORT",
  "DRIVER_MY_ORDERS",
];
const PERIOD_MODES = ["DAILY", "WEEKLY", "MONTHLY", "CUSTOM"];
const WINNER_SELECTION_MODES: Array<{ value: string; label: string }> = [
  { value: "RANDOM", label: "System selects randomly" },
  { value: "MANUAL", label: "Admin selects winner manually" },
  { value: "RANDOM_CONFIRM", label: "System selects, admin confirms (12h)" },
];
const COIN_CREDIT_MODES = [
  { value: "AUTO_ON_CONFIRM", label: "Credit coins automatically" },
  { value: "MANUAL", label: "Admin credits manually" },
];
const WINNER_POOL_MODES = [
  { value: "COMBINED", label: "Combined (customers + drivers)" },
  { value: "SEPARATE_BY_ROLE", label: "Separate pools per role" },
];
const SCHEDULE_MODES = [
  { value: "ALL_DAYS", label: "Every day" },
  { value: "CALENDAR_DAYS", label: "Specific calendar days (1–31)" },
  { value: "WEEKDAYS", label: "Specific weekdays (Sun–Sat)" },
];

const DRAW_STATUS_STYLES: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
  AWAITING_CONFIRM: { label: "Awaiting confirm", className: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  CONFIRMED: { label: "Confirmed", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
};

const PERIOD_LABELS: Record<string, string> = {
  DAILY: "Daily winner",
  WEEKLY: "Weekly winner",
  MONTHLY: "Monthly winner",
  CUSTOM: "Custom period",
};

function formatHumanCountdown(targetIso: string): string {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return "any moment now";
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (days === 0) parts.push(`${mins}m`);
  return parts.join(" ");
}

function toLocalDatetimeInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type Category = { id: string; name: string; isActive: boolean; sortOrder: number };
type Option = { id?: string; text: string; imageUrl?: string | null; isCorrect: boolean };
type Question = {
  id: string;
  text: string | null;
  imageUrl: string | null;
  isActive: boolean;
  categoryId: string;
  category: { id: string; name: string };
  options: Option[];
};
type PrizeTier = {
  rank: number;
  prizeType: "COINS" | "PHYSICAL";
  coinAmount: number | null;
  prizeLabel: string | null;
  prizeImageUrl: string | null;
  congratsImageUrl: string | null;
};
type GameDetail = {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  scheduleMode: string;
  calendarDays: number[];
  weekdays: number[];
  periodMode: string;
  customPeriodDays: number | null;
  customPeriodAnchor: string | null;
  questionsPerDay: number;
  accessCodePlain: string | null;
  previousAccessCodePlain: string | null;
  accessCodeVersion: number;
  requireCompletedOrder: boolean;
  winnerSelectionMode: string;
  coinCreditMode: string;
  winnerPoolMode: string;
  customerButtonPlacement: string;
  driverButtonPlacement: string;
  bannerImageUrls: string[];
  showRecentWinners: boolean;
  categories: Category[];
  prizeTiers: PrizeTier[];
  countries: Array<{ countryId: string; country: { id: string; name: string } }>;
  draws: Array<{
    id: string;
    status: string;
    poolScope: string;
    periodEnd: string;
    periodStart?: string;
    winners?: Array<{
      id: string;
      status: string;
      userRole: string;
      correctCountInPeriod?: number;
      prizeTier?: { prizeLabel?: string | null; coinAmount?: unknown; prizeType?: string };
    }>;
  }>;
  lowQuestionPool?: boolean;
  participantsCount?: number;
  playedCount?: number;
  answersCount?: number;
  nextDrawAt?: string | null;
  endsAt?: string | null;
  hasEnded?: boolean;
};

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPlacement, setSavingPlacement] = useState(false);
  const [copied, setCopied] = useState(false);
  const [runningDraw, setRunningDraw] = useState(false);

  const [categoryName, setCategoryName] = useState("");

  const [qCategoryId, setQCategoryId] = useState<string>("");
  const [qText, setQText] = useState("");
  const [qImage, setQImage] = useState<string | null>(null);
  const [qOptions, setQOptions] = useState<Option[]>([
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
    { text: "", isCorrect: false },
  ]);

  const load = useCallback(async () => {
    const [gameRes, qRes, cRes] = await Promise.all([
      fetch(`/api/games/${id}`),
      fetch(`/api/games/${id}/questions`),
      fetch(`/api/countries`).catch(() => null),
    ]);
    const g = (await gameRes.json()) as GameDetail;
    setGame(g);
    const qs = (await qRes.json()) as Question[];
    setQuestions(qs);
    if (cRes) setCountries(await cRes.json());
    if (!qCategoryId && g.categories.length > 0) {
      setQCategoryId(g.categories[0].id);
    }
  }, [id, qCategoryId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Re-render every 30s so countdowns stay accurate.
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const patchGame = async (data: Record<string, unknown>) => {
    const res = await fetch(`/api/games/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Update failed");
    }
    await load();
  };

  const regenCode = async () => {
    if (!confirm("Generate a new code? Users who already unlocked will need to re-enter the new code.")) return;
    const res = await fetch(`/api/games/${id}/code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed");
      return;
    }
    await load();
    setCopied(false);
  };

  const copyCode = async () => {
    if (!game?.accessCodePlain) return;
    await navigator.clipboard.writeText(game.accessCodePlain);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const addCategory = async () => {
    if (!categoryName.trim()) return;
    await fetch(`/api/games/${id}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: categoryName.trim() }),
    });
    setCategoryName("");
    await load();
  };

  const updateCategory = async (cid: string, patch: { name?: string; isActive?: boolean }) => {
    await fetch(`/api/games/${id}/categories/${cid}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    await load();
  };

  const deleteCategory = async (cid: string) => {
    if (!confirm("Delete this category?")) return;
    const res = await fetch(`/api/games/${id}/categories/${cid}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error || "Delete failed");
      return;
    }
    await load();
  };

  const addQuestion = async () => {
    if (!qCategoryId) {
      alert("Choose a category");
      return;
    }
    if (!qText.trim() && !qImage) {
      alert("Question must have text or image");
      return;
    }
    if (!qOptions.some((o) => o.isCorrect)) {
      alert("Mark one option as correct");
      return;
    }
    const filled = qOptions.filter((o) => o.text.trim());
    if (filled.length < 2) {
      alert("At least 2 options with text are required");
      return;
    }
    const res = await fetch(`/api/games/${id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: qCategoryId,
        text: qText.trim() || null,
        imageUrl: qImage ?? null,
        options: filled,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed");
      return;
    }
    setQText("");
    setQImage(null);
    setQOptions([
      { text: "", isCorrect: true },
      { text: "", isCorrect: false },
      { text: "", isCorrect: false },
    ]);
    await load();
  };

  const deleteQuestion = async (qid: string) => {
    if (!confirm("Delete this question?")) return;
    await fetch(`/api/games/${id}/questions/${qid}`, { method: "DELETE" });
    await load();
  };

  const toggleQuestion = async (q: Question) => {
    await fetch(`/api/games/${id}/questions/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !q.isActive }),
    });
    await load();
  };

  const runDrawNow = async () => {
    setRunningDraw(true);
    try {
      const res = await fetch(`/api/games/${id}/draws/run`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Draw failed");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Draw failed");
    } finally {
      setRunningDraw(false);
    }
  };

  if (!game) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <p className="text-muted-foreground animate-pulse">Loading game…</p>
      </div>
    );
  }

  const winnerCount = (game.draws ?? []).reduce(
    (acc, d) => acc + (d.winners?.length ?? 0),
    0,
  );

  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50/60 via-background to-background dark:from-violet-950/15">
      <div className="p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link
            href="/dashboard/games"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            All games
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={game.isActive ? "default" : "secondary"} className={game.isActive ? "bg-emerald-600" : ""}>
              {game.isActive ? "Live" : "Inactive"}
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void patchGame({ isActive: !game.isActive })}>
              {game.isActive ? "Deactivate" : "Activate"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void runDrawNow()} disabled={runningDraw}>
              <Play className="h-4 w-4 mr-1.5" />
              {runningDraw ? "Running…" : "Run draw now"}
            </Button>
            <a
              href={`/api/games/${id}/export`}
              download
              className="inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium hover:bg-accent"
            >
              Export CSV
            </a>
          </div>
        </div>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-md">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.12),transparent_55%)]" />
          <div className="relative p-6 sm:p-7 space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              {PERIOD_LABELS[game.periodMode] ?? game.periodMode}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">{game.name}</h1>
            {game.description && <p className="text-violet-100 text-sm max-w-2xl">{game.description}</p>}
          </div>
        </div>

        {game.hasEnded && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 px-4 py-3 text-sm text-red-700 dark:text-red-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>
              This game ended on{" "}
              <strong>{game.endsAt ? new Date(game.endsAt).toLocaleString() : "—"}</strong> and is hidden
              from users. Run a draw now if winners are still pending.
            </p>
          </div>
        )}
        {game.lowQuestionPool && (
          <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <p>Fewer active questions than the daily limit ({game.questionsPerDay}/day). Add more questions.</p>
          </div>
        )}

      {/* NEXT WINNER COUNTDOWN */}
      <Card className="overflow-hidden border-violet-200/60 dark:border-violet-800/40">
        <div className="h-1 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-600" />
            Time to next winner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {game.hasEnded ? (
            <p className="text-sm text-muted-foreground">Game has ended — use &quot;Run draw now&quot; to finalize pending periods.</p>
          ) : game.nextDrawAt ? (
            <>
              <p className="text-4xl font-bold tabular-nums tracking-tight text-violet-700 dark:text-violet-300">
                {formatHumanCountdown(game.nextDrawAt)}
              </p>
              <p className="text-xs text-muted-foreground">
                Draw runs when the period ends, then within about a minute. Scheduled at{" "}
                {new Date(game.nextDrawAt).toLocaleString()} (Tunisia time).
              </p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming draw scheduled.</p>
          )}
          {game.endsAt && !game.hasEnded && (
            <p className="text-xs text-muted-foreground inline-flex items-center gap-1 pt-1">
              <CalendarX className="h-3.5 w-3.5" />
              Game ends on {new Date(game.endsAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* PARTICIPATION STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Participants"
          value={game.participantsCount ?? 0}
          hint="entered the code"
          accent="violet"
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Played"
          value={game.playedCount ?? 0}
          hint="answered ≥ 1 question"
          accent="blue"
        />
        <StatCard
          icon={<MessageSquareText className="h-5 w-5" />}
          label="Answers"
          value={game.answersCount ?? 0}
          hint="total submitted"
          accent="amber"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Winners"
          value={winnerCount}
          hint="across all draws"
          accent="emerald"
        />
      </div>

      {/* ACCESS CODE */}
      <Card className="border-dashed border-violet-300/50 dark:border-violet-700/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Access code
            <Badge variant="outline" className="font-normal text-xs">Share on social media</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {game.accessCodePlain ? (
            <div className="flex flex-wrap items-center gap-3">
              <div className="text-3xl font-mono font-bold tracking-[0.4em] bg-muted px-6 py-3 rounded-md">
                {game.accessCodePlain}
              </div>
              <Button variant="outline" size="sm" onClick={() => void copyCode()}>
                <Copy className="h-4 w-4 mr-2" />
                {copied ? "Copied!" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => void regenCode()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Generate new code
              </Button>
            </div>
          ) : (
            <Button onClick={() => void regenCode()}>Generate 6-digit code</Button>
          )}
          {game.previousAccessCodePlain && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Previous code:</span>
              <span className="font-mono font-semibold tracking-[0.3em] text-foreground bg-muted/60 px-2 py-1 rounded">
                {game.previousAccessCodePlain}
              </span>
              <span className="text-xs">(no longer valid)</span>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Code version: {game.accessCodeVersion}. Changing the code invalidates previous unlocks —
            users must enter the new code to play.
          </p>
        </CardContent>
      </Card>

      {/* SETTINGS */}
      <SettingsPanel
        game={game}
        countries={countries}
        saving={savingSettings}
        setSaving={setSavingSettings}
        patchGame={patchGame}
      />

      {/* BUTTON PLACEMENT — quick edit */}
      <Card>
        <CardHeader>
          <CardTitle>Button placement</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Customer page</Label>
            <select
              className="w-full border rounded-md h-10 px-3 bg-background mt-1"
              value={game.customerButtonPlacement}
              disabled={savingPlacement}
              onChange={async (e) => {
                setSavingPlacement(true);
                await patchGame({ customerButtonPlacement: e.target.value });
                setSavingPlacement(false);
              }}
            >
              {PLACEMENTS_CUSTOMER.map((p) => (
                <option key={p} value={p}>{p.replace("CUSTOMER_", "")}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Driver page</Label>
            <select
              className="w-full border rounded-md h-10 px-3 bg-background mt-1"
              value={game.driverButtonPlacement}
              disabled={savingPlacement}
              onChange={async (e) => {
                setSavingPlacement(true);
                await patchGame({ driverButtonPlacement: e.target.value });
                setSavingPlacement(false);
              }}
            >
              {PLACEMENTS_DRIVER.map((p) => (
                <option key={p} value={p}>{p.replace("DRIVER_", "")}</option>
              ))}
            </select>
          </div>
          <p className="sm:col-span-2 text-xs text-muted-foreground">
            Move the game button to any page anytime. Customer and driver placements are independent.
          </p>
        </CardContent>
      </Card>

      {/* PRIZE TIERS */}
      <PrizeTiersEditor
        initial={game.prizeTiers}
        onSave={async (tiers) => {
          await patchGame({ prizeTiers: tiers });
        }}
      />

      {/* CATEGORIES */}
      <Card>
        <CardHeader>
          <CardTitle>Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="New category (e.g. Sport, Travel, Science)"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addCategory();
              }}
            />
            <Button onClick={() => void addCategory()}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          {game.categories.length === 0 ? (
            <p className="text-sm text-muted-foreground">No categories yet.</p>
          ) : (
            <ul className="divide-y border rounded-md">
              {game.categories.map((c) => (
                <li key={c.id} className="flex items-center justify-between p-3 text-sm">
                  <span className={c.isActive ? "" : "line-through text-muted-foreground"}>
                    {c.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void updateCategory(c.id, { isActive: !c.isActive })}
                    >
                      {c.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void deleteCategory(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* ADD QUESTION */}
      <Card>
        <CardHeader>
          <CardTitle>Add question</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {game.categories.length === 0 ? (
            <p className="text-sm text-amber-600">Add a category first.</p>
          ) : (
            <>
              <div>
                <Label>Category</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 bg-background mt-1"
                  value={qCategoryId}
                  onChange={(e) => setQCategoryId(e.target.value)}
                >
                  {game.categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Question text</Label>
                <Input value={qText} onChange={(e) => setQText(e.target.value)} />
              </div>
              <ImageUpload
                label="Question image (optional)"
                value={qImage}
                onChange={setQImage}
                hint="JPEG, PNG or WebP up to 5 MB."
              />
              
              <div className="space-y-2">
                <Label>Options (tick the correct one)</Label>
                {qOptions.map((o, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="radio"
                      name="correct"
                      checked={o.isCorrect}
                      onChange={() =>
                        setQOptions(qOptions.map((opt, j) => ({ ...opt, isCorrect: j === i })))
                      }
                    />
                    <Input
                      placeholder={`Option ${i + 1}`}
                      value={o.text}
                      onChange={(e) => {
                        const next = [...qOptions];
                        next[i] = { ...next[i], text: e.target.value };
                        setQOptions(next);
                      }}
                    />
                    {qOptions.length > 2 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setQOptions(qOptions.filter((_, j) => j !== i))}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                {qOptions.length < 6 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setQOptions([...qOptions, { text: "", isCorrect: false }])}
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add option
                  </Button>
                )}
              </div>
              <Button onClick={() => void addQuestion()}>Save question</Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ALL QUESTIONS LIST */}
      <Card>
        <CardHeader>
          <CardTitle>All questions ({questions.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions yet.</p>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                className={`border rounded-md p-3 ${q.isActive ? "" : "opacity-60"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                      {q.category.name}
                    </p>
                    {q.text && <p className="text-sm font-medium">{q.text}</p>}
                    {q.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={getAdminAssetUrl(q.imageUrl)} alt="" className="max-h-32 mt-2 rounded" />
                    )}
                    <ul className="mt-2 text-sm space-y-1">
                      {q.options.map((o) => (
                        <li
                          key={o.id ?? o.text}
                          className={o.isCorrect ? "text-green-600 font-medium" : ""}
                        >
                          {o.isCorrect ? <Check className="inline h-3 w-3 mr-1" /> : <span className="inline-block w-4" />}
                          {o.text || <em className="text-muted-foreground">(image option)</em>}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="sm" variant="ghost" onClick={() => void toggleQuestion(q)}>
                      {q.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void deleteQuestion(q.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* DRAWS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            Draws &amp; winners
          </CardTitle>
          <Button size="sm" variant="outline" onClick={() => void runDrawNow()} disabled={runningDraw}>
            <Play className="h-4 w-4 mr-1.5" />
            {runningDraw ? "Running…" : "Run draw now"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {(game.draws ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No draws yet. When a period ends (or the game end date passes), a winner is selected
              automatically. You can also trigger a draw manually.
            </p>
          ) : (
            game.draws.map((d) => {
              const statusStyle = DRAW_STATUS_STYLES[d.status] ?? {
                label: d.status,
                className: "bg-muted text-muted-foreground",
              };
              return (
                <div key={d.id} className="rounded-xl border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{d.poolScope}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle.className}`}>
                          {statusStyle.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Period ended {new Date(d.periodEnd).toLocaleString()}
                      </p>
                    </div>
                    {d.status === "AWAITING_CONFIRM" && (
                      <Button
                        size="sm"
                        onClick={async () => {
                          await fetch(`/api/games/${id}/draws/${d.id}/confirm`, { method: "POST" });
                          await load();
                        }}
                      >
                        Confirm winners
                      </Button>
                    )}
                  </div>
                  {(d.winners?.length ?? 0) > 0 ? (
                    <ul className="space-y-2">
                      {d.winners!.map((w) => (
                        <li
                          key={w.id}
                          className="flex items-center gap-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40 px-3 py-2 text-sm"
                        >
                          <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="font-medium">{w.userRole}</span>
                            <span className="text-muted-foreground mx-1.5">·</span>
                            <span>
                              {w.prizeTier?.prizeLabel ??
                                (w.prizeTier?.coinAmount
                                  ? `${Number(w.prizeTier.coinAmount)} coins`
                                  : "Prize")}
                            </span>
                            {w.correctCountInPeriod != null && (
                              <span className="text-muted-foreground text-xs ml-2">
                                ({w.correctCountInPeriod} correct)
                              </span>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs shrink-0">
                            {w.status.replace(/_/g, " ")}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">No winners for this draw.</p>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  accent = "violet",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
  accent?: "violet" | "blue" | "amber" | "emerald";
}) {
  const accentClasses = {
    violet: "from-violet-500/10 to-violet-600/5 border-violet-200/60 dark:border-violet-800/40 text-violet-600",
    blue: "from-blue-500/10 to-blue-600/5 border-blue-200/60 dark:border-blue-800/40 text-blue-600",
    amber: "from-amber-500/10 to-amber-600/5 border-amber-200/60 dark:border-amber-800/40 text-amber-600",
    emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-600",
  }[accent];

  return (
    <div className={`rounded-xl border bg-gradient-to-br p-4 ${accentClasses}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold tabular-nums text-foreground">{value.toLocaleString()}</div>
      {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function SettingsPanel({
  game,
  countries,
  saving,
  setSaving,
  patchGame,
}: {
  game: GameDetail;
  countries: { id: string; name: string }[];
  saving: boolean;
  setSaving: (b: boolean) => void;
  patchGame: (data: Record<string, unknown>) => Promise<void>;
}) {
  const [form, setForm] = useState({
    name: game.name,
    description: game.description ?? "",
    scheduleMode: game.scheduleMode,
    calendarDays: game.calendarDays,
    weekdays: game.weekdays,
    periodMode: game.periodMode,
    customPeriodDays: game.customPeriodDays ?? 5,
    customPeriodAnchor: game.customPeriodAnchor ?? "FIXED_BLOCKS",
    questionsPerDay: game.questionsPerDay,
    requireCompletedOrder: game.requireCompletedOrder,
    winnerSelectionMode: game.winnerSelectionMode,
    coinCreditMode: game.coinCreditMode,
    winnerPoolMode: game.winnerPoolMode,
    showRecentWinners: game.showRecentWinners,
    countryIds: game.countries.map((c) => c.countryId),
    bannerImageUrls: game.bannerImageUrls,
    endsAt: toLocalDatetimeInput(game.endsAt ?? null),
  });
  const [countrySearch, setCountrySearch] = useState("");

  const submit = async () => {
    setSaving(true);
    try {
      await patchGame({
        ...form,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const filteredCountries = countries.filter((c) =>
    c.name.toLowerCase().includes(countrySearch.trim().toLowerCase()),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>Questions per day</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={form.questionsPerDay}
              onChange={(e) => setForm({ ...form, questionsPerDay: Number(e.target.value) })}
            />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Winner period</Label>
            <select
              className="w-full border rounded-md h-10 px-3 bg-background mt-1"
              value={form.periodMode}
              onChange={(e) => setForm({ ...form, periodMode: e.target.value })}
            >
              {PERIOD_MODES.map((p) => (
                <option key={p} value={p}>
                  {p === "DAILY" ? "Daily winner" : p === "WEEKLY" ? "Weekly winner" : p === "MONTHLY" ? "Monthly winner" : "Custom (every N days)"}
                </option>
              ))}
            </select>
          </div>
          {form.periodMode === "CUSTOM" && (
            <>
              <div>
                <Label>Every N days</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={form.customPeriodDays}
                  onChange={(e) => setForm({ ...form, customPeriodDays: Number(e.target.value) })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Period anchor</Label>
                <select
                  className="w-full border rounded-md h-10 px-3 bg-background mt-1"
                  value={form.customPeriodAnchor}
                  onChange={(e) => setForm({ ...form, customPeriodAnchor: e.target.value })}
                >
                  <option value="FIXED_BLOCKS">Fixed blocks (days 1–N, N+1–2N, …)</option>
                  <option value="ROLLING">Rolling from game start</option>
                </select>
              </div>
            </>
          )}
        </div>

        <div>
          <Label>Winner selection</Label>
          <select
            className="w-full border rounded-md h-10 px-3 bg-background mt-1"
            value={form.winnerSelectionMode}
            onChange={(e) => setForm({ ...form, winnerSelectionMode: e.target.value })}
          >
            {WINNER_SELECTION_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Coin credit</Label>
            <select
              className="w-full border rounded-md h-10 px-3 bg-background mt-1"
              value={form.coinCreditMode}
              onChange={(e) => setForm({ ...form, coinCreditMode: e.target.value })}
            >
              {COIN_CREDIT_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Winner pool</Label>
            <select
              className="w-full border rounded-md h-10 px-3 bg-background mt-1"
              value={form.winnerPoolMode}
              onChange={(e) => setForm({ ...form, winnerPoolMode: e.target.value })}
            >
              {WINNER_POOL_MODES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <Label>Days the game is open</Label>
          <select
            className="w-full border rounded-md h-10 px-3 bg-background mt-1"
            value={form.scheduleMode}
            onChange={(e) => setForm({ ...form, scheduleMode: e.target.value })}
          >
            {SCHEDULE_MODES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {form.scheduleMode === "CALENDAR_DAYS" && (
          <div>
            <Label>Calendar days (1–31)</Label>
            <div className="grid grid-cols-7 gap-1 mt-2">
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                const on = form.calendarDays.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    className={`h-9 rounded-md border text-sm ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                    }`}
                    onClick={() =>
                      setForm({
                        ...form,
                        calendarDays: on
                          ? form.calendarDays.filter((x) => x !== d)
                          : [...form.calendarDays, d].sort((a, b) => a - b),
                      })
                    }
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {form.scheduleMode === "WEEKDAYS" && (
          <div>
            <Label>Weekdays</Label>
            <div className="flex flex-wrap gap-1 mt-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((name, i) => {
                const on = form.weekdays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    className={`h-9 px-3 rounded-md border text-sm ${
                      on ? "bg-primary text-primary-foreground border-primary" : "bg-background"
                    }`}
                    onClick={() =>
                      setForm({
                        ...form,
                        weekdays: on
                          ? form.weekdays.filter((x) => x !== i)
                          : [...form.weekdays, i].sort((a, b) => a - b),
                      })
                    }
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div>
          <Label>Countries that can participate</Label>
          <div className="relative mt-2">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              placeholder="Search countries…"
              className="pl-9"
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {form.countryIds.length} selected · {filteredCountries.length} shown
          </p>
          <div className="flex flex-wrap gap-2 mt-2 max-h-64 overflow-y-auto p-2 border rounded-md">
            {filteredCountries.length === 0 ? (
              <p className="text-xs text-muted-foreground p-2">No countries match.</p>
            ) : (
              filteredCountries.map((c) => {
                const on = form.countryIds.includes(c.id);
                return (
                  <Button
                    key={c.id}
                    type="button"
                    size="sm"
                    variant={on ? "default" : "outline"}
                    onClick={() =>
                      setForm({
                        ...form,
                        countryIds: on
                          ? form.countryIds.filter((id) => id !== c.id)
                          : [...form.countryIds, c.id],
                      })
                    }
                  >
                    {c.name}
                  </Button>
                );
              })
            )}
          </div>
        </div>

        <MultiImageUpload
          label="Banner images"
          values={form.bannerImageUrls}
          onChange={(urls) => setForm({ ...form, bannerImageUrls: urls })}
          hint="Shown on the game landing screen. Up to 8 images."
        />

        <div>
          <Label className="flex items-center gap-2">
            <CalendarX className="h-4 w-4" />
            End date (optional)
          </Label>
          <div className="flex items-center gap-2 mt-1">
            <Input
              type="datetime-local"
              value={form.endsAt}
              onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
            />
            {form.endsAt && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setForm({ ...form, endsAt: "" })}
              >
                Clear
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            After this moment the game stops accepting new participation and is hidden from users.
            Leave empty to keep the game running indefinitely.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.requireCompletedOrder}
            onChange={(e) => setForm({ ...form, requireCompletedOrder: e.target.checked })}
          />
          Require at least one delivered order to win
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.showRecentWinners}
            onChange={(e) => setForm({ ...form, showRecentWinners: e.target.checked })}
          />
          Show recent winners on the game page
        </label>

        <Button onClick={() => void submit()} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}

function PrizeTiersEditor({
  initial,
  onSave,
}: {
  initial: PrizeTier[];
  onSave: (tiers: PrizeTier[]) => Promise<void>;
}) {
  const [tiers, setTiers] = useState<PrizeTier[]>(
    initial.length > 0
      ? initial
      : [{ rank: 1, prizeType: "COINS", coinAmount: 1000, prizeLabel: null, prizeImageUrl: null, congratsImageUrl: null }],
  );
  const [saving, setSaving] = useState(false);

  const addRow = () => {
    setTiers([
      ...tiers,
      {
        rank: tiers.length + 1,
        prizeType: "COINS",
        coinAmount: 100,
        prizeLabel: null,
        prizeImageUrl: null,
        congratsImageUrl: null,
      },
    ]);
  };
  const removeRow = (i: number) => {
    setTiers(
      tiers
        .filter((_, j) => j !== i)
        .map((t, j) => ({ ...t, rank: j + 1 })),
    );
  };
  const update = (i: number, patch: Partial<PrizeTier>) => {
    setTiers(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSave(tiers);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Prizes ({tiers.length} winner{tiers.length === 1 ? "" : "s"})</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {tiers.map((t, i) => (
          <div key={i} className="border rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="font-semibold">Winner #{t.rank}</p>
              <Button size="sm" variant="ghost" onClick={() => removeRow(i)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Prize type</Label>
                <select
                  className="w-full border rounded-md h-9 px-2 bg-background mt-1 text-sm"
                  value={t.prizeType}
                  onChange={(e) =>
                    update(i, { prizeType: e.target.value as "COINS" | "PHYSICAL" })
                  }
                >
                  <option value="COINS">Coins</option>
                  <option value="PHYSICAL">Physical / other</option>
                </select>
              </div>
              {t.prizeType === "COINS" ? (
                <div>
                  <Label className="text-xs">Coin amount</Label>
                  <Input
                    type="number"
                    min={1}
                    value={t.coinAmount ?? 0}
                    onChange={(e) => update(i, { coinAmount: Number(e.target.value) })}
                  />
                </div>
              ) : (
                <div>
                  <Label className="text-xs">Prize label (e.g. PlayStation 5)</Label>
                  <Input
                    value={t.prizeLabel ?? ""}
                    onChange={(e) => update(i, { prizeLabel: e.target.value })}
                  />
                </div>
              )}
              <ImageUpload
                label="Prize image (optional)"
                value={t.prizeImageUrl}
                onChange={(url) => update(i, { prizeImageUrl: url })}
                previewHeight={120}
              />
              <ImageUpload
                label="Congrats screen image (optional)"
                value={t.congratsImageUrl}
                onChange={(url) => update(i, { congratsImageUrl: url })}
                previewHeight={120}
              />
            </div>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addRow}>
          <Plus className="h-4 w-4 mr-1" /> Add winner
        </Button>
        <div>
          <Button onClick={() => void submit()} disabled={saving}>
            {saving ? "Saving…" : "Save prizes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
