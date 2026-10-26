/** 行程输出契约校验 + 简易「跳点」规则（演示幻觉治理） */

export type Slot = { time: string; place: string; note?: string; city?: string };
export type DayPlan = { day: number; slots: Slot[] };

export type ContractIssue = {
  level: "error" | "warn";
  code: string;
  message: string;
};

export function validateItineraryContract(days: DayPlan[]): {
  ok: boolean;
  issues: ContractIssue[];
  rewritten?: DayPlan[];
} {
  const issues: ContractIssue[] = [];
  if (!Array.isArray(days) || !days.length) {
    return { ok: false, issues: [{ level: "error", code: "EMPTY_DAYS", message: "缺少 days 数组" }] };
  }

  const rewritten: DayPlan[] = days.map((d) => ({
    day: d.day,
    slots: (d.slots || []).map((s) => ({ ...s })),
  }));

  for (const day of rewritten) {
    if (!day.slots?.length) {
      issues.push({ level: "error", code: "EMPTY_SLOTS", message: `Day${day.day} 无时段` });
      continue;
    }
    for (const slot of day.slots) {
      if (!slot.time?.trim() || !slot.place?.trim()) {
        issues.push({
          level: "error",
          code: "MISSING_FIELD",
          message: `Day${day.day} 时段缺少 time/place`,
        });
      }
    }
    // 简易跳点：同日相邻 slot city 突变则改写 note
    for (let i = 1; i < day.slots.length; i++) {
      const prev = day.slots[i - 1];
      const cur = day.slots[i];
      if (prev.city && cur.city && prev.city !== cur.city) {
        issues.push({
          level: "warn",
          code: "GEO_JUMP",
          message: `Day${day.day} 疑似跨城跳点：${prev.city}→${cur.city}，已改写备注`,
        });
        cur.note = `${cur.note || ""}（已校正：与上一段同城约束，避免跳点）`.trim();
        cur.city = prev.city;
      }
    }
  }

  const ok = !issues.some((i) => i.level === "error");
  return { ok, issues, rewritten };
}
