import type { LiveSchedule } from "@/types/live";

export function createEvent(live: LiveSchedule) {
  const start = new Date(live.startTime.toDate()).toISOString().replace(/-|:|\.\d+/g, "");
  const end = new Date(live.endTime.toDate()).toISOString().replace(/-|:|\.\d+/g, "");

  const ics = `
BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:${live.title}
DESCRIPTION:${live.description}
DTSTART:${start}
DTEND:${end}
LOCATION:${live.url}
END:VEVENT
END:VCALENDAR
`;

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `${live.title}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
