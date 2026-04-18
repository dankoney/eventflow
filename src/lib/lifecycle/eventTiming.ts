/** Hours after scheduled end before status becomes COMPLETED. */
export const COMPLETION_GRACE_HOURS = 6;

export function eventCompletionAt(endDate: Date): Date {
  return new Date(endDate.getTime() + COMPLETION_GRACE_HOURS * 60 * 60 * 1000);
}
