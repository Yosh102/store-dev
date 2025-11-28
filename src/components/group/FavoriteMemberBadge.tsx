"use client"

import Image from "next/image"
import { Heart } from "lucide-react"
import { type FavoriteMember } from "@/types/user"
import { useEffect, useState } from "react"

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

// 日数を計算する関数
const calculateDaysSince = (timestamp: any): number => {
  if (!timestamp) return 0;
  
  try {
    // Firestoreのタイムスタンプからミリ秒に変換
    const selectedDate = timestamp.toDate ? timestamp.toDate() : new Date(timestamp.seconds * 1000);
    const now = new Date();
    
    // 時間を考慮せず日付のみの差分を計算
    const diffTime = now.getTime() - selectedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    console.error("日数計算エラー:", error);
    return 0;
  }
}

interface FavoriteMemberBadgeProps {
  favoriteMember: FavoriteMember
  avatarUrl?: string
}

export function FavoriteMemberBadge({ 
  favoriteMember, 
  avatarUrl 
}: FavoriteMemberBadgeProps) {
  const [daysSince, setDaysSince] = useState<number>(0);
  
  useEffect(() => {
    if (favoriteMember && favoriteMember.selectedAt) {
      setDaysSince(calculateDaysSince(favoriteMember.selectedAt));
    }
  }, [favoriteMember]);

  return (
    <div className="inline-flex flex-col items-center">
      <div className="inline-flex items-center px-4 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-pink-400 text-white shadow-md">
        <Heart className="w-3.5 h-3.5 mr-1.5 fill-white" />
        <div className="relative w-6 h-6 rounded-full overflow-hidden mr-2 border-2 border-white shadow-sm">
          <Image
            src={resolveImageUrl(avatarUrl)}
            alt={favoriteMember.memberName}
            fill
            className="object-cover"
          />
        </div>
        <span className="text-xs font-bold">{favoriteMember.memberName}</span>
      </div>
      
      {daysSince > 0 && (
        <div className="text-[10px] font-medium text-pink-600 mt-1 bg-pink-100 px-2 py-0.5 rounded-full">
          推し始めて {daysSince} 日目
        </div>
      )}
    </div>
  )
}