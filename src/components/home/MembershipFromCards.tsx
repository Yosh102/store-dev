'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Lock, ChevronRight } from 'lucide-react';
import type { Group } from '@/types/group';

interface Post {
  id: string;
  title: string;
  content?: string;
  excerpt?: string;
  thumbnailUrl?: string;
  groups: string[];
  groupName?: string;
  groupSlug?: string;
  membersOnly: boolean;
  publishDate?: string;
  canView?: boolean;
  authorName?: string;
  authorImage?: string;
}

interface GroupWithPosts {
  group: Group;
  posts: Post[];
}

export default function MembershipFromCards() {
  const [groupsWithPosts, setGroupsWithPosts] = useState<GroupWithPosts[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        // グループとポストを並行取得
        const [groupsRes, postsRes] = await Promise.all([
          fetch('/api/groups', { cache: 'no-store' }),
          fetch('/api/posts', { cache: 'no-store' })
        ]);

        if (!groupsRes.ok || !postsRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const groupsData = await groupsRes.json();
        const postsData = await postsRes.json();

        if (mounted) {
          const groups = Array.isArray(groupsData.groups) ? groupsData.groups : [];
          const allPosts = Array.isArray(postsData.posts) ? postsData.posts : [];

          // メンバーシップ限定記事のみ
          const membershipPosts = allPosts.filter((post: Post) => post.membersOnly);

          // グループごとに記事を整理
          const groupedData: GroupWithPosts[] = groups
            .map((group: Group) => {
              const posts = membershipPosts
                .filter((post: Post) =>
                  Array.isArray(post.groups) && post.groups.includes(group.id)
                )
                .sort((a: Post, b: Post) => {
                  const aDate = a.publishDate || '';
                  const bDate = b.publishDate || '';
                  return new Date(bDate).getTime() - new Date(aDate).getTime();
                })
                .slice(0, 3); // 各グループ最新3件

              return { group, posts };
            })
            .filter((item: GroupWithPosts) => item.posts.length > 0); // 記事があるグループのみ

          setGroupsWithPosts(groupedData);
        }
      } catch (e) {
        console.error('Error fetching data:', e);
        if (mounted) setGroupsWithPosts([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-full" />
                <Skeleton className="h-6 w-32" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              {Array.from({ length: 3 }).map((_, j) => (
                <div key={j} className="space-y-3">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (groupsWithPosts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {groupsWithPosts.map(({ group, posts }: GroupWithPosts) => (
        <div
          key={group.id}
          className="bg-white rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] p-4 md:p-6"
        >
          {/* ヘッダー: From XXX */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {group.logoUrl && (
                <div className="relative w-12 h-12 p-2 rounded-full overflow-hidden flex-shrink-0 bg-black">
                  <Image
                    src={group.logoUrl}
                    alt={group.name}
                    fill
                    className="object-cover"
                  />
                </div>
              )}
              <h2 className="text-lg font-bold text-gray-900">
                From {group.name}
              </h2>
            </div>
          </div>

          {/* 記事リスト - レスポンシブグリッド */}
          <div className="grid grid-cols-1 md:grid-cols-3">
            {posts.map((post: Post, index: number) => (
              <Link
                key={post.id}
                href={`/post/${post.id}`}
                className={`block px-5 py-5 hover:bg-gray-50 transition-colors group ${
                  index > 0 ? 'hidden md:block' : '' // スマホでは1件目のみ表示
                }`}
              >
                <div className="space-y-3">
                  {/* 投稿者情報 */}
                  {post.authorName && (
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      {post.authorImage && (
                        <div className="relative w-5 h-5 rounded-full overflow-hidden flex-shrink-0">
                          <Image
                            src={post.authorImage}
                            alt={post.authorName}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <span className="font-medium text-gray-900">{post.authorName}</span>
                      <span className="text-gray-400">•</span>
                      {post.publishDate && (
                        <span className="text-gray-500">
                          {new Date(post.publishDate).toLocaleDateString('ja-JP', {
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      )}
                      {post.membersOnly && (
                        <>
                          <span className="text-gray-400">•</span>
                          <Lock className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                        </>
                      )}
                    </div>
                  )}

                  {/* タイトル */}
                  <h3 className="font-medium text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {post.title}
                  </h3>

                  {/* プレビューテキスト - APIから返された100文字プレビューを使用 */}
                  <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed whitespace-pre-wrap">
                    {post.excerpt || post.content || ''}
                  </p>

                  {/* サムネイル（ある場合） */}
                  {post.thumbnailUrl && (
                    <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-gray-100">
                      <Image
                        src={post.thumbnailUrl}
                        alt={post.title}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                </div>
              </Link>
            ))}
                              </div>

            <div className="mt-4">
              <Link
                href={`/group/${group.slug}/posts`}
                className="w-full block text-center rounded-full border border-gray-300 bg-white px-4 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                もっと見る
              </Link>
            </div>
        </div>
      ))}
    </div>
  );
}