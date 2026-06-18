import { prisma } from "@/lib/prisma";
import SystemConfigClient from "./system-config-client";

export const dynamic = "force-dynamic";

export default async function SystemConfigPage() {
  const configs = await prisma.systemConfig.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });

  const serialized = configs.map((c) => ({
    id: c.id,
    key: c.key,
    value: c.value,
    category: c.category,
    description: c.description,
  }));

  const categories = new Set(configs.map((c) => c.category)).size;
  const withDescription = configs.filter((c) => c.description?.trim()).length;

  return (
    <SystemConfigClient
      configs={serialized}
      stats={{
        total: configs.length,
        categories,
        withDescription,
      }}
    />
  );
}
