"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import { ChevronRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/auth-context"

interface Product {
  id: string
  name: string
  images: string[]
  price: number
  createdAt: any
  category: string
  description: string
  groups: string[]
  isMembersOnly: boolean
}

interface FeaturedProductsProps {
  className?: string
  category?: string
  limit?: number
}

export default function FeaturedProducts({ className, category, limit: productLimit = 10 }: FeaturedProductsProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const productsRef = collection(db, "products")
        let q = query(productsRef, orderBy("createdAt", "desc"), limit(productLimit + 1))

        if (category) {
          q = query(q, where("category", "==", category))
        }

        const querySnapshot = await getDocs(q)
        const fetchedProducts = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Product[]
        setProducts(fetchedProducts)
      } catch (error) {
        console.error("Error fetching products:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchProducts()
  }, [category, productLimit])

  if (loading) {
    return (
      <div className={cn("space-y-4", className)}>
        <div className="flex overflow-x-auto space-x-4 pb-4">
          {Array(productLimit)
            .fill(null)
            .map((_, index) => (
              <div key={index} className="flex-none w-40">
                <Skeleton className="w-40 h-40 rounded-lg mb-2" />
                <Skeleton className="h-4 w-3/4 mx-auto mb-1" />
                <Skeleton className="h-4 w-1/2 mx-auto" />
              </div>
            ))}
        </div>
      </div>
    )
  }

  const displayProducts = products.slice(0, productLimit)
  const hasMoreProducts = products.length > productLimit

  if (displayProducts.length === 0) {
    return (
      <div className={cn("space-y-4", className)}>
        <p className="text-center text-gray-500 py-8">Coming soon...</p>
      </div>
    )
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex overflow-x-auto space-x-4 pb-4">
        {displayProducts.map((product) => (
          <Link key={product.id} href={`/product/${product.id}`} className="flex-none group">
            <div className="w-40 space-y-2">
              <div className="relative w-40 h-40 rounded-lg overflow-hidden">
                <Image
                  src={product.images[0] || "/placeholder.svg"}
                  alt={product.name}
                  fill
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                {product.isMembersOnly && (
                  <Badge className="absolute top-2 right-2 bg-blue-500 text-white">FC限定</Badge>
                )}
              </div>
              <h3 className="text-center font-medium line-clamp-2 group-hover:text-blue-600 transition-colors">
                {product.name}
              </h3>
              <p className="text-center text-sm text-gray-600">¥{product.price.toLocaleString()}</p>
            </div>
          </Link>
        ))}
        {hasMoreProducts && (
          <Link
            href={category ? `/store?category=${encodeURIComponent(category)}` : "/store"}
            className="flex-none group"
          >
            <div className="w-40 h-40 rounded-lg bg-gray-100 flex items-center justify-center group-hover:bg-gray-200 transition-colors">
              <div className="text-center">
                <ChevronRight className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">一覧へ</span>
              </div>
            </div>
          </Link>
        )}
      </div>
    </div>
  )
}

