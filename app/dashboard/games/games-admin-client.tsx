"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Gamepad2, Users, Trophy, HelpCircle, Activity } from "lucide-react";

type GameRow = {
  id: string;
  name: string;
  isActive: boolean;
  periodMode: string;
  questionsPerDay: number;
  participantsCount?: number;
  playedCount?: number;
  _count?: { questions: number; answers: number; winners: number };
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

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gamepad2 className="h-7 w-7" />
            Games
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Quiz games, access codes, draws, and prizes.
          </p>
        </div>
        <Link
          href="/dashboard/games/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4 mr-2" />
          New game
        </Link>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : games.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No games yet. Create your first quiz game.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {games.map((g) => (
            <Card key={g.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg">
                  <Link href={`/dashboard/games/${g.id}`} className="hover:underline">
                    {g.name}
                  </Link>
                </CardTitle>
                <Badge variant={g.isActive ? "default" : "secondary"}>
                  {g.isActive ? "Active" : "Inactive"}
                </Badge>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                  <Users className="h-4 w-4" />
                  {g.participantsCount ?? 0} participant{(g.participantsCount ?? 0) === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Activity className="h-4 w-4" />
                  {g.playedCount ?? 0} played
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <HelpCircle className="h-4 w-4" />
                  {g._count?.questions ?? 0} questions
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-4 w-4" />
                  {g._count?.winners ?? 0} winners
                </span>
                <span className="ml-auto text-xs">
                  {g.periodMode} · {g.questionsPerDay} Q/day
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
