"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Group {
  id: string
  name: string
  slug: string
  coverImage: string
  description?: string
  members?: string[]
}

interface GroupListProps {
  className?: string
}

// Helper function to resolve image URLs
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

export default function GroupList({ className }: GroupListProps) {
  const [groups, setGroups] = useState<Group[]>([])
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const groupsRef = collection(db, "groups")
        // 公開されているグループのみを取得するように絞り込む場合は
        // where("isPublic", "==", true) を追加することも可能
        const q = query(groupsRef, orderBy("name"), limit(11))
        const querySnapshot = await getDocs(q)
        
        const fetchedGroups = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // 表示に必要な情報のみを取得
          return {
            id: doc.id,
            name: data.name,
            slug: data.slug,
            coverImage: data.coverImage,
            description: data.description || "詳細情報はこちらをご覧ください。",
            // 必要に応じてメンバー数などを表示する場合
            members: data.members || [],
          } as Group;
        });
        
        setGroups(fetchedGroups)
        setFilteredGroups(fetchedGroups)
      } catch (error) {
        console.error("Error fetching groups:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchGroups()
  }, [])

  // 検索機能
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredGroups(groups)
    } else {
      const filtered = groups.filter(group => 
        group.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
      setFilteredGroups(filtered)
    }
  }, [searchQuery, groups])

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="mb-4 w-full px-4">
          <div className="relative w-full">
            <Search className="absolute left-7 pr-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <Input
              className="pl-12 pm-3 w-full"
              placeholder="グループ名..."
              value=""
              disabled
            />
          </div>
        </div>
        <div className="flex overflow-x-auto space-x-4 pb-4 px-4">
          {Array(10)
            .fill(null)
            .map((_, index) => (
              <div key={index} className="flex-none group">
                <div className="w-40 space-y-2">
                  <Skeleton className="w-40 h-40 rounded-lg" />
                  <Skeleton className="h-4 w-3/4 mx-auto" />
                </div>
              </div>
            ))}
        </div>
      </div>
    )
  }

  const displayGroups = filteredGroups.slice(0, 10)
  const hasMoreGroups = filteredGroups.length > 10

  return (
    <div className={cn("space-y-4", className)}>
      <div className="mb-4 w-full px-4">
        <div className="relative w-full">
          <Search className="absolute left-7 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <Input
            className="pl-12 w-full"
            placeholder="グループを検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
              <div className="flex overflow-x-auto space-x-4 pb-4 px-4">
        {displayGroups.map((group) => (
          <Link key={group.id} href={`/group/${group.slug}`} className="flex-none group">
            <div className="w-40 space-y-2">
              <div className="relative w-40 h-40 rounded-lg overflow-hidden">
                <Image
                  src={resolveImageUrl(group.coverImage)}
                  alt={group.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <h3 className="text-center font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">
                {group.name}
              </h3>
            </div>
          </Link>
        ))}
        {hasMoreGroups && (
          <Link href="/groups" className="flex-none group">
            <div className="w-40 h-40 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
              <div className="text-center">
                <ChevronRight className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">一覧へ</span>
              </div>
            </div>
          </Link>
        )}
      </div>
      
      {filteredGroups.length === 0 && (
        <div className="text-center py-8">
          <p className="text-gray-500">検索条件に一致するグループが見つかりませんでした。</p>
        </div>
      )}
    </div>
  )
}