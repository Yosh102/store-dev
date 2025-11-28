"use client"

import React, { useEffect, useState } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { collection, query, where, getDocs, orderBy, doc, getDoc, limit, startAfter } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Post } from "@/types/post"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock, CalendarIcon, ChevronLeft, ChevronRight, ArrowUpDown } from "lucide-react"
import { format } from "date-fns"
import { useAuth } from "@/context/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import Image from "next/image"
import Link from "next/link"
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue
} from "@/components/ui/select"
import { 
  Pagination, 
  PaginationContent, 
  PaginationEllipsis, 
  PaginationItem, 
  PaginationLink, 
  PaginationNext, 
  PaginationPrevious 
} from "@/components/ui/pagination"

// Helper function to handle image URLs
const resolveImageUrl = (imageUrl: string | undefined): string => {
  if (!imageUrl) return "/placeholder.svg";
  
  // If it's a Firebase Storage URL, use it directly
  if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('firebasestorage.googleapis.com')) {
    return imageUrl;
  }
  
  // If it starts with a slash, it's a local path
  if (imageUrl.startsWith('/')) {
    return imageUrl;
  }
  
  // Otherwise, add a slash prefix
  return `/${imageUrl}`;
}

// 1ページあたりの投稿数
const POSTS_PER_PAGE = 9;

export default function GroupMemberOnlyPosts() {
  const { slug } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [groupInfo, setGroupInfo] = useState<{id: string, name: string, backgroundColor?: string, textColor?: string, backgroundGradient?: string} | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  
  // ページネーション用の状態
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalPosts, setTotalPosts] = useState(0)
  
  // 並べ替え用の状態
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // URLからページとソート順を取得
  useEffect(() => {
    const page = searchParams.get('page')
    const sort = searchParams.get('sort')
    
    if (page) {
      setCurrentPage(parseInt(page))
    }
    
    if (sort === 'asc' || sort === 'desc') {
      setSortOrder(sort)
    }
  }, [searchParams])

  // URL更新用関数
  const updateUrl = (page: number, sort: 'asc' | 'desc') => {
    const params = new URLSearchParams(searchParams)
    params.set('page', page.toString())
    params.set('sort', sort)
    router.push(`/group/${slug}/posts?${params.toString()}`)
  }

  // ソート順変更時の処理
  const handleSortChange = (value: string) => {
    const newSort = value as 'asc' | 'desc'
    setSortOrder(newSort)
    updateUrl(1, newSort) // ソート変更時は1ページ目に戻る
  }

  // ページ変更時の処理
  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    updateUrl(page, sortOrder)
  }

  useEffect(() => {
    const fetchGroupInfo = async () => {
      if (!slug) return;
      
      try {
        // まずslugからグループIDを取得
        const groupsQuery = query(
          collection(db, "groups"),
          where("slug", "==", slug)
        );
        
        const groupSnapshot = await getDocs(groupsQuery);
        
        if (groupSnapshot.empty) {
          console.error("Group not found");
          setLoading(false);
          return;
        }
        
        const groupDoc = groupSnapshot.docs[0];
        const groupId = groupDoc.id;
        const groupData = groupDoc.data();
        
        setGroupInfo({
          id: groupId,
          name: groupData.name,
          backgroundColor: groupData.backgroundColor || undefined,
          textColor: groupData.textColor || undefined,
          backgroundGradient: groupData.backgroundGradient || undefined
        });
        
        // ユーザーがグループにアクセスできるか確認
        if (user) {
          if (user.role === "admin" || user.role === "artist") {
            setHasAccess(true);
          } else if (user.subscriptions && user.subscriptions[groupId] && user.subscriptions[groupId].status === "active") {
            setHasAccess(true);
          }
        }
        
        // アクセス権がない場合は何も表示しない
        if (!hasAccess) {
          setPosts([]);
          setTotalPosts(0);
          setTotalPages(0);
          setLoading(false);
          return;
        }
        
        // メンバーシップ限定記事の数を取得するためのクエリ
        const countQuery = query(
          collection(db, "posts"),
          where("groups", "array-contains", groupId),
          where("status", "==", "published"),
          where("membersOnly", "==", true)
        );
        
        const countSnapshot = await getDocs(countQuery);
        const total = countSnapshot.size;
        setTotalPosts(total);
        setTotalPages(Math.ceil(total / POSTS_PER_PAGE));
        
        // ページネーションされたメンバーシップ限定記事を取得
        const postsQuery = query(
          collection(db, "posts"),
          where("groups", "array-contains", groupId),
          where("status", "==", "published"),
          where("membersOnly", "==", true),
          orderBy("publishDate", sortOrder),
          limit(POSTS_PER_PAGE * currentPage) // 簡易実装: 現在のページまでの全データを取得
        );
        
        const postsSnapshot = await getDocs(postsQuery);
        
        // 現在のページの投稿のみを表示
        const allPosts = postsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Post[];
        
        // 現在のページのデータだけを抽出
        const startIndex = (currentPage - 1) * POSTS_PER_PAGE;
        const paginatedPosts = allPosts.slice(startIndex, startIndex + POSTS_PER_PAGE);
        
        setPosts(paginatedPosts);
      } catch (error) {
        console.error("Error fetching group posts:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchGroupInfo();
  }, [slug, user, hasAccess, currentPage, sortOrder]);

  // スタイルを適用
  const containerStyle = groupInfo ? {
    backgroundColor: groupInfo.backgroundColor || undefined,
    color: groupInfo.textColor || undefined,
    backgroundImage: groupInfo.backgroundGradient || undefined,
  } : {};

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col space-y-4">
          <Skeleton className="h-12 w-3/4" />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-[300px] w-full rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!groupInfo) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert>
          <AlertDescription>グループが見つかりませんでした。</AlertDescription>
        </Alert>
      </div>
    );
  }

  // アクセス権がない場合
  if (!hasAccess) {
    return (
      <div className="min-h-screen pt-16 mt-8" style={containerStyle}>
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 space-y-2">
            <h1 className="text-3xl font-bold">{groupInfo.name}の限定記事</h1>
            <p className="text-gray-600">
              この記事はメンバーシップに登録している方のみがご覧いただけます。
            </p>
            
            <Button 
              onClick={() => router.push(`/group/${slug}`)}
              className={cn(
                "mt-4 bg-gradient-to-r from-emerald-500 to-sky-500 text-white",
                "hover:from-emerald-600 hover:to-sky-600 rounded-full",
              )}
            >
              メンバーシップに登録する
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={containerStyle}>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-bold">{groupInfo.name}のメンバー限定記事</h1>
          <p className="text-gray-600">
            メンバーシップに登録しているあなただけが閲覧できる特別なコンテンツです
          </p>
        </div>
        
        {/* 並び替えオプション */}
        <div className="flex justify-between items-center mb-6">
          <div className="text-sm text-gray-500">
            全 {totalPosts} 件中 {totalPosts > 0 ? (currentPage - 1) * POSTS_PER_PAGE + 1 : 0} - {Math.min(currentPage * POSTS_PER_PAGE, totalPosts)} 件を表示
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">並び替え:</span>
            <Select value={sortOrder} onValueChange={handleSortChange}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="並び替え" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">新しい順</SelectItem>
                <SelectItem value="asc">古い順</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {posts.length === 0 ? (
          <Alert>
            <AlertDescription>限定記事がまだありません。</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <Link key={post.id} href={`/post/${post.id}`} className="block group">
                  <div className="rounded-lg overflow-hidden shadow hover:shadow-md transition-shadow">
                    <div className="relative aspect-video overflow-hidden">
                      <Image
                        src={resolveImageUrl(post.thumbnailUrl)}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <div className="p-4">
                      <h4 className="font-medium line-clamp-2 group-hover:text-blue-600 transition-colors mb-2">
                        {post.title}
                      </h4>
                      <div className="flex justify-between items-center">
                        <time className="text-sm text-gray-500" dateTime={post.publishDate.toDate().toISOString()}>
                          {format(post.publishDate.toDate(), "yyyy.MM.dd")}
                        </time>
                        <Badge className="bg-gradient-to-r from-emerald-500 to-sky-500">
                          <Lock className="h-3 w-3 mr-1" />
                          限定
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            
            {/* ページネーション */}
            {totalPages > 1 && (
              <Pagination className="mt-8">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) handlePageChange(currentPage - 1);
                      }} 
                      className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                  
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    // 表示するページ番号を計算
                    let pageNum;
                    if (totalPages <= 5) {
                      // 5ページ以下の場合は全て表示
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      // 現在のページが前半の場合
                      pageNum = i + 1;
                      if (i === 4) return (
                        <PaginationItem key={i}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    } else if (currentPage >= totalPages - 2) {
                      // 現在のページが後半の場合
                      pageNum = totalPages - 4 + i;
                      if (i === 0) return (
                        <PaginationItem key={i}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    } else {
                      // 現在のページが中央の場合
                      pageNum = currentPage - 2 + i;
                      if (i === 0) return (
                        <PaginationItem key={i}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                      if (i === 4) return (
                        <PaginationItem key={i}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      );
                    }
                    
                    return (
                      <PaginationItem key={i}>
                        <PaginationLink 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            handlePageChange(pageNum);
                          }}
                          isActive={currentPage === pageNum}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}
                  
                  <PaginationItem>
                    <PaginationNext 
                      href="#" 
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) handlePageChange(currentPage + 1);
                      }}
                      className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            )}
          </>
        )}
      </div>
    </div>
  );
}