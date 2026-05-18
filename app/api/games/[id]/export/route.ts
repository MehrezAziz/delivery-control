import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  await requireAdmin();
  const { id: gameId } = await params;

  const [answers, winners] = await Promise.all([
    prisma.gameAnswer.findMany({
      where: { gameId },
      orderBy: { answeredAt: "desc" },
      take: 50000,
    }),
    prisma.gameWinner.findMany({
      where: { gameId },
      include: { prizeTier: true, draw: true },
      orderBy: { wonAt: "desc" },
    }),
  ]);

  const userIds = [...new Set([...answers.map((a) => a.userId), ...winners.map((w) => w.userId)])];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, phone: true, firstName: true, secondName: true, role: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const lines: string[] = [];
  lines.push("type,userId,phone,name,role,questionId,correct,date,answeredAt");
  for (const a of answers) {
    const u = userMap.get(a.userId);
    lines.push(
      [
        "answer",
        a.userId,
        u?.phone ?? "",
        `${u?.firstName ?? ""} ${u?.secondName ?? ""}`.trim(),
        u?.role ?? "",
        a.questionId,
        a.isCorrect,
        a.tunisiaDateKey,
        a.answeredAt.toISOString(),
      ].join(","),
    );
  }
  lines.push("");
  lines.push("type,userId,phone,name,role,prize,status,wonAt");
  for (const w of winners) {
    const u = userMap.get(w.userId);
    lines.push(
      [
        "winner",
        w.userId,
        u?.phone ?? "",
        `${u?.firstName ?? ""} ${u?.secondName ?? ""}`.trim(),
        u?.role ?? "",
        w.prizeTier.prizeLabel ?? w.prizeTier.coinAmount,
        w.status,
        w.wonAt.toISOString(),
      ].join(","),
    );
  }

  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="game-${gameId}-export.csv"`,
    },
  });
}
