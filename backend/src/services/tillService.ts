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

  // Use findFirst with individual field conditions — NOT findUnique with the composite
  // unique key. Prisma's composite key lookup generates a row-value comparison:
  //   WHERE ("currencyCode", "denomination") = ($1, $2)
  // PostgreSQL's tuple comparison is type-strict: when $2 is bound as int4 (which
  // Prisma does for whole-number JS numbers like 5, 10, 50) against a DOUBLE PRECISION
  // column, it does not perform the implicit int4→float8 cast that a plain
  //   WHERE "denomination" = $2
  // condition does — so the row is not found even though it exists.
  const rows = await Promise.all(
    entries.map(([denomStr]) => {
      const denom = parseFloat(denomStr);
      console.log(`[till] sufficiency lookup currencyCode=${currencyCode} denomination=${denom} typeof=${typeof denom}`);
      return prisma.tillInventory.findFirst({
        where: { currencyCode, denomination: denom },
      });
    })
  );

  for (let i = 0; i < entries.length; i++) {
    const [denomStr, qty] = entries[i];
    const denom = parseFloat(denomStr);
    const row = rows[i];
    if (!row) {
      prisma.tillInventory
        .findMany({ where: { currencyCode } })
        .then(current => {
          console.error(
            `[till] denomination_not_found currencyCode=${currencyCode} denomination=${denom} ` +
            `typeof=${typeof denom} requested_qty=${qty} ` +
            `current_till=${JSON.stringify(current.map(r => ({ d: r.denomination, q: r.quantity })))}`
          );
        })
        .catch(() => {});
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
    // update returns the new record — derive quantityBefore from it (no extra findUnique needed)
    const updated = await (tx as any).tillInventory.update({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
      data: { quantity: { decrement: qty } },
    });
    const quantityAfter  = updated.quantity;
    const quantityBefore = quantityAfter + qty;
    await (tx as any).tillHistoryEntry.create({
      data: {
        currency:      currencyCode,
        changeType:    'WITHDRAWAL',
        denomination:  denom,
        quantityBefore,
        quantityAfter,
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
    // upsert returns the new record — derive quantityBefore from it (no extra findUnique needed)
    const result = await (tx as any).tillInventory.upsert({
      where: { currencyCode_denomination: { currencyCode, denomination: denom } },
      update: { quantity: { increment: qty } },
      create: { currencyCode, denomination: denom, quantity: qty },
    });
    const quantityAfter  = result.quantity;
    const quantityBefore = quantityAfter - qty;
    await (tx as any).tillHistoryEntry.create({
      data: {
        currency:      currencyCode,
        changeType:    'DEPOSIT',
        denomination:  denom,
        quantityBefore,
        quantityAfter,
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
