"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Gamepad2,
  Users,
  Trophy,
  HelpCircle,
  Activity,
  ChevronRight,
  Sparkles,
} from "lucide-react";

type GameRow = {
  id: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  periodMode: string;
  questionsPerDay: number;
  participantsCount?: number;
  playedCount?: number;
  _count?: { questions: number; answers: number; winners: number };
};

const PERIOD_LABELS: Record<string, string> = {
  DAILY: "Daily draw",
  WEEKLY: "Weekly draw",
  MONTHLY: "Monthly draw",
  CUSTOM: "Custom period",
};

export function GamesAdminClient() {
  const [games, setGames] = useState<GameRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/games");
      setGames(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = games.filter((g) => g.isActive).length;
  const totalParticipants = games.reduce((s, g) => s + (g.participantsCount ?? 0), 0);
  const totalWinners = games.reduce((s, g) => s + (g._count?.winners ?? 0), 0);

  return (
    <div className="min-h-full bg-gradient-to-b from-violet-50/80 via-background to-background dark:from-violet-950/20">
      <div className="p-6 space-y-8 max-w-6xl mx-auto">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 text-white shadow-lg">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.15),transparent_50%)]" />
          <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Quiz &amp; prize games
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                <Gamepad2 className="h-8 w-8 opacity-90" />
                Quiz Games
              </h1>
              <p className="text-violet-100 text-sm max-w-lg">
                Manage access codes, questions, winner draws, and prizes. Players unlock games with a
                6-digit code shared on social media.
              </p>
            </div>
            <Link
              href="/dashboard/games/new"
              className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg bg-white text-violet-700 px-5 text-sm font-semibold shadow hover:bg-violet-50 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              New quiz game
            </Link>
          </div>

          {!loading && games.length > 0 && (
            <div className="relative border-t border-white/20 grid grid-cols-3 divide-x divide-white/20">
              <div className="px-6 py-4 text-center">
                <div className="text-2xl font-bold">{activeCount}</div>
                <div className="text-xs text-violet-200 mt-0.5">Active games</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="text-2xl font-bold">{totalParticipants.toLocaleString()}</div>
                <div className="text-xs text-violet-200 mt-0.5">Total participants</div>
              </div>
              <div className="px-6 py-4 text-center">
                <div className="text-2xl font-bold">{totalWinners.toLocaleString()}</div>
                <div className="text-xs text-violet-200 mt-0.5">Winners crowned</div>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-36 rounded-xl border bg-card animate-pulse" />
            ))}
          </div>
        ) : games.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-violet-100 dark:bg-violet-900/40 flex items-center justify-center">
                <Gamepad2 className="h-7 w-7 text-violet-600" />
              </div>
              <div>
                <p className="font-semibold text-lg">No quiz games yet</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Create your first game to start engaging customers and drivers.
                </p>
              </div>
              <Link href="/dashboard/games/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create first game
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {games.map((g) => (
              <Link key={g.id} href={`/dashboard/games/${g.id}`} className="group block">
                <Card className="h-full transition-all hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700">
                  <CardContent className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="font-semibold text-lg truncate group-hover:text-violet-700 dark:group-hover:text-violet-300 transition-colors">
                          {g.name}
                        </h2>
                        {g.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                            {g.description}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant={g.isActive ? "default" : "secondary"}
                        className={g.isActive ? "bg-emerald-600 hover:bg-emerald-600 shrink-0" : "shrink-0"}
                      >
                        {g.isActive ? "Live" : "Inactive"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="text-xs font-normal">
                        {PERIOD_LABELS[g.periodMode] ?? g.periodMode}
                      </Badge>
                      <Badge variant="outline" className="text-xs font-normal">
                        {g.questionsPerDay} Q/day
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-2 pt-1">
                      <MiniStat icon={<Users className="h-3.5 w-3.5" />} value={g.participantsCount ?? 0} label="Joined" />
                      <MiniStat icon={<Activity className="h-3.5 w-3.5" />} value={g.playedCount ?? 0} label="Played" />
                      <MiniStat icon={<HelpCircle className="h-3.5 w-3.5" />} value={g._count?.questions ?? 0} label="Questions" />
                      <MiniStat icon={<Trophy className="h-3.5 w-3.5" />} value={g._count?.winners ?? 0} label="Winners" />
                    </div>

                    <div className="flex items-center justify-end text-xs text-violet-600 dark:text-violet-400 font-medium pt-1">
                      Manage game
                      <ChevronRight className="h-4 w-4 ml-0.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
}) {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground">{icon}</div>
      <div className="text-base font-bold tabular-nums mt-0.5">{value.toLocaleString()}</div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}
