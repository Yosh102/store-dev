"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { getPostsByCategory, resolveImageUrl } from "@/services/post-service"
import type { Post } from "@/services/post-service"

interface CategorySelectionProps {
  category: string
  limit?: number
  className?: string
}

export default function CategorySelection({ category, limit: postLimit = 10, className }: CategorySelectionProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const fetchedPosts = await getPostsByCategory(category, postLimit);
        setPosts(fetchedPosts)
      } catch (error) {
        console.error("Error fetching posts:", error)
        setPosts([])
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [category, postLimit])

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <Skeleton className="h-8 w-32" />
        <div className="flex overflow-x-auto space-x-4 pb-4">
          {Array(postLimit)
            .fill(null)
            .map((_, index) => (
              <div key={index} className="flex-none w-64">
                <Skeleton className="w-64 h-40 rounded-lg mb-2" />
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      {posts && posts.length > 0 ? (
        <div className="flex overflow-x-auto space-x-4 pb-4">
          {posts.map((post) => (
            <Link key={post.id} href={`/post/${post.id}`} className="flex-none group">
              <div className="w-64 space-y-2">
                <div className="relative w-64 h-40 rounded-lg overflow-hidden">
                  <Image
                    src={resolveImageUrl(post.thumbnailUrl)}
                    alt={post.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <h3 className="font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">{post.title}</h3>
                <time className="text-sm text-gray-500">
                  {post.publishDate && format(post.publishDate.toDate(), "yyyy.MM.dd")}
                </time>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">Coming soon...</div>
      )}
    </div>
  )
}