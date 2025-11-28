"use client"

import Image from "next/image"
import { Heart, Calendar, Award, Crown, Diamond } from "lucide-react"
import { type FavoriteMember } from "@/types/user"
import { useEffect, useState } from "react"
import { format } from "date-fns"

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

// 会員レベルとバッジを決定する関数
const getMembershipLevel = (days: number) => {
  if (days >= 365) {
    return { level: "ゴールド", badge: "gold" };
  } else if (days >= 180) {
    return { level: "シルバー", badge: "silver" };
  } else if (days >= 90) {
    return { level: "ブロンズ", badge: "bronze" };
  } else {
    return { level: "レギュラー", badge: "regular" };
  }
}

// 推しメンレベルとバッジを決定する関数
const getOshiLevel = (days: number) => {
  if (days >= 365) {
    return { 
      level: "ダイヤモンド", 
      badge: "diamond",
      icon: <Diamond className="w-5 h-5 text-blue-500" />
    };
  } else if (days >= 270) {
    return { 
      level: "キング", 
      badge: "king",
      icon: <Crown className="w-5 h-5 text-yellow-500" />
    };
  } else if (days >= 180) {
    return { 
      level: "クイーン", 
      badge: "queen",
      icon: <Crown className="w-5 h-5 text-yellow-300" />
    };
  } else if (days >= 90) {
    return { 
      level: "プリンス", 
      badge: "prince",
      icon: <Crown className="w-5 h-5 text-gray-400" />
    };
  } else {
    return { 
      level: "ビギナー", 
      badge: "beginner",
      icon: <Heart className="w-5 h-5 text-pink-500" />
    };
  }
}

interface MembershipCardProps {
  groupName: string
  groupLogo?: string
  memberSince: any // Firestore timestamp
  favoriteMember: FavoriteMember | null | undefined
  favoriteMemberAvatarUrl?: string
  accentColor?: string
}

export function MembershipCard({ 
  groupName, 
  groupLogo, 
  memberSince,
  favoriteMember,
  favoriteMemberAvatarUrl,
  accentColor = "#f472b6" // デフォルトはピンク色
}: MembershipCardProps) {
  const [memberDays, setMemberDays] = useState<number>(0);
  const [oshiDays, setOshiDays] = useState<number>(0);
  const [membershipLevel, setMembershipLevel] = useState({ level: "レギュラー", badge: "regular" });
  const [oshiLevel, setOshiLevel] = useState({ level: "ビギナー", badge: "beginner", icon: <Heart className="w-5 h-5 text-pink-500" /> });
  
  useEffect(() => {
    if (memberSince) {
      const days = calculateDaysSince(memberSince);
      setMemberDays(days);
      setMembershipLevel(getMembershipLevel(days));
    }
    
    if (favoriteMember && favoriteMember.selectedAt) {
      const days = calculateDaysSince(favoriteMember.selectedAt);
      setOshiDays(days);
      setOshiLevel(getOshiLevel(days));
    }
  }, [memberSince, favoriteMember]);

  // カードの背景色スタイル
  const cardStyle = {
    background: `linear-gradient(135deg, ${accentColor}22 0%, ${accentColor}55 100%)`,
    borderColor: `${accentColor}44`,
  };
  
  // 会員証バッジの背景色
  const badgeStyle = {
    backgroundColor: `${accentColor}`,
  };

  // メンバーシップの開始日を表示用にフォーマット
  const formatMemberSince = () => {
    if (!memberSince) return "不明";
    try {
      const date = memberSince.toDate ? memberSince.toDate() : new Date(memberSince.seconds * 1000);
      return format(date, "yyyy/MM/dd");
    } catch (error) {
      console.error("日付フォーマットエラー:", error);
      return "不明";
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto p-5 rounded-2xl border shadow-lg relative overflow-hidden flex flex-col"
         style={cardStyle}>
      {/* メンバーシップレベルバッジ */}
      <div className="absolute top-3 right-3 flex items-center">
        <div className="bg-white px-3 py-1 rounded-full shadow-md flex items-center gap-1.5">
          <Award className="w-4 h-4 text-yellow-500" />
          <span className="text-xs font-bold">{membershipLevel.level}</span>
        </div>
      </div>
      
      {/* グループロゴ・名称 */}
      <div className="flex items-center mb-5">
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white p-1 shadow-md mr-3">
          <Image
            src={resolveImageUrl(groupLogo)}
            alt={groupName}
            fill
            className="object-cover rounded-full"
          />
        </div>
        <div>
          <h2 className="text-lg font-bold tracking-tight">{groupName}</h2>
          <p className="text-xs text-gray-700">公式メンバーシップ</p>
        </div>
      </div>
      
      {/* 会員情報 */}
      <div className="bg-white rounded-xl p-4 shadow-md mb-4">
        <div className="flex justify-between items-center mb-2">
          <h3 className="font-semibold text-sm">会員情報</h3>
          <div className="text-xs text-gray-500 flex items-center">
            <Calendar className="w-3.5 h-3.5 mr-1" />
            <span>{formatMemberSince()}〜</span>
          </div>
        </div>
        
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center">
            <div className="bg-gray-100 rounded-full p-1.5 mr-2">
              <Award className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <span className="text-xs text-gray-500">会員期間</span>
              <p className="font-bold">{memberDays}日</p>
            </div>
          </div>
          
          <div className="px-3 py-1 rounded-full text-white text-xs font-semibold" style={badgeStyle}>
            メンバー証
          </div>
        </div>
      </div>
      
      {/* 推しメン情報（選択している場合のみ表示） */}
      {favoriteMember && (
        <div className="bg-white rounded-xl p-4 shadow-md">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-sm flex items-center">
              <Heart className="w-4 h-4 mr-1 text-pink-500" />
              推しメン
            </h3>
            <div className="text-xs text-gray-500 flex items-center">
              <span>{oshiLevel.level}</span>
              {oshiLevel.icon}
            </div>
          </div>
          
          <div className="flex items-center mt-2">
            <div className="relative w-12 h-12 rounded-full overflow-hidden border-2 border-pink-400 shadow-sm mr-3">
              <Image
                src={resolveImageUrl(favoriteMemberAvatarUrl)}
                alt={favoriteMember.memberName || '推しメン'}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <p className="font-bold">{favoriteMember.memberName}</p>
              <p className="text-xs flex items-center text-pink-600">
                <Heart className="w-3 h-3 mr-1 fill-pink-500" />
                推し歴 {oshiDays}日目
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}