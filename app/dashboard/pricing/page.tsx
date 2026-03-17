import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PricingForm from "./pricing-form";

export const dynamic = "force-dynamic";

const ZONE_TYPES = ["SAME_DELEGATION", "SAME_GOVERNORATE", "DIFFERENT_GOVERNORATE", "DIFFERENT_COUNTRY"] as const;

export default async function PricingPage() {
  const countries = await prisma.country.findMany({
    include: { pricingPolicies: { orderBy: { deliveryZoneType: "asc" } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">Country Pricing Policies</h1>
      {countries.length === 0 ? (
        <p className="text-muted-foreground">No countries found. Add countries first.</p>
      ) : (
        <div className="space-y-6">
          {countries.map(country => (
            <Card key={country.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {country.name} <Badge variant="outline">{country.isoCode}</Badge>
                  <span className="text-sm font-normal text-muted-foreground">{country.currencyCode} ({country.currencySymbol})</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 lg:grid-cols-2">
                  {ZONE_TYPES.map(zone => {
                    const policy = country.pricingPolicies.find(p => p.deliveryZoneType === zone);
                    return (
                      <PricingForm key={zone} countryId={country.id} zoneType={zone} policy={policy ? {
                        id: policy.id,
                        pricePerKm: Number(policy.pricePerKm),
                        baseFee: Number(policy.baseFee),
                        baseWeight: Number(policy.baseWeight),
                        extraWeightStep: Number(policy.extraWeightStep),
                        extraWeightPrice: Number(policy.extraWeightPrice),
                        nightFee: Number(policy.nightFee),
                        platformFee: Number(policy.platformFee),
                        maxNegativeDays: policy.maxNegativeDays,
                        isActive: policy.isActive,
                      } : null} />
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
