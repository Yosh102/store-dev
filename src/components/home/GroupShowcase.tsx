// components/home/GroupReleasesShowcase.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ExternalLink, Play, ChevronRight, Music } from 'lucide-react'
import { collection, getDocs, limit as fsLimit, orderBy, query, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import SubscriptionPanel from '@/components/store/SubscriptionPanel'

type FireTs = { seconds: number; nanoseconds?: number; toDate?: () => Date }
type DiscographyItem = {
  id: string
  title: string
  groupId: string
  thumbnailUrl?: string
  musicUrl: string
  releaseDate?: FireTs | Date | { seconds: number } | number | string
  type?: 'single' | 'album' | 'ep' | 'compilation' | string
  isActive?: boolean
}
type Group = {
  id: string
  name: string
  slug: string
  coverImage?: string
  subscriptionJoinUrl?: string
  subscriptionPlans?: any
}

const toDate = (v: any): Date | null => {
  if (!v) return null
  if (v instanceof Date) return v
  if (typeof v?.toDate === 'function') return v.toDate()
  if (typeof v === 'number') return new Date(v * 1000)
  if (typeof v?.seconds === 'number') return new Date(v.seconds * 1000)
  if (typeof v === 'string') {
    const d = new Date(v)
    return isNaN(d.getTime()) ? null : d
  }
  return null
}
const formatDateYMD = (v: any): string => {
  const d = toDate(v)
  if (!d) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}.${m}.${da}`
}
const resolveImageUrl = (u?: string) => {
  if (!u) return '/placeholder.svg'
  if (/^https?:\/\//.test(u)) return u
  return u.startsWith('/') ? u : `/${u}`
}

export default function GroupReleasesShowcase({
  title = 'PLAY TUNE所属グループ',
  description = 'ユニットの最新リリースを一目でチェック！',
  groupLimit = 6,
  releasesPerGroup = 5,
}: {
  title?: string
  description?: string
  groupLimit?: number
  releasesPerGroup?: number
}) {
  const [groups, setGroups] = useState<Group[]>([])
  const [releases, setReleases] = useState<Record<string, DiscographyItem[]>>({})
  const [loading, setLoading] = useState(true)
  const [subModalGroup, setSubModalGroup] = useState<Group | null>(null)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const gRef = collection(db, 'groups')
        const gSnap = await getDocs(gRef)
        const g = gSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as Group[]
        const limitedGroups = g.slice(0, groupLimit)

        const dRef = collection(db, 'discography')
        const dQ = query(dRef, where('isActive', '==', true), orderBy('releaseDate', 'desc'), fsLimit(200))
        const dSnap = await getDocs(dQ)
        const all = dSnap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as DiscographyItem[]

        const byGroup: Record<string, DiscographyItem[]> = {}
        for (const gi of limitedGroups) {
          const list = all
            .filter(x => x.groupId === gi.id)
            .sort((a, b) => {
              const ad = toDate(a.releaseDate)?.getTime() ?? 0
              const bd = toDate(b.releaseDate)?.getTime() ?? 0
              return bd - ad
            })
            .slice(0, releasesPerGroup)
          byGroup[gi.id] = list
        }

        setGroups(limitedGroups)
        setReleases(byGroup)
      } catch (e) {
        console.error(e)
        setGroups([])
        setReleases({})
      } finally {
        setLoading(false)
      }
    })()
  }, [groupLimit, releasesPerGroup])

  const single = useMemo(() => (groups.length === 1 ? groups[0] : null), [groups])

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="bg-white rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] overflow-hidden">
          {/* ローディング時はヘッダー表示（複数想定） */}
          <Header title={title} description={description} showAllLink />
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-2xl p-4 ring-1 ring-black/5">
                  <Skeleton className="aspect-square rounded-xl mb-4" />
                  <Skeleton className="h-5 w-48 mb-2" />
                  {Array.from({ length: 4 }).map((_, j) => (
                    <div key={j} className="flex items-center gap-3 py-2">
                      <Skeleton className="w-12 h-12 rounded-md" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-40 mb-1" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (groups.length === 0) return null

  return (
    <section className="space-y-6">
      <div className="bg-white rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] overflow-hidden">
        {/* 1組の時はヘッダーを非表示にする */}
        {!single && <Header title={title} description={description} showAllLink />}

        {single ? (
          // ====== 単一グループ（上下中央）======
          <div className="p-4 md:p-8">
            <div className="grid md:grid-cols-12 gap-8 items-center"> {/* items-center に変更 */}
              {/* 左：アー写 1:1 */}
              <div className="md:col-span-5">
                <div className="relative aspect-square w-full rounded-2xl overflow-hidden ring-1 ring-black/5">
                  <Image
                    src={resolveImageUrl(single.coverImage)}
                    alt={`${single.name} artist photo`}
                    fill
                    className="object-cover"
                    priority
                  />
                </div>
              </div>

              {/* 右：名前/ボタン/リリース */}
              <div className="md:col-span-7">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                  <h2 className="text-2xl md:text-3xl font-extrabold">{single.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/group/${single.slug}`}
                      className="inline-flex items-center rounded-full px-5 py-2 bg-black text-white text-sm font-semibold hover:opacity-90 transition"
                    >
                      {single.name} 公式ページへ
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Link>

                    {single.subscriptionJoinUrl && (
                      <a
                        href={single.subscriptionJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-full px-5 py-2 border border-black text-black text-sm font-semibold hover:bg-black hover:text-white transition"
                      >
                        メンバーシップ参加URL
                        <ExternalLink className="w-4 h-4 ml-2" />
                      </a>
                    )}

                    {single.subscriptionPlans && (
                      <Button
                        className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 text-white hover:from-emerald-600 hover:to-sky-600"
                        onClick={() => setSubModalGroup(single)}
                      >
                        メンバーシップに参加
                      </Button>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-bold mb-2">リリース一覧</h3>
                <ReleaseList items={releases[single.id] || []} />
              </div>
            </div>
          </div>
        ) : (
          // ====== 複数グループ（Showcaseグリッド）======
          <div className="p-4 md:p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {groups.map(g => (
                <div key={g.id} className="rounded-2xl ring-1 ring-black/5 p-4">
                  <div className="relative aspect-square rounded-xl overflow-hidden mb-4">
                    <Image
                      src={resolveImageUrl(g.coverImage)}
                      alt={`${g.name} artist photo`}
                      fill
                      className="object-cover"
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="text-xl font-extrabold">{g.name}</h3>
                    <Link
                      href={`/group/${g.slug}`}
                      className="inline-flex items-center rounded-full px-3 py-1.5 bg-black text-white text-xs font-semibold hover:opacity-90 transition whitespace-nowrap"
                    >
                      公式ページへ
                      <ExternalLink className="w-4 h-4 ml-1" />
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    {g.subscriptionJoinUrl && (
                      <a
                        href={g.subscriptionJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center rounded-full px-3 py-1.5 border border-black text-black text-xs font-semibold hover:bg-black hover:text-white transition"
                      >
                        メンバーシップ参加URL
                        <ExternalLink className="w-4 h-4 ml-1" />
                      </a>
                    )}
                    {g.subscriptionPlans && (
                      <Button
                        size="sm"
                        className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 text-white hover:from-emerald-600 hover:to-sky-600"
                        onClick={() => setSubModalGroup(g)}
                      >
                        メンバーシップに参加
                      </Button>
                    )}
                  </div>

                  <h4 className="text-sm font-bold mb-2">リリース一覧</h4>
                  <ReleaseList items={releases[g.id] || []} compact />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {subModalGroup && (
        <SubscriptionPanel group={subModalGroup as any} onClose={() => setSubModalGroup(null)} />
      )}
    </section>
  )
}

function Header({ title, description, showAllLink = false }: { title: string; description: string; showAllLink?: boolean }) {
  return (
    <div className="relative">
      <div className="relative z-10 flex flex-col md:flex-row md:items-start justify-between gap-4 md:gap-6 p-6 md:p-8">
        <div className="min-w-0">
          <h2 className="text-2xl md:text-3xl font-extrabold text-black">{title}</h2>
          <p className="mt-1 text-sm md:text-base text-black">{description}</p>
        </div>
        {showAllLink && (
          <Link
            href="/groups"
            className="relative inline-flex items-center rounded-full px-5 py-2 bg-white text-black text-xs md:text-sm font-semibold text-left hover:opacity-90 transition shrink-0"
          >
            <span className="pr-5 whitespace-nowrap">すべて見る</span>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
          </Link>
        )}
      </div>
    </div>
  )
}

function ReleaseList({ items, compact = false }: { items: DiscographyItem[]; compact?: boolean }) {
  if (!items || items.length === 0) {
    return (
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <Music className="w-4 h-4" /> リリースがありません
      </div>
    )
  }

  return (
    <div className="divide-y divide-gray-100 rounded-xl overflow-hidden">
      {items.map((it) => (
        <a
          key={it.id}
          href={it.musicUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 md:gap-4 px-3 md:px-4 py-2 md:py-3 bg-white hover:bg-gray-50 transition group"
        >
          {/* ジャケ写（Spotify風） */}
          <div className={`relative ${compact ? 'w-12 h-12' : 'w-14 h-14'} flex-shrink-0 rounded-md overflow-hidden ring-1 ring-black/5`}>
            <Image
              src={resolveImageUrl(it.thumbnailUrl)}
              alt={`${it.title} artwork`}
              fill
              className="object-cover"
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className={`truncate font-medium ${compact ? 'text-sm' : 'text-base'}`}>{it.title}</p>
              {it.type && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                  {it.type.toUpperCase()}
                </span>
              )}
            </div>
            {/* 日付は“日付のみ” */}
            <p className="text-xs text-gray-500 mt-0.5">{formatDateYMD(it.releaseDate)}</p>
          </div>

          <div className="opacity-0 group-hover:opacity-100 transition">
            <Play className="w-4 h-4 text-gray-600" />
          </div>
        </a>
      ))}
    </div>
  )
}
