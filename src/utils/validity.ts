import { formatDuration, intervalToDuration, type Duration } from "date-fns";

export type Validity =
  | { state: "no-expiry" }
  | { state: "valid"; span: string; until: Date }
  | { state: "expired"; span: string; since: Date };

/** "2 years, 3 months and 5 days": the three largest non-zero date units, else hours and minutes. */
export const humanSpan = (from: Date, to: Date): string => {
  const [start, end] = from <= to ? [from, to] : [to, from];
  const duration = intervalToDuration({ start, end });
  const pick = (units: (keyof Duration)[], max: number) =>
    units.filter((unit) => duration[unit]).slice(0, max);

  let units = pick(["years", "months", "days"], 3);
  if (units.length === 0) units = pick(["hours", "minutes"], 2);
  if (units.length === 0) return "less than a minute";

  const text = formatDuration(duration, { format: units, delimiter: ", " });
  const lastComma = text.lastIndexOf(", ");
  return lastComma === -1 ? text : `${text.slice(0, lastComma)} and ${text.slice(lastComma + 2)}`;
};

export const describeValidity = (
  expiresAt: Date | null | undefined,
  now = new Date(),
): Validity => {
  if (!expiresAt) return { state: "no-expiry" };
  return expiresAt > now
    ? { state: "valid", span: humanSpan(now, expiresAt), until: expiresAt }
    : { state: "expired", span: humanSpan(expiresAt, now), since: expiresAt };
};
