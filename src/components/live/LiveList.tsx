"use client";

import { useEffect, useState } from "react";
import { fetchUpcomingAndOngoingLives } from "@/services/live-service";
import type { LiveSchedule } from "@/types/live";
import LiveBottomSheet from "./LiveBottomSheet";
import { getUserById } from "@/services/user-service";
import Link from "next/link";
import { Skeleton } from "@/components/ui/skeleton"; // ← 追加

type UserMini = { avatarUrl: string; displayName: string };

export default function LiveList() {
  const [lives, setLives] = useState<LiveSchedule[]>([]);
  const [selected, setSelected] = useState<LiveSchedule | null>(null);
  const [users, setUsers] = useState<Record<string, UserMini>>({});
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchUpcomingAndOngoingLives();

        // 同じ配信者は最大2件
        const limitedLives: LiveSchedule[] = [];
        const countMap: Record<string, number> = {};
        for (const live of data) {
          const uid = live.streamers[0] || "unknown";
          countMap[uid] = (countMap[uid] || 0);
          if (countMap[uid] < 2) {
            limitedLives.push(live);
            countMap[uid]++;
          }
        }

        // 配信中と予定に分ける
        const now = new Date();
        const liveNow: LiveSchedule[] = [];
        const upcoming: LiveSchedule[] = [];
        for (const live of limitedLives) {
          const start =
            "toDate" in live.startTime ? live.startTime.toDate() : new Date(live.startTime);
          const end =
            "toDate" in live.endTime ? live.endTime.toDate() : new Date(live.endTime);
          if (now >= start && now <= end) liveNow.push(live);
          else if (now < start) upcoming.push(live);
        }

        const finalLives = [...liveNow, ...upcoming.slice(0, 5)];
        setLives(finalLives);

        // ユーザー情報取得
        const mini: Record<string, UserMini> = {};
        for (const live of finalLives) {
          for (const uid of live.streamers) {
            if (!mini[uid]) {
              const u = await getUserById(uid);
              mini[uid] = {
                avatarUrl: u?.avatarUrl || "",
                displayName: (u?.displayName as string) || u?.email || "Unknown",
              };
            }
          }
        }
        setUsers(mini);
      } catch (err) {
        console.error("🔥 Firestore fetch error:", err);
      } finally {
        setLoadingUsers(false);
      }
    })();
  }, []);

  return (
    <section className="mb-6">
      {/* スマホ: p-4, PC: p-6 */}
      <div className="bg-white rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] p-4 md:p-6">
        <h2 className="text-2xl font-bold mb-3">配信スケジュール</h2>

        {lives.length === 0 ? (
          <p className="text-gray-500">現在予定されている配信はありません。</p>
        ) : (
          <>
            {/* === PC版 (16:9 サムネイルカード) === */}
            <div className="hidden md:flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
              {lives.map((live) => {
                const start =
                  "toDate" in live.startTime
                    ? live.startTime.toDate()
                    : new Date(live.startTime);
                const end =
                  "toDate" in live.endTime
                    ? live.endTime.toDate()
                    : new Date(live.endTime);

                const now = new Date();
                const isLive = now >= start && now <= end;

                const firstUid = live.streamers[0];
                const mini = firstUid ? users[firstUid] : undefined;
                const avatarUrl = mini?.avatarUrl || "";

                const startDate = `${start.getMonth() + 1}/${start.getDate()} ${start
                  .getHours()
                  .toString()
                  .padStart(2, "0")}:${start
                  .getMinutes()
                  .toString()
                  .padStart(2, "0")}~`;

                return (
                  <div
                    key={live.id}
                    onClick={() => setSelected(live)}
                    className={`relative w-60 flex-shrink-0 aspect-video rounded-lg overflow-hidden cursor-pointer
                      ${isLive ? "border-2 border-red-500" : ""}`}
                  >
                    {loadingUsers || !avatarUrl ? (
                      <Skeleton className="w-full h-full" />
                    ) : (
                      <img
                        src={avatarUrl}
                        alt={live.title}
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      {isLive ? (
                        <span className="inline-block px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold">
                          配信中！
                        </span>
                      ) : (
                        <p className="text-[11px] text-white">{startDate}</p>
                      )}
                      <h3 className="font-bold text-sm text-white mt-1 truncate whitespace-nowrap overflow-hidden">
                        {live.title}
                      </h3>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* === スマホ版 (丸アイコン) === */}
            <div className="flex md:hidden gap-[12px] overflow-x-auto py-1 scrollbar-hide">
              {lives.map((live) => {
                const start =
                  "toDate" in live.startTime
                    ? live.startTime.toDate()
                    : new Date(live.startTime);
                const now = new Date();
                const isLive = now >= start;

                const firstUid = live.streamers[0];
                const mini = firstUid ? users[firstUid] : undefined;
                const avatarUrl = mini?.avatarUrl || "";
                const displayName = mini?.displayName || "配信者";

                const startDate = `${start.getMonth() + 1}/${start.getDate()} ${start
                  .getHours()
                  .toString()
                  .padStart(2, "0")}:${start
                  .getMinutes()
                  .toString()
                  .padStart(2, "0")}~`;

                return (
                  <div
                    key={live.id}
                    className="flex flex-col items-center text-center flex-shrink-0"
                  >
                    {/* 丸アイコン */}
                    <button
                      onClick={() => setSelected(live)}
                      className="relative block w-16 h-16"
                    >
                      {loadingUsers || !avatarUrl ? (
                        <Skeleton className="w-16 h-16 rounded-full" />
                      ) : (
                        <div
                          className={`w-16 h-16 rounded-full p-[3px] ${
                            isLive
                              ? "bg-gradient-to-br from-[#FF6B6B] via-[#FF4757] to-[#FF8E8E]"
                              : "bg-gray-300"
                          }`}
                        >
                          <img
                            src={avatarUrl}
                            alt={displayName}
                            className="w-full h-full rounded-full object-cover"
                          />
                        </div>
                      )}
                      {isLive && !loadingUsers && (
                        <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold text-white rounded-md border border-white bg-gradient-to-b from-[#FF6B6B] via-[#FF4757] to-[#FF8E8E]">
                          LIVE
                        </span>
                      )}
                    </button>

                    {/* 名前 */}
                    <div className="mt-2 text-[12px] font-medium text-gray-900 truncate w-[72px]">
                      {loadingUsers ? (
                        <Skeleton className="h-3 w-full rounded" />
                      ) : (
                        displayName
                      )}
                    </div>

                    {/* 配信日時 */}
                    <p className="mt-1 text-[11px] text-gray-700">
                      {loadingUsers ? <Skeleton className="h-3 w-14 rounded" /> : startDate}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* 配信予定一覧へ */}
            <div className="mt-4">
              <Link
                href="/schedule"
                className="w-full block text-center rounded-full border border-gray-300 bg-white px-4 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                配信予定一覧へ
              </Link>
            </div>
          </>
        )}

        {selected && (
          <LiveBottomSheet live={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </section>
  );
}
