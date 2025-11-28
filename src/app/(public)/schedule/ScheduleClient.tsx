// src/app/schedule/page.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { LiveSchedule } from '@/types/live';
import { fetchUpcomingAndOngoingLives } from '@/services/live-service';
import { getUserById } from '@/services/user-service';
import { Skeleton } from '@/components/ui/skeleton';
import LiveBottomSheet from '@/components/live/LiveBottomSheet'; // パスは環境に合わせて
import { Bell } from 'lucide-react';
import { useAuth } from '@/context/auth-context'; // ★ 追加
import { Button } from '@/components/ui/button';   // ★ shadcnボタン（使っていれば）

type UserMini = { avatarUrl: string; displayName: string };

const WK = ['日', '月', '火', '水', '木', '金', '土'];
const MOBILE_CARD_THRESHOLD = 3; // 3件以下ならモバイルでもカードUI

function toDate(v: any): Date {
  return typeof v?.toDate === 'function' ? v.toDate() : new Date(v);
}
function ymdKey(d: Date): string {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}
function dateLabel(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日(${WK[d.getDay()]})`;
}
function timeLabel(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}~`;
}

export default function SchedulePage() {
  const [lives, setLives] = useState<LiveSchedule[]>([]);
  const [users, setUsers] = useState<Record<string, UserMini>>({});
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selected, setSelected] = useState<LiveSchedule | null>(null);
  const [notifOn, setNotifOn] = useState(false); // 通知モック

  const { user } = useAuth(); // ★ ログイン状態

  useEffect(() => {
    (async () => {
      try {
        const data = await fetchUpcomingAndOngoingLives();
        const sorted = [...data].sort(
          (a, b) => toDate(a.startTime).getTime() - toDate(b.startTime).getTime()
        );
        setLives(sorted);

        // 配信者情報をまとめて取得
        const ids = new Set<string>();
        sorted.forEach((l) => l.streamers.forEach((id) => ids.add(id)));
        const entries = await Promise.all(
          Array.from(ids).map(async (uid) => {
            const u = await getUserById(uid);
            return [
              uid,
              {
                avatarUrl: u?.avatarUrl || '',
                displayName: (u?.displayName as string) || u?.email || 'Unknown',
              } as UserMini,
            ] as const;
          })
        );
        setUsers(Object.fromEntries(entries));
      } catch (e) {
        console.error('Failed to load schedule:', e);
      } finally {
        setLoading(false);
        setLoadingUsers(false);
      }
    })();
  }, []);

  // 日付でグループ化
  const grouped = useMemo(() => {
    const map: Record<string, LiveSchedule[]> = {};
    for (const live of lives) {
      const key = ymdKey(toDate(live.startTime));
      if (!map[key]) map[key] = [];
      map[key].push(live);
    }
    return map;
  }, [lives]);

  const orderedDays = useMemo(() => Object.keys(grouped).sort(), [grouped]);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <Link href="/" className="text-sm text-gray-700 hover:text-gray-900">
            ← トップ
          </Link>
          <div className="h-6" />
        </div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">配信スケジュール</h1>
          {/* <button
            type="button"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 px-3 py-1.5 text-sm bg-white text-gray-800"
            disabled
            title="通知（モック）"
          >
            <Bell className="w-4 h-4" />
            通知
          </button> */}
        </div>
        {[...Array(3)].map((_, i) => (
          <section key={i} className="bg-white rounded-2xl p-2">
            <Skeleton className="h-6 w-48 mb-3" />
            <div className="hidden md:flex gap-4 overflow-x-auto pb-2">
              {[...Array(4)].map((__, j) => (
                <Skeleton key={j} className="w-60 aspect-video rounded-lg" />
              ))}
            </div>
            <div className="flex md:hidden gap-3 overflow-x-auto py-1">
              {[...Array(6)].map((__, j) => (
                <Skeleton key={j} className="w-16 h-16 rounded-full" />
              ))}
            </div>
          </section>
        ))}
      </main>
    );
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-6">
      {/* ヘッダー：左上に ← トップ */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm text-gray-700 hover:text-gray-900">
          ← トップ
        </Link>
        <div className="h-6" />
      </div>

      {/* タイトル + 通知（モック） */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">配信スケジュール</h1>
        {/* <button
          type="button"
          onClick={() => setNotifOn((v) => !v)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm bg-white ${
            notifOn ? 'border-black text-black' : 'border-gray-300 text-gray-800'
          }`}
          title="通知（モック）"
        >
          <Bell className="w-4 h-4" />
          通知{notifOn ? ' ON' : ''}
        </button> */}
      </div>

      {orderedDays.length === 0 ? (
        <p className="text-gray-500">現在予定されている配信はありません。</p>
      ) : (
        orderedDays.map((dayKey) => {
          const d = new Date(dayKey + 'T00:00:00');
          const dayLives = grouped[dayKey];

          return (
            <section key={dayKey} className="bg-white rounded-2xl p-2">
              <h2 className="text-xl font-bold mb-3">{dateLabel(d)}</h2>

              {/* PC：横スクロール16:9カード */}
              <div className="hidden md:flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                {dayLives.map((live) => {
                  const start = toDate(live.startTime);
                  const end = toDate(live.endTime);
                  const now = new Date();
                  const isLive = now >= start && now <= end;

                  const firstUid = live.streamers[0];
                  const mini = firstUid ? users[firstUid] : undefined;
                  const avatarUrl = mini?.avatarUrl || '';
                  const startLabel = `${start.getMonth() + 1}/${start.getDate()} ${timeLabel(start)}`;

                  return (
                    <div
                      key={live.id}
                      onClick={() => setSelected(live)}
                      className={`relative w-60 flex-shrink-0 aspect-video rounded-lg overflow-hidden cursor-pointer ${
                        isLive ? 'border-2 border-red-500' : ''
                      }`}
                    >
                      {loadingUsers || !avatarUrl ? (
                        <Skeleton className="w-full h-full" />
                      ) : (
                        <img src={avatarUrl} alt={live.title} className="w-full h-full object-cover" />
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                        {isLive ? (
                          <span className="inline-block px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold">
                            配信中！
                          </span>
                        ) : (
                          <p className="text-[11px] text-white">{startLabel}</p>
                        )}
                        <h3 className="font-bold text-sm text-white mt-1 truncate whitespace-nowrap overflow-hidden">
                          {live.title}
                        </h3>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* モバイル：3件以下はカードUI、4件以上は丸アイコンUI */}
              {dayLives.length <= MOBILE_CARD_THRESHOLD ? (
                <div className="grid grid-cols-1 gap-3 md:hidden">
                  {dayLives.map((live) => {
                    const start = toDate(live.startTime);
                    const end = toDate(live.endTime);
                    const now = new Date();
                    const isLive = now >= start && now <= end;

                    const firstUid = live.streamers[0];
                    const mini = firstUid ? users[firstUid] : undefined;
                    const avatarUrl = mini?.avatarUrl || '';
                    const startLabel = `${start.getMonth() + 1}/${start.getDate()} ${timeLabel(start)}`;

                    return (
                      <button
                        key={live.id}
                        onClick={() => setSelected(live)}
                        className={`relative w-full aspect-video rounded-lg overflow-hidden md:hidden ${
                          isLive ? 'border-2 border-red-500' : ''
                        }`}
                      >
                        {loadingUsers || !avatarUrl ? (
                          <Skeleton className="w-full h-full" />
                        ) : (
                          <img src={avatarUrl} alt={live.title} className="w-full h-full object-cover" />
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-left">
                          {isLive ? (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold">
                              配信中！
                            </span>
                          ) : (
                            <p className="text-[11px] text-white">{startLabel}</p>
                          )}
                          <h3 className="font-bold text-sm text-white mt-1 truncate">{live.title}</h3>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex md:hidden gap-[12px] overflow-x-auto py-1 scrollbar-hide">
                  {dayLives.map((live) => {
                    const start = toDate(live.startTime);
                    const end = toDate(live.endTime);
                    const now = new Date();
                    const isLive = now >= start && now <= end;

                    const firstUid = live.streamers[0];
                    const mini = firstUid ? users[firstUid] : undefined;
                    const avatarUrl = mini?.avatarUrl || '';
                    const displayName = mini?.displayName || '配信者';
                    const startLabel = `${start.getMonth() + 1}/${start.getDate()} ${timeLabel(start)}`;

                    return (
                      <div key={live.id} className="flex flex-col items-center text-center flex-shrink-0">
                        <button onClick={() => setSelected(live)} className="relative block w-16 h-16">
                          {loadingUsers || !avatarUrl ? (
                            <Skeleton className="w-16 h-16 rounded-full" />
                          ) : (
                            <div
                              className={`w-16 h-16 rounded-full p-[3px] ${
                                isLive
                                  ? 'bg-gradient-to-br from-[#FF6B6B] via-[#FF4757] to-[#FF8E8E]'
                                  : 'bg-gray-300'
                              }`}
                            >
                              <img src={avatarUrl} alt={displayName} className="w-full h-full rounded-full object-cover" />
                            </div>
                          )}
                          {isLive && !loadingUsers && (
                            <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[10px] font-bold text-white rounded-md border border-white bg-gradient-to-b from-[#FF6B6B] via-[#FF4757] to-[#FF8E8E]">
                              LIVE
                            </span>
                          )}
                        </button>

                        <div className="mt-2 text-[12px] font-medium text-gray-900 truncate w-[72px]">
                          {loadingUsers ? <Skeleton className="h-3 w-full rounded" /> : displayName}
                        </div>
                        <p className="mt-1 text-[11px] text-gray-700">
                          {loadingUsers ? <Skeleton className="h-3 w-14 rounded" /> : startLabel}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })
      )}

      {/* === 最下部：ライブ通知の案内 & CTA ===
      <section className="mt-8 bg-white rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] p-4 md:p-6">
        <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
          <Bell className="w-5 h-5" />
          ライブ通知をONにする！
        </h3>
        <p className="text-sm text-gray-700 mb-4">
          通知をONにしておくと、<strong>ゲリラ配信</strong>も見逃さずに
          <strong>メールでお知らせ</strong>します。
        </p>

        {user ? (
          <div className="flex items-center gap-3">
            <Button
              onClick={() => setNotifOn((v) => !v)}
              className={`rounded-full ${notifOn ? '' : ''}`}
              variant={notifOn ? 'default' : 'outline'}
            >
              {notifOn ? '通知がONです！' : '通知をONにする'}
            </Button>
            <span className="text-sm text-gray-600">
              {notifOn
                ? '通知をONにしました。今後は配信開始をメールでお知らせします（モック）。'
                : 'ワンタップで設定できます（現在モック動作）。'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <Button asChild className="rounded-full">
              <Link href="/login">ログインして通知をONにする</Link>
            </Button>
            <span className="text-sm text-gray-600">
              ログイン後に通知を有効化できます！
            </span>
          </div>
        )}
      </section> */}

      {selected && <LiveBottomSheet live={selected} onClose={() => setSelected(null)} />}
    </main>
  );
}
