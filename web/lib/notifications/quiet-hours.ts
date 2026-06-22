function parseHHmm(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

function wallMinutesInZone(date: Date, timeZone: string): number | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === "hour")?.value;
    const minute = parts.find((p) => p.type === "minute")?.value;
    if (hour == null || minute == null) return null;
    const h = Number(hour);
    const m = Number(minute);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
    return h * 60 + m;
  } catch {
    return null;
  }
}

export function isWithinQuietHours(params: {
  now: Date;
  timeZone: string;
  quietStart: string;
  quietEnd: string;
}): boolean {
  const cur = wallMinutesInZone(params.now, params.timeZone);
  const start = parseHHmm(params.quietStart);
  const end = parseHHmm(params.quietEnd);
  if (cur == null || start == null || end == null) return false;
  if (start === end) return false;
  if (start < end) {
    return cur >= start && cur < end;
  }
  return cur >= start || cur < end;
}
