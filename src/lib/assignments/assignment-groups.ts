import type { ExternalAssignment } from "./assignment-service";

export function groupAssignmentsByWeek(assignments: ExternalAssignment[]) {
  const groups = new Map<number, ExternalAssignment[]>();
  for (const assignment of assignments) groups.set(assignment.weekNumber, [...(groups.get(assignment.weekNumber) ?? []), assignment]);
  return [...groups.entries()].map(([weekNumber, items]) => ({ weekNumber, items }));
}
