-- Budget policy is scoped to delivery_company_department_accounts (one row per account).

ALTER TABLE "delivery_company_department_budget_policies" ADD COLUMN IF NOT EXISTS "department_account_id" TEXT;

UPDATE "delivery_company_department_budget_policies" p
SET "department_account_id" = (
  SELECT a.id FROM "delivery_company_department_accounts" a
  WHERE a.department_id = p.department_id AND a.delivery_company_id = p.delivery_company_id
  ORDER BY a.created_at ASC
  LIMIT 1
);

INSERT INTO "delivery_company_department_budget_policies" (
  "id",
  "delivery_company_id",
  "department_account_id",
  "period_type",
  "interval_days",
  "max_auto_approve_amount",
  "min_hours_between_req",
  "is_auto_approve_enabled",
  "is_active",
  "created_at",
  "updated_at"
)
SELECT
  gen_random_uuid(),
  a."delivery_company_id",
  a."id",
  tpl."period_type",
  tpl."interval_days",
  tpl."max_auto_approve_amount",
  tpl."min_hours_between_req",
  tpl."is_auto_approve_enabled",
  tpl."is_active",
  NOW(),
  NOW()
FROM "delivery_company_department_accounts" a
CROSS JOIN LATERAL (
  SELECT p.*
  FROM "delivery_company_department_budget_policies" p
  WHERE p.department_id = a.department_id AND p.delivery_company_id = a.delivery_company_id
  LIMIT 1
) tpl
WHERE NOT EXISTS (
  SELECT 1 FROM "delivery_company_department_budget_policies" x
  WHERE x."department_account_id" = a."id"
);

DELETE FROM "delivery_company_department_budget_policies" WHERE "department_account_id" IS NULL;

ALTER TABLE "delivery_company_department_budget_policies" DROP COLUMN "department_id" CASCADE;

ALTER TABLE "delivery_company_department_budget_policies" ALTER COLUMN "department_account_id" SET NOT NULL;

CREATE UNIQUE INDEX "delivery_company_department_budget_policies_department_account_id_key"
  ON "delivery_company_department_budget_policies" ("department_account_id");

ALTER TABLE "delivery_company_department_budget_policies"
  ADD CONSTRAINT "delivery_company_department_budget_policies_department_account_id_fkey"
  FOREIGN KEY ("department_account_id") REFERENCES "delivery_company_department_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Optional FK for requester (Prisma relation); ignore if already present.
ALTER TABLE "delivery_company_department_budget_requests" DROP CONSTRAINT IF EXISTS "delivery_company_department_budget_requests_requested_by_account_id_fkey";
ALTER TABLE "delivery_company_department_budget_requests"
  ADD CONSTRAINT "delivery_company_department_budget_requests_requested_by_account_id_fkey"
  FOREIGN KEY ("requested_by_account_id") REFERENCES "delivery_company_department_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
