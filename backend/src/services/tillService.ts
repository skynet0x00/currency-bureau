import prisma from '../db/client';

export interface DenominationMap {
  [denomination: string]: number; // denomination (as string key) -> quantity
}

export interface TillCheckResult {
  ok: boolean;
  missing?: string;
}

/**
 * Get full till inventory, optionally filtered by currency.
 */
export async function getTillInventory(currencyCode?: string) {
  const where = currencyCode ? { currencyCode } : {};
  const rows = await prisma.tillInventory.findMany({
    where,
    include: { currency: true },
    orderBy: [{ currencyCode: 'asc' }, { denomination: 'asc' }],
  });
  return rows;
}

/**
 * Check if the till has enough of the requested denominations.
 * Used before processing a BUY transaction (bureau needs to pay out CAD... actually
 * for foreign-currency BUY the client hands over foreign notes and receives CAD —
 * the bureau doesn't need to dispense foreign; it's receiving them).
 *
 * For a SELL (bureau sells foreign to client) — the bureau needs foreign denominations.
 */
export async function checkTillSufficiency(
  currencyCode: string,
  denominations: DenominationMap
): Promise<TillCheckResult> {
  for (const [denomStr, qty] of Object.entries(denominations)) {
    const denom = parseFloat(denomStr);
    const row = await prisma.tillInventory.findUnique({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
    });
    if (!row) {
      return { ok: false, missing: `Denomination ${denom} not supported for ${currencyCode}` };
    }
    if (row.quantity < qty) {
      return {
        ok: false,
        missing: `Insufficient ${currencyCode} ${denom} notes: need ${qty}, have ${row.quantity}`,
      };
    }
  }
  return { ok: true };
}

/**
 * Deduct denominations from till (for SELL: bureau gives out foreign notes).
 * Must be called inside a Prisma transaction.
 */
export async function deductFromTill(
  tx: typeof prisma,
  currencyCode: string,
  denominations: DenominationMap
) {
  for (const [denomStr, qty] of Object.entries(denominations)) {
    const denom = parseFloat(denomStr);
    await (tx as any).tillInventory.update({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
      data: { quantity: { decrement: qty } },
    });
  }
}

/**
 * Add denominations to till (for BUY: bureau receives foreign notes from client).
 * Must be called inside a Prisma transaction.
 */
export async function addToTill(
  tx: typeof prisma,
  currencyCode: string,
  denominations: DenominationMap
) {
  for (const [denomStr, qty] of Object.entries(denominations)) {
    const denom = parseFloat(denomStr);
    await (tx as any).tillInventory.upsert({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
      update: { quantity: { increment: qty } },
      create: { currencyCode, denomination: denom, quantity: qty },
    });
  }
}

/**
 * Restock denominations — set absolute quantities.
 */
export async function restockTill(
  currencyCode: string,
  denominations: DenominationMap
): Promise<void> {
  const ops = Object.entries(denominations).map(([denomStr, qty]) => {
    const denom = parseFloat(denomStr);
    return prisma.tillInventory.upsert({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
      update: { quantity: qty },
      create: { currencyCode, denomination: denom, quantity: qty },
    });
  });
  await prisma.$transaction(ops);
}

/**
 * Summarize till totals: total face-value per currency (denominations × qty).
 */
export async function getTillSummary() {
  const inventory = await prisma.tillInventory.findMany({
    include: { currency: true },
    orderBy: [{ currencyCode: 'asc' }, { denomination: 'asc' }],
  });

  // Group by currency
  const grouped: Record<
    string,
    { code: string; name: string; flagEmoji: string; totalFaceValue: number; denominations: { denomination: number; quantity: number }[] }
  > = {};

  for (const row of inventory) {
    if (!grouped[row.currencyCode]) {
      grouped[row.currencyCode] = {
        code:           row.currencyCode,
        name:           row.currency.name,
        flagEmoji:      row.currency.flagEmoji,
        totalFaceValue: 0,
        denominations:  [],
      };
    }
    grouped[row.currencyCode].denominations.push({
      denomination: row.denomination,
      quantity:     row.quantity,
    });
    grouped[row.currencyCode].totalFaceValue += row.denomination * row.quantity;
  }

  return Object.values(grouped);
}
