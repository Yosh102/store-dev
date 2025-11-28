// src/app/api/calendar/ics/route.ts
import { NextRequest, NextResponse } from "next/server";

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}
function esc(s: string) {
  return (s || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const title = url.searchParams.get("title") || "イベント";
  const desc = url.searchParams.get("desc") || "";
  const loc = url.searchParams.get("loc") || "";
  const start = new Date(Number(url.searchParams.get("start"))); // ms
  const end = new Date(Number(url.searchParams.get("end")));     // ms

  const ics = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PLAY TUNE//Live Reminder//JP
CALSCALE:GREGORIAN
BEGIN:VEVENT
SUMMARY:${esc(title)}
DESCRIPTION:${esc(desc)}
LOCATION:${esc(loc)}
DTSTART:${icsDate(start)}
DTEND:${icsDate(end)}
END:VEVENT
END:VCALENDAR`;

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      // inline にしておくと iOS/Safari でカレンダー選択が出やすい
      "Content-Disposition": `inline; filename="event.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
