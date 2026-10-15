import type { ExternalAssignment } from "./assignment-service";

export function groupAssignmentsByWeek<T extends ExternalAssignment>(assignments: T[]) {
  const groups = new Map<number, T[]>();
  for (const assignment of assignments) groups.set(assignment.weekNumber, [...(groups.get(assignment.weekNumber) ?? []), assignment]);
  return [...groups.entries()].map(([weekNumber, items]) => ({ weekNumber, items }));
}
