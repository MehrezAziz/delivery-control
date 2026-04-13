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
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Governorate coverage</h1>
      <GovernorateEditor csId={cs.id} pseudo={cs.superUser.pseudo} />
    </div>
  );
}
