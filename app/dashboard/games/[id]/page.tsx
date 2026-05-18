"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Trash2, Plus, RefreshCw, Check, X, Users, Activity, MessageSquareText, Trophy } from "lucide-react";

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
  draws: Array<{ id: string; status: string; poolScope: string; periodEnd: string; winners?: unknown[] }>;
  lowQuestionPool?: boolean;
  participantsCount?: number;
  playedCount?: number;
  answersCount?: number;
};

export default function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [game, setGame] = useState<GameDetail | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [countries, setCountries] = useState<{ id: string; name: string }[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingPlacement, setSavingPlacement] = useState(false);
  const [copied, setCopied] = useState(false);

  const [categoryName, setCategoryName] = useState("");

  const [qCategoryId, setQCategoryId] = useState<string>("");
  const [qText, setQText] = useState("");
  const [qImage, setQImage] = useState("");
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
    if (!qText.trim() && !qImage.trim()) {
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
        imageUrl: qImage.trim() || null,
        options: filled,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || "Failed");
      return;
    }
    setQText("");
    setQImage("");
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

  if (!game) {
    return <p className="p-6 text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/dashboard/games" className="text-sm text-muted-foreground hover:underline">
          ← Games
        </Link>
        <div className="flex items-center gap-2">
          <Badge variant={game.isActive ? "default" : "secondary"}>
            {game.isActive ? "Active" : "Inactive"}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void patchGame({ isActive: !game.isActive })}
          >
            {game.isActive ? "Deactivate" : "Activate"}
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

      <h1 className="text-2xl font-bold">{game.name}</h1>
      {game.lowQuestionPool && (
        <p className="text-amber-600 text-sm font-medium">
          Warning: fewer active questions than daily limit.
        </p>
      )}

      {/* PARTICIPATION STATS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Participants"
          value={game.participantsCount ?? 0}
          hint="users who entered the code"
        />
        <StatCard
          icon={<Activity className="h-5 w-5" />}
          label="Played"
          value={game.playedCount ?? 0}
          hint="answered ≥ 1 question"
        />
        <StatCard
          icon={<MessageSquareText className="h-5 w-5" />}
          label="Answers"
          value={game.answersCount ?? 0}
          hint="total submitted"
        />
        <StatCard
          icon={<Trophy className="h-5 w-5" />}
          label="Winners"
          value={(game.draws ?? []).reduce(
            (acc, d) => acc + ((d as { winners?: unknown[] }).winners?.length ?? 0),
            0,
          )}
          hint="across all draws"
        />
      </div>

      {/* ACCESS CODE — always visible */}
      <Card>
        <CardHeader>
          <CardTitle>Access code (share on social media)</CardTitle>
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
              <div>
                <Label>Image URL (optional)</Label>
                <Input value={qImage} onChange={(e) => setQImage(e.target.value)} placeholder="https://…" />
              </div>
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
                      <img src={q.imageUrl} alt="" className="max-h-32 mt-2 rounded" />
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
        <CardHeader>
          <CardTitle>Draws</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(game.draws ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No draws yet.</p>
          ) : (
            game.draws.map((d) => (
              <div key={d.id} className="flex items-center justify-between border rounded-md p-3 text-sm">
                <span>
                  {d.poolScope} — {d.status} — ends {new Date(d.periodEnd).toLocaleString()}
                </span>
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
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wide">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold">{value.toLocaleString()}</div>
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
    bannerImageUrls: game.bannerImageUrls.join("\n"),
  });

  const submit = async () => {
    setSaving(true);
    try {
      await patchGame({
        ...form,
        bannerImageUrls: form.bannerImageUrls
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

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
          <div className="flex flex-wrap gap-2 mt-2">
            {countries.map((c) => {
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
            })}
          </div>
        </div>

        <div>
          <Label>Banner image URLs (one per line)</Label>
          <textarea
            className="w-full border rounded-md p-3 bg-background mt-1 text-sm"
            rows={3}
            value={form.bannerImageUrls}
            onChange={(e) => setForm({ ...form, bannerImageUrls: e.target.value })}
          />
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
              <div>
                <Label className="text-xs">Prize image URL (optional)</Label>
                <Input
                  value={t.prizeImageUrl ?? ""}
                  onChange={(e) => update(i, { prizeImageUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
              <div>
                <Label className="text-xs">Congrats image URL (optional)</Label>
                <Input
                  value={t.congratsImageUrl ?? ""}
                  onChange={(e) => update(i, { congratsImageUrl: e.target.value })}
                  placeholder="https://…"
                />
              </div>
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
