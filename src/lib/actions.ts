import { prisma } from "./prisma";
import type { ActionName } from "./types";

export interface ActionResult {
  message: string;
  targetType: string;
  targetId: string;
  resolvedParams: Record<string, unknown>;
}

async function freezeAccount(
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const id = String(params.id ?? "");
  const account = await prisma.account.update({
    where: { id },
    data: { status: "frozen" },
    include: { customer: true },
  });
  return {
    message: `Froze ${account.type} account for ${account.customer.name}.`,
    targetType: "Account",
    targetId: account.id,
    resolvedParams: { id },
  };
}

async function flagTransaction(
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const id = String(params.id ?? "");
  const tx = await prisma.transaction.update({
    where: { id },
    data: { status: "flagged" },
  });
  return {
    message: `Flagged transaction "${tx.description}" for review.`,
    targetType: "Transaction",
    targetId: tx.id,
    resolvedParams: { id },
  };
}

async function addCustomerNote(
  params: Record<string, unknown>,
): Promise<ActionResult> {
  const id = String(params.id ?? "");
  const note = String(params.note ?? "Flagged for review").slice(0, 280);
  const customer = await prisma.customer.update({
    where: { id },
    data: { note },
  });
  return {
    message: `Added note to ${customer.name}.`,
    targetType: "Customer",
    targetId: customer.id,
    resolvedParams: { id, note },
  };
}

const ACTION_IMPL: Record<
  ActionName,
  (params: Record<string, unknown>) => Promise<ActionResult>
> = {
  freezeAccount,
  flagTransaction,
  addCustomerNote,
};

export function runAction(
  action: ActionName,
  params: Record<string, unknown>,
): Promise<ActionResult> {
  return ACTION_IMPL[action](params);
}
