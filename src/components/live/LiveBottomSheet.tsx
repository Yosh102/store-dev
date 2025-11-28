"use client";

import { Drawer } from "vaul";
import type { LiveSchedule } from "@/types/live";
import { useEffect, useMemo, useState } from "react";
import { getUserById } from "@/services/user-service";
import type { Timestamp } from "firebase/firestore";

/* ------------- 補助API ------------- */
async function fetchGroupsByIds(ids: string[]) {
  if (ids.length === 0) return {};
  const url = `/api/groups?ids=${ids.join(",")}`;
  const res = await fetch(url);
  const json = await res.json();
  const map: Record<string, any> = {};
  for (const g of json.groups) map[g.id] = g;
  return map;
}

/* ===================================
   LiveBottomSheet（修正版）
=================================== */
type Props = { live: LiveSchedule | null; onClose: () => void };

export default function LiveBottomSheet({ live, onClose }: Props) {
  const [open, setOpen] = useState(!!live);
  const [streamers, setStreamers] = useState<any[]>([]);

  useEffect(() => {
    setOpen(!!live);

    if (!live) {
      setStreamers([]);
      return;
    }

    (async () => {
      const users = await Promise.all(live.streamers.map((uid) => getUserById(uid)));
      const allGroupIds = users.flatMap((u) => u?.groupIds || []);
      const uniqueGroupIds = [...new Set(allGroupIds)];
      const groupMap = await fetchGroupsByIds(uniqueGroupIds);

      const infos = users.map((user) => {
        if (!user)
          return { id: "unknown", name: "不明なユーザー", avatarUrl: "/default-avatar.png" };
        const groupId = user.groupIds?.[0];
        const group = groupId ? groupMap[groupId] : null;
        return {
          id: user.id,
          name: user.displayName || "名無し",
          avatarUrl: user.avatarUrl || "/default-avatar.png",
          group,
        };
      });

      setStreamers(infos);
    })();
  }, [live]);

  /** ------- Hooks は早期 return より前に呼ぶ ------- */
  const start = useMemo(() => toDate(live?.startTime ?? new Date()), [live?.startTime]);
  const end = useMemo(() => toDate(live?.endTime ?? new Date()), [live?.endTime]);

  const jstRange = useMemo(() => (live ? formatJstTimeRange(start, end) : ""), [live, start, end]);
  const status = useMemo(() => getLiveStatus(start, end), [start, end]);
  const untilText = useMemo(
    () => (live ? timeUntilJst(start, end, status) : ""),
    [live, start, end, status]
  );

  const handleClose = () => {
    setOpen(false);
    setTimeout(onClose, 250);
  };

  /** ここで早期 return しても OK（Hooks はすでに呼ばれている） */
  if (!live) return null;

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
      }}
      shouldScaleBackground
      closeThreshold={0.25}
      snapPoints={["contentHeight", 0.9]}
      activeSnapPoint="contentHeight"
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        <Drawer.Content
          className="
            fixed inset-x-0 bottom-0 z-50
            rounded-t-2xl bg-white
            shadow-[0_-4px_20px_rgba(0,0,0,0.2)]
            pb-[env(safe-area-inset-bottom)]
          "
        >
          <div className="flex justify-center pt-3 pb-2">
            <div className="h-1.5 w-12 rounded-full bg-gray-300" />
          </div>

          <div className="px-6 py-6 space-y-6">
            <Drawer.Title className="text-xl font-bold">{live.title}</Drawer.Title>

            {/* 複数配信者 */}
            {streamers.map((s) => (
              <div key={s.id} className="flex items-center space-x-3">
                <img
                  src={s.avatarUrl || "/default-avatar.png"}
                  alt={s.name}
                  className="w-10 h-10 rounded-full border border-gray-200 object-cover"
                />
                <div className="flex items-center text-sm font-semibold">
                  <span className="text-gray-900">{s.name}</span>
                  {s.group && (
                    <>
                      <span className="mx-1">・</span>
                      <span className="text-gray-600">{s.group.name}</span>
                    </>
                  )}
                </div>
              </div>
            ))}

            {/* 情報カード */}
            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm space-y-3">
              <InfoRow label="配信時間" value={jstRange} />
              <InfoRow label="開始まで" value={untilText} accent="blue" />

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <PlatformIcon platform={live.platform} />
                  <span className="text-sm font-semibold text-gray-900">{live.platform}</span>
                </div>
                {live.url && (
                  <a
                    href={live.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1 text-sm font-medium rounded-md border border-gray-300 bg-white text-gray-800 hover:bg-gray-50"
                  >
                    視聴ページへ
                  </a>
                )}
              </div>
            </div>

            {/* 説明 */}
            {live.description && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-gray-900">説明</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{live.description}</p>
              </div>
            )}

            {/* アクション */}
            <div className="space-y-3">
              <button
                onClick={() =>
                  addToCalendar(live.title, live.description, live.url, start, end)
                }
                className="block w-full rounded-full bg-black py-3 text-center text-sm font-semibold text-white hover:opacity-90"
              >
                カレンダーに追加
              </button>
              <button
                onClick={handleClose}
                className="block w-full rounded-full bg-gray-200 py-3 text-center text-sm font-semibold text-black hover:bg-gray-300"
              >
                閉じる
              </button>
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}

/* ---------- 小物 ---------- */
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: "blue" }) {
  return (
    <div className="flex items-start">
      <div className="min-w-20 pt-0.5 text-xs font-medium text-gray-500">{label}</div>
      <div
        className={`flex-1 text-sm font-semibold ${
          accent === "blue" ? "text-blue-600" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

/* ---------- Platform Icon (SVG) ---------- */
function PlatformIcon({ platform }: { platform: string }) {
  const p = (platform || "").toLowerCase();
  if (p.includes("youtube"))
    return <img src="/icons/youtube.svg" alt="YouTube" className="h-4" />;
  if (p.includes("twitcasting") || p.includes("ツイキャス"))
    return <img src="/icons/twitcasting.svg" alt="ツイキャス" className="h-4" />;
  if (p.includes("twitch")) return <img src="/icons/twitch.svg" alt="Twitch" className="h-4" />;
  if (p.includes("instagram"))
    return <img src="/icons/instagram.svg" alt="Instagram" className="h-4" />;
  if (p.includes("tiktok")) return <img src="/icons/tiktok.svg" alt="TikTok" className="h-4" />;
  return <span className="text-gray-500">📺</span>;
}

/* ---------- ヘルパー群 ---------- */
function toDate(v: Date | Timestamp | string | number | null | undefined): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  if (typeof (v as any)?.toDate === "function") return (v as any).toDate();
  return new Date(v as any);
}

function formatJstTimeRange(start: Date, end: Date) {
  const dateFmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    month: "numeric",
    day: "numeric",
  });
  const timeFmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${dateFmt.format(start)} ${timeFmt.format(start)} - ${timeFmt.format(end)}`;
}

type LiveStatus = "scheduled" | "live" | "ended";
function getLiveStatus(start: Date, end: Date): LiveStatus {
  const now = new Date();
  if (now < start) return "scheduled";
  if (now >= start && now <= end) return "live";
  return "ended";
}

function timeUntilJst(start: Date, end: Date, status: LiveStatus) {
  const now = new Date();
  const nowJst = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));

  if (status === "live") {
    const remainingMs = end.getTime() - nowJst.getTime();
    const h = Math.floor(remainingMs / 3600000);
    const m = Math.floor((remainingMs % 3600000) / 60000);
    return h > 0 ? `配信中 (あと${h}時間${m}分予定)` : `配信中 (あと${m}分予定)`;
    }
  if (status === "scheduled") {
    const diffMs = start.getTime() - nowJst.getTime();
    const days = Math.floor(diffMs / 86400000);
    const hours = Math.floor((diffMs % 86400000) / 3600000);
    const minutes = Math.floor((diffMs % 3600000) / 60000);
    if (days > 0) return `${days}日後`;
    if (hours > 0) return `${hours}時間後`;
    return `${minutes}分後`;
  }
  return "配信終了";
}

/* ============================
   ネイティブカレンダー優先の追加処理
   - iOS Safari: webcal:// でネイティブCalendar
   - 共有対応: ICSファイルをWeb Share
   - 直リンク: httpsのICSを開く（既定カレンダー/Outlook）
   - 最後の保険: Google Calendar（コメントアウト）
============================ */
function addToCalendar(
  title: string,
  desc: string | undefined,
  loc: string | undefined,
  start: Date,
  end: Date
) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const params = new URLSearchParams({
    title,
    desc: desc || "",
    loc: loc || "",
    start: String(start.getTime()), // ms
    end: String(end.getTime()),     // ms
  });
  const icsUrl = `${base}/api/calendar/ics?${params.toString()}`;

  // 1) まずは Web Share（URL 共有）… 失敗しても次へ
  if (navigator.share) {
    navigator
      .share({
        title: "カレンダーに追加",
        text: title,
        url: icsUrl,
      })
      .then(() => {})
      .catch(() => {
        // 無視して次の手に進む
        tryOpenNewTab(icsUrl) || tryProgrammaticClick(icsUrl) || (window.location.href = icsUrl);
      });
    return;
  }

  // 2) iOS Safari では download 属性が無視されがち → 直接遷移 or 新規タブ
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);

  if (isIOS && isSafari) {
    // 新規タブ or カレント遷移で確実に「何か」起きるように
    tryOpenNewTab(icsUrl) || (window.location.href = icsUrl);
    return;
  }

  // 3) それ以外は新規タブ → だめなら擬似クリック → 最後にカレント遷移
  tryOpenNewTab(icsUrl) || tryProgrammaticClick(icsUrl) || (window.location.href = icsUrl);
}
/** 新規タブオープン（ポップアップブロックされる可能性あり） */
function tryOpenNewTab(url: string): boolean {
  const w = window.open(url, "_blank");
  return !!w;
}

/** 擬似クリックで遷移 */
function tryProgrammaticClick(url: string): boolean {
  try {
    const a = document.createElement("a");
    a.href = url;
    // a.download = "event.ics"; // iOS では効かないが他では有効なことがある
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}
