"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { useAuth } from "@/context/auth-context"
import { getAuth } from "firebase/auth"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Lock } from "lucide-react"

const POSTS_PER_PAGE = 10

interface PostListItem {
  id: string
  title: string
  publishDate: string
  membersOnly: boolean
  groupName: string
  canView: boolean
  isPublished: boolean
}

export default function PostsClient() {
  const { user } = useAuth()
  const [posts, setPosts] = useState<PostListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchPosts(currentPage)
  }, [currentPage])

  const fetchPosts = async (page: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        type: "list",
        limit: POSTS_PER_PAGE.toString(),
        page: page.toString(),
      })

      // Firebase Authから直接トークンを取得
      const auth = getAuth()
      const token = await auth.currentUser?.getIdToken()
      
      const headers: HeadersInit = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const response = await fetch(`/api/posts?${params}`, { headers })
      const data = await response.json()

      if (data.success) {
        setPosts(data.posts)
        setTotalPages(Math.ceil(data.total / POSTS_PER_PAGE))
      }
    } catch (error) {
      console.error("Error fetching posts:", error)
    } finally {
      setLoading(false)
    }
  }

  const handlePageChange = (page: number) => {
    if (page === currentPage || page < 1 || page > totalPages) return
    setCurrentPage(page)
  }

  const isNewPost = (dateString: string) => {
    const now = new Date()
    const postDate = new Date(dateString)
    const diffTime = Math.abs(now.getTime() - postDate.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays <= 7
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">UPDATE</h1>
      <div className="space-y-6">
        {posts.map((post) => (
          <Link key={post.id} href={`/post/${post.id}`} className="block group">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                {isNewPost(post.publishDate) && (
                  <span className="text-red-500 text-sm font-medium mt-1">new</span>
                )}
                <div className="flex-1">
                  <h2 className="text-lg group-hover:text-gray-600 transition-colors">
                    {post.membersOnly && post.groupName && (
                      <span className="inline-flex items-center mr-2 text-gray-700">
                        <Lock className="w-4 h-4 mr-1" />[{post.groupName}メンバーシップ限定]
                      </span>
                    )}
                    {post.title}
                  </h2>
                  <time className="text-gray-500 text-sm">
                    {format(new Date(post.publishDate), "yyyy.MM.dd")}
                  </time>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage > 1) handlePageChange(currentPage - 1)
                  }}
                />
              </PaginationItem>
              {[...Array(totalPages)].map((_, i) => (
                <PaginationItem key={i + 1}>
                  <PaginationLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      handlePageChange(i + 1)
                    }}
                    isActive={currentPage === i + 1}
                  >
                    {i + 1}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    if (currentPage < totalPages) handlePageChange(currentPage + 1)
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </div>
  )
}