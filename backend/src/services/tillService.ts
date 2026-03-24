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
  const entries = Object.entries(denominations);
  const rows = await Promise.all(
    entries.map(([denomStr]) =>
      prisma.tillInventory.findUnique({
        where: { currencyCode_denomination: { currencyCode, denomination: parseFloat(denomStr) } },
      })
    )
  );

  for (let i = 0; i < entries.length; i++) {
    const [denomStr, qty] = entries[i];
    const denom = parseFloat(denomStr);
    const row = rows[i];
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
  denominations: DenominationMap,
  performedBy = 'system'
) {
  for (const [denomStr, qty] of Object.entries(denominations)) {
    const denom = parseFloat(denomStr);
    const before = await (tx as any).tillInventory.findUnique({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
    });
    const quantityBefore = before?.quantity ?? 0;
    await (tx as any).tillInventory.update({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
      data: { quantity: { decrement: qty } },
    });
    await (tx as any).tillHistoryEntry.create({
      data: {
        currency:      currencyCode,
        changeType:    'WITHDRAWAL',
        denomination:  denom,
        quantityBefore,
        quantityAfter: quantityBefore - qty,
        quantityDelta: -qty,
        performedBy,
        note: 'Transaction sell',
      },
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
  denominations: DenominationMap,
  performedBy = 'system'
) {
  for (const [denomStr, qty] of Object.entries(denominations)) {
    const denom = parseFloat(denomStr);
    const before = await (tx as any).tillInventory.findUnique({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
    });
    const quantityBefore = before?.quantity ?? 0;
    await (tx as any).tillInventory.upsert({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
      update: { quantity: { increment: qty } },
      create: { currencyCode, denomination: denom, quantity: qty },
    });
    await (tx as any).tillHistoryEntry.create({
      data: {
        currency:      currencyCode,
        changeType:    'DEPOSIT',
        denomination:  denom,
        quantityBefore,
        quantityAfter: quantityBefore + qty,
        quantityDelta: qty,
        performedBy,
        note: 'Transaction buy',
      },
    });
  }
}

/**
 * Restock denominations — set absolute quantities.
 */
export async function restockTill(
  currencyCode: string,
  denominations: DenominationMap,
  performedBy = 'admin'
): Promise<void> {
  for (const [denomStr, qty] of Object.entries(denominations)) {
    const denom = parseFloat(denomStr);
    const before = await prisma.tillInventory.findUnique({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
    });
    const quantityBefore = before?.quantity ?? 0;
    await prisma.tillInventory.upsert({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
      update: { quantity: qty },
      create: { currencyCode, denomination: denom, quantity: qty },
    });
    await prisma.tillHistoryEntry.create({
      data: {
        currency:      currencyCode,
        changeType:    'ADJUSTMENT',
        denomination:  denom,
        quantityBefore,
        quantityAfter: qty,
        quantityDelta: qty - quantityBefore,
        performedBy,
        note: 'Manual restock',
      },
    });
  }
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
