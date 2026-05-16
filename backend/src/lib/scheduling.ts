import { prisma } from './prisma';

interface RuleData {
  id: string;
  agentProfileId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

/**
 * Generates AvailabilitySlot records for an active rule over the next `weeks` weeks.
 * Skips any date where a slot from this rule already exists.
 */
export async function expandRule(rule: RuleData, weeks: number): Promise<void> {
  const now = new Date();
  const slotsToCreate: Array<{ startAt: Date; endAt: Date }> = [];

  for (let d = 1; d <= weeks * 7; d++) {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + d);

    if (date.getDay() !== rule.dayOfWeek) continue;

    const [startH, startM] = rule.startTime.split(':').map(Number);
    const [endH, endM] = rule.endTime.split(':').map(Number);

    const startAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), startH, startM);
    const endAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), endH, endM);

    if (startAt <= now) continue;
    slotsToCreate.push({ startAt, endAt });
  }

  if (slotsToCreate.length === 0) return;

  const existingStarts = new Set(
    (
      await prisma.availabilitySlot.findMany({
        where: { ruleId: rule.id, startAt: { in: slotsToCreate.map((s) => s.startAt) } },
        select: { startAt: true },
      })
    ).map((s) => s.startAt.getTime())
  );

  const newSlots = slotsToCreate.filter((s) => !existingStarts.has(s.startAt.getTime()));

  if (newSlots.length > 0) {
    await prisma.availabilitySlot.createMany({
      data: newSlots.map((s) => ({
        agentProfileId: rule.agentProfileId,
        startAt: s.startAt,
        endAt: s.endAt,
        status: 'AVAILABLE' as const,
        ruleId: rule.id,
      })),
    });
  }
}

/** Expands all active rules for all agents for the next `weeks` weeks. */
export async function expandAllActiveRules(weeks = 4): Promise<void> {
  const rules = await prisma.availabilityRule.findMany({ where: { isActive: true } });
  for (const rule of rules) {
    await expandRule(rule, weeks);
  }
}
