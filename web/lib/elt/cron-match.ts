/** Shared 5-field cron matching (minute hour dom month dow) with IANA timezone. */

function cronPartMatches(part: string, value: number): boolean {
  if (part === "*") return true;
  return part.split(",").some((seg) => {
    if (seg.includes("/")) {
      const [range, step] = seg.split("/");
      const [start] = range === "*" ? [0] : range.split("-").map(Number);
      return value >= start && (value - start) % Number(step) === 0;
    }
    if (seg.includes("-")) {
      const [lo, hi] = seg.split("-").map(Number);
      return value >= lo && value <= hi;
    }
    return Number(seg) === value;
  });
}

function tzParts(date: Date, timezone: string): { minute: number; hour: number; dom: number; dow: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    weekday: "short",
    day: "numeric",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.find((p) => p.type === "weekday")?.value ?? ""
  );
  return {
    minute: get("minute"),
    hour: get("hour") % 24,
    dom: get("day"),
    dow: dow >= 0 ? dow : 0,
  };
}

/** True when `cron` (5-field) fires at `at` in `timezone`. */
export function cronMatchesAt(cron: string, timezone: string, at: Date = new Date()): boolean {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return false;
    const [minPart, hourPart, domPart, , dowPart] = parts;
    const { minute, hour, dom, dow } = tzParts(at, timezone || "UTC");
    return (
      (domPart === "*" || dowPart === "*" || cronPartMatches(domPart, dom)) &&
      (dowPart === "*" || cronPartMatches(dowPart, dow)) &&
      cronPartMatches(hourPart, hour) &&
      cronPartMatches(minPart, minute)
    );
  } catch {
    return false;
  }
}

/** Compute the next wall-clock time a 5-field cron expression fires, respecting a timezone. */
export function nextCronRun(cron: string, timezone: string): string | null {
  try {
    const parts = cron.trim().split(/\s+/);
    if (parts.length !== 5) return null;
    const [minPart, hourPart, domPart, , dowPart] = parts;
    const tz = timezone || "UTC";

    const now = new Date();
    const candidate = new Date(now.getTime() + 60_000);
    candidate.setSeconds(0, 0);

    for (let i = 0; i < 60 * 24 * 8; i++) {
      const { minute, hour, dom, dow } = tzParts(candidate, tz);
      if (
        (domPart === "*" || dowPart === "*" || cronPartMatches(domPart, dom)) &&
        (dowPart === "*" || cronPartMatches(dowPart, dow)) &&
        cronPartMatches(hourPart, hour) &&
        cronPartMatches(minPart, minute)
      ) {
        return (
          new Intl.DateTimeFormat("en-US", {
            timeZone: tz,
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).format(candidate) + (tz !== "UTC" ? "" : " UTC")
        );
      }
      candidate.setTime(candidate.getTime() + 60_000);
    }
    return null;
  } catch {
    return null;
  }
}
