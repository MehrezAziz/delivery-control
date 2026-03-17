import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SystemConfigForm from "./system-config-form";

export const dynamic = "force-dynamic";

export default async function SystemConfigPage() {
  const configs = await prisma.systemConfig.findMany({ orderBy: [{ category: "asc" }, { key: "asc" }] });

  const grouped = configs.reduce((acc, c) => {
    if (!acc[c.category]) acc[c.category] = [];
    acc[c.category].push(c);
    return acc;
  }, {} as Record<string, typeof configs>);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">System Configuration</h1>

      {Object.keys(grouped).length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-muted-foreground text-sm">No system configurations found. Add some via the form below.</p>
          </CardContent>
        </Card>
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <Card key={category}>
            <CardHeader><CardTitle className="capitalize">{category}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {items.map(config => (
                <SystemConfigForm key={config.id} config={{
                  id: config.id,
                  key: config.key,
                  value: config.value,
                  category: config.category,
                  description: config.description,
                }} />
              ))}
            </CardContent>
          </Card>
        ))
      )}

      <Card>
        <CardHeader><CardTitle>Add New Config</CardTitle></CardHeader>
        <CardContent>
          <SystemConfigForm config={null} />
        </CardContent>
      </Card>
    </div>
  );
}
