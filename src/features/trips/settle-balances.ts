export interface SettlementTransaction {
  fromName: string;
  fromId: number;
  toName: string;
  toId: number;
  amount: number;
}

export function computeSettlement(
  balances: { memberId: number | null; name: string; balance: number }[],
): SettlementTransaction[] {
  const debtors: { id: number; name: string; amount: number }[] = [];
  const creditors: { id: number; name: string; amount: number }[] = [];

  for (const b of balances) {
    if (b.memberId == null) continue;
    if (b.balance > 0.005) {
      debtors.push({ id: b.memberId, name: b.name, amount: b.balance });
    } else if (b.balance < -0.005) {
      creditors.push({ id: b.memberId, name: b.name, amount: -b.balance });
    }
  }

  const transactions: SettlementTransaction[] = [];
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  let d = 0;
  let c = 0;

  while (d < debtors.length && c < creditors.length) {
    const debtor = debtors[d];
    const creditor = creditors[c];
    const pay = Math.min(debtor.amount, creditor.amount);

    transactions.push({
      fromName: debtor.name,
      fromId: debtor.id,
      toName: creditor.name,
      toId: creditor.id,
      amount: Math.round(pay * 100) / 100,
    });

    debtor.amount -= pay;
    creditor.amount -= pay;

    if (debtor.amount < 0.005) d++;
    if (creditor.amount < 0.005) c++;
  }

  return transactions;
}
