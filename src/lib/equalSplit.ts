export type EqualSplit = { memberId: number; shareAmount: number };

export function computeEqualSplits(total: number, memberIds: number[]): EqualSplit[] {
  if (!Number.isFinite(total) || total <= 0 || memberIds.length === 0) return [];
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / memberIds.length);
  const remainder = cents - base * memberIds.length;
  return memberIds.map((id, i) => ({
    memberId: id,
    shareAmount: (base + (i < remainder ? 1 : 0)) / 100,
  }));
}
