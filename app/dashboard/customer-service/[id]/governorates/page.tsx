import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import GovernorateEditor from "./governorate-editor";

export const dynamic = "force-dynamic";

export default async function CsGovernoratePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cs = await prisma.customerService.findUnique({
    where: { id },
    include: { superUser: { select: { pseudo: true } } },
  });
  if (!cs) notFound();

  return (
    <div className="min-h-full bg-gradient-to-b from-teal-50/50 via-background to-background dark:from-teal-950/10">
      <div className="max-w-[1400px] mx-auto">
        <GovernorateEditor csId={cs.id} pseudo={cs.superUser.pseudo} />
      </div>
    </div>
  );
}
