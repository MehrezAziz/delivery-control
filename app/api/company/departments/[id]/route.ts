import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCompanyAuth } from "@/lib/company-auth";
import {
  ensureCompanyIsActive,
  ensureCompanyRoleAllowed,
  isMainDepartmentActor,
  logCompanyAudit,
  repairDepartmentMainDefaultInvariants,
} from "@/lib/company-security";

/**
 * Delete a department. Budget wallet balance (including negative availableCoins) is credited
 * back to the delivery company's main coin balance. If the main department is removed,
 * another department is promoted (oldest by creation). Cannot delete the last department.
 */
export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireCompanyAuth();
    await ensureCompanyIsActive(auth.companyId);
    ensureCompanyRoleAllowed(auth, ["MAIN_ADMIN"]);
    if (!isMainDepartmentActor(auth)) {
      return NextResponse.json({ error: "Only the main company account can delete departments" }, { status: 403 });
    }

    const { id } = await context.params;
    const departmentId = String(id || "");
    if (!departmentId) {
      return NextResponse.json({ error: "Department id is required" }, { status: 400 });
    }

    const db: any = prisma;

    const result = await db.$transaction(async (tx: any) => {
      const addr = await tx.deliveryCompanyAddress.findFirst({
        where: { id: departmentId, deliveryCompanyId: auth.companyId },
        include: { budgetWallet: true },
      });
      if (!addr) {
        throw Object.assign(new Error("Department not found"), { status: 404 });
      }

      const otherCount = await tx.deliveryCompanyAddress.count({
        where: { deliveryCompanyId: auth.companyId, id: { not: departmentId } },
      });
      if (otherCount === 0) {
        throw new Error("Cannot delete the only department");
      }

      if (addr.isMainDepartment) {
        const replacement = await tx.deliveryCompanyAddress.findFirst({
          where: { deliveryCompanyId: auth.companyId, id: { not: departmentId } },
          orderBy: { createdAt: "asc" },
        });
        if (!replacement) throw new Error("Cannot reassign main department");
        await tx.deliveryCompanyAddress.update({
          where: { id: replacement.id },
          data: {
            isMainDepartment: true,
            ...(addr.isDefault ? { isDefault: true } : {}),
          },
        });
      } else if (addr.isDefault) {
        await tx.deliveryCompanyAddress.updateMany({
          where: { deliveryCompanyId: auth.companyId },
          data: { isDefault: false },
        });
        const mainDept = await tx.deliveryCompanyAddress.findFirst({
          where: { deliveryCompanyId: auth.companyId, isMainDepartment: true, id: { not: departmentId } },
        });
        if (mainDept) {
          await tx.deliveryCompanyAddress.update({
            where: { id: mainDept.id },
            data: { isDefault: true },
          });
        }
      }

      const returnAmt = Number(addr.budgetWallet?.availableCoins ?? 0);

      if (returnAmt !== 0) {
        const company = await tx.deliveryCompany.findUnique({
          where: { id: auth.companyId },
          select: { coinBalance: true },
        });
        const newBal = Number(company?.coinBalance ?? 0) + returnAmt;
        await tx.deliveryCompany.update({
          where: { id: auth.companyId },
          data: { coinBalance: newBal },
        });
        await tx.deliveryCompanyTransaction.create({
          data: {
            deliveryCompanyId: auth.companyId,
            type: "DEPARTMENT_BUDGET_RETURN",
            amount: returnAmt,
            balanceAfter: newBal,
            description: `Department deleted: ${addr.label} (${departmentId}); budget returned to company`,
          },
        });
      }

      await tx.deliveryCompanyAddress.delete({ where: { id: departmentId } });

      return { label: addr.label, returnedCoins: returnAmt };
    });

    await repairDepartmentMainDefaultInvariants(auth.companyId);

    await logCompanyAudit(auth.companyId, "DEPARTMENT_DELETED", "COMPANY", auth.departmentAccountId || auth.companyId, {
      departmentId,
      returnedCoins: result.returnedCoins,
    });

    return NextResponse.json({ success: true, ...result });
  } catch (e: unknown) {
    const status = e && typeof e === "object" && "status" in e ? (e as { status?: number }).status : undefined;
    if (status === 404) {
      return NextResponse.json({ error: "Department not found" }, { status: 404 });
    }
    const msg = e instanceof Error ? e.message : "Failed to delete department";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
