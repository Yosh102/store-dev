"use client"

import React from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { HelpCircle, Home, ArrowLeft } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-4">
      {/* ヘッダー */}
      <div className="fixed top-0 left-0 right-0 flex justify-between items-center p-4">
        <Button variant="ghost" size="icon" className="rounded-full" asChild>
          <Link href="/">
            <ArrowLeft className="h-6 w-6" />
          </Link>
        </Button>
        <Button variant="ghost" size="sm">
          <HelpCircle className="h-4 w-4 mr-2" />
          ヘルプ
        </Button>
      </div>

      {/* コンテンツ */}
      <div className="max-w-md w-full mx-auto text-center space-y-6">
        {/* イラスト */}
        <div className="relative my-8">
          <Image
            src="/img/404_illustration.png" 
            alt="Page Not Found"
            width={200}
            height={200}
            className="object-contain mx-auto"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.onerror = null;
              target.style.display = 'none';
            }}
          />
        </div>
        
        <h1 className="text-2xl font-bold">ページが見つかりません</h1>
        <p className="text-gray-600">
          お探しのページは存在しないか、移動された可能性があります。
          別のページをお試しいただくか、ホームページにお戻りください。
        </p>

        {/* 提案リンクセクション */}
        <div className="bg-gray-50 rounded-lg p-6 space-y-4 mt-4">
          <h2 className="font-medium text-left">よく訪問されるページ</h2>
          <div className="flex flex-col space-y-2">
            <Link href="/" className="text-left text-gray-700 hover:text-primary flex items-center py-2">
              <Home className="h-4 w-4 mr-2" />
              <span>ホームページ</span>
            </Link>
            <Link href="/contact" className="text-left text-gray-700 hover:text-primary flex items-center py-2">
              <span className="h-4 w-4 mr-2 flex items-center justify-center">✉️</span>
              <span>お問い合わせ</span>
            </Link>
            <Link href="/profile" className="text-left text-gray-700 hover:text-primary flex items-center py-2">
              <span className="h-4 w-4 mr-2 flex items-center justify-center">👤</span>
              <span>プロフィール</span>
            </Link>
          </div>
        </div>

        {/* アクションボタン */}
        <div className="space-y-4 pt-6">
          <Button asChild variant="outline" className="w-full max-w-xs" onClick={() => window.history.back()}>
            <span>前のページに戻る</span>
          </Button>
          <Button asChild variant="outline" className="w-full max-w-xs">
            <Link href="/">ホームに戻る</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}