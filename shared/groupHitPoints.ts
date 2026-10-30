/** Each rolled creature owns its maximum; old snapshots may only have a shared max. */
export function memberMaximums(group: { memberHp?: number[]; memberMaxHp?: number[]; maxHp?: number }): number[] {
  return (group.memberHp ?? []).map((hp, i) => {
    const saved = group.memberMaxHp?.[i];
    return typeof saved === "number" && Number.isFinite(saved) && saved > 0
      ? saved : Math.max(1, group.maxHp ?? 1, hp);
  });
}

export function healGroupMember(group: { memberHp: number[]; memberMaxHp?: number[]; maxHp: number }, index: number, amount: number) {
  const maxima = memberMaximums(group);
  const hp = [...group.memberHp];
  if (index >= 0 && index < hp.length && Number.isFinite(amount) && amount > 0)
    hp[index] = Math.max(hp[index], Math.min(maxima[index], hp[index] + amount));
  return { memberHp: hp, memberMaxHp: maxima };
}
