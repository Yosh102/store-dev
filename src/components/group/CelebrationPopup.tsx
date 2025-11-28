"use client"

import { useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import confetti from 'canvas-confetti'
import { X } from "lucide-react"
import { type FavoriteMember } from "@/types/user"

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

interface CelebrationPopupProps {
  isOpen: boolean
  onClose: () => void
  member: FavoriteMember
  avatarUrl?: string
  groupName: string
}

export function CelebrationPopup({
  isOpen,
  onClose,
  member,
  avatarUrl,
  groupName
}: CelebrationPopupProps) {
  // 紙吹雪エフェクト
  useEffect(() => {
    if (isOpen) {
      // 紙吹雪の演出
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const colors = ['#ff69b4', '#ff1493', '#ff7ac6', '#ff85a2', '#ff77ff'];

      // 左側から紙吹雪
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.1, y: 0.5 },
        colors: colors,
        ticks: 200,
        disableForReducedMotion: true
      });

      // 右側から紙吹雪
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { x: 0.9, y: 0.5 },
        colors: colors,
        ticks: 200,
        disableForReducedMotion: true
      });

      // 中央上部から紙吹雪をランダムに
      const frame = () => {
        const timeLeft = animationEnd - Date.now();
        
        if (timeLeft <= 0) return;
        
        confetti({
          particleCount: 2,
          startVelocity: 30,
          spread: 360,
          origin: {
            x: Math.random(),
            y: Math.random() - 0.2
          },
          colors: colors,
          disableForReducedMotion: true
        });
        
        requestAnimationFrame(frame);
      };
      
      frame();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={onClose}
      />
      
      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-sm mx-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg border border-pink-200 shadow-xl">
        {/* Close button */}
        <button 
          onClick={onClose}
          className="absolute top-2 right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-white transition-colors"
        >
          <X className="w-4 h-4 text-gray-600" />
        </button>
        
        <div className="flex flex-col items-center p-6 text-center">
          <div className="text-xl sm:text-2xl font-bold text-pink-600 mb-2">
            おめでとうございます！
          </div>
          
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 mb-4 rounded-full overflow-hidden border-4 border-pink-400">
            <Image
              src={resolveImageUrl(avatarUrl)}
              alt={member.memberName}
              fill
              className="object-cover"
            />
          </div>
          
          <h3 className="text-lg sm:text-xl font-bold text-pink-600 mb-1">{member.memberName}</h3>
          <p className="text-base sm:text-lg text-pink-500 mb-4 sm:mb-6">推し始めて<span className="font-bold text-xl sm:text-2xl">1</span>日目！</p>
          
          <p className="text-xs sm:text-sm text-gray-600 mb-4">
            これから{groupName}の{member.memberName}と素敵な推し活を楽しんでください。<br />
          </p>

          <Button
            onClick={onClose}
            className="w-full rounded-full bg-gradient-to-r from-pink-500 to-pink-400 text-white hover:from-pink-600 hover:to-pink-500"
          >
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}