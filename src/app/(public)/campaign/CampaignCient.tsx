"use client"

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import FeelItProductShowcase from "@/components/product/FeelitProductShowcase";


export default function CampaignClient() {
  const [ratio, setRatio] = useState(16 / 9);
  const heroSrc =
    "https://firebasestorage.googleapis.com/v0/b/playtunestore.firebasestorage.app/o/img%2Fgroups%2Fcapaign-jpeg.jpg?alt=media&token=b467dd69-cf9e-4def-8c0d-22ebdcb06c2b";

  return (
    <div className="bg-white min-h-screen pb-8">
      <div className="container mx-auto px-2 max-w-5xl">
        <section className="pt-6 mb-12">
          <div
            className="relative w-full overflow-hidden rounded-2xl"
            style={{ paddingBottom: `${(1 / ratio) * 100}%` }}
          >
            <Image
              src={heroSrc}
              alt="Feel it Hero Banner"
              fill
              className="object-cover"
              priority
              onLoadingComplete={(img) => {
                if (img.naturalWidth && img.naturalHeight) {
                  setRatio(img.naturalWidth / img.naturalHeight);
                }
              }}
            />
          </div>
        </section>

{/* MV企画 Feature Card */}
<div className="bg-white rounded-2xl p-4 md:p-6 mb-12 shadow-[0_20px_80px_rgba(0,0,0,0.18)] flex flex-col gap-8">
  {/* 上部：2カラム */}
  <div className="flex flex-col md:flex-row items-center gap-8">
    <div className="flex-1 flex justify-center">
      <Image
        src="https://i.imgur.com/kcih6qY.jpg"
        alt="MV名シーン企画"
        width={400}
        height={400}
        className="rounded-xl object-cover shadow-lg"
      />
    </div>

    <div className="flex-1 md:text-left">
      <h3 className="text-2xl font-bold text-purple-500 mb-4">
        🎥 新曲MV公開記念！Feel it MV名シーン企画開催！
      </h3>
      <p className="text-lg text-gray-800 mb-4">
        MVの中からお気に入りのシーンを見つけて「#PRYME_Feelit」をつけてSNSに投稿しよう！
        参加者全員に限定壁紙、抽選でサイン入りTシャツが当たる！
      </p>
      <ol className="list-decimal list-inside text-base text-gray-700 mb-2">
        <li>MVの中からお気に入りのシーンをスクショ</li>
        <li>「#PRYME_Feelit」をつけてXまたはTikTokに投稿</li>
        <li>参加者全員に限定壁紙プレゼント</li>
      </ol>
      <div className="text-sm text-gray-500">
        ※プレゼントはDMを解放している方に限ります。
      </div>
      <div className="mt-4 text-purple-600 font-bold">
        ＼Wチャンス／<br/>
        各SNSでのキャンペーン参加で...<br/>
      </div>
      <div className="text-sm text-gray-700">
        <b>TikTok</b><br/>
        抽選で1名様にトレカ全種類セットをプレゼント！<br/>
        <b>X</b><br/>
        抽選で1名様にメンバー全員のサイン入りTシャツプレゼント！
      </div>
    </div>

    
  </div>
  <a
    href="https://www.youtube.com/watch?v=XXXX" // MVリンクに差し替え
    target="_blank"
    rel="noopener noreferrer"
    className="block text-center rounded-full bg-purple-500 text-white font-bold text-lg py-3 shadow hover:bg-purple-700 transition"
  >
    「Feel it」MVを視聴する →
  </a>
</div>
{/* 早期購入特典カード */}
<div className="bg-white rounded-2xl p-4 md:p-6 mb-12 shadow-[0_20px_80px_rgba(0,0,0,0.18)] flex flex-col gap-6">
  {/* 上部：2カラム */}
  <div className="flex flex-col md:flex-row items-center gap-6">
    {/* 右：画像 */}
    <div className="flex-1 flex justify-center">
      <Image
        src="https://i.imgur.com/Dd0xs59.jpg" // 特典イメージの画像に差し替えてください
        alt="早期購入特典"
        width={400}
        height={400}
        className="rounded-xl object-cover"
      />
    </div>
    {/* 左：説明 */}
    <div className="flex-1 text-left">
      <h3 className="text-2xl font-bold text-purple-500 mb-4">
        🎁 早期グッズ購入特典！
      </h3>
    <p className="text-lg text-gray-800 mb-4">
        「Feel it」グッズを期限内に購入すると、期間限定特典がもらえる！
      </p>
      <ul className="list-disc list-inside text-base text-gray-700 mb-3">
        <li>5,000円以上ご注文 → メンバーサイン入りトレカ1枚プレゼント(メンバー指定不可)</li>
        <li>10,000円以上ご注文 → 送料無料(通常800円)</li>
      </ul>
      <div className="text-sm text-gray-700 mb-2">
        例）10,000円ご注文の場合 → 「トレカ1枚＋送料無料」<br />
        2,500円のご注文 × 4回(合計金額10,000円)の場合 → 「特典なし」<br />
        5,000円のご注文 × 2回(合計金額10,000円)の場合 → 「それぞれトレカ1枚ずつ」
      </div>
      <div className="text-sm text-gray-500">
        ※早期購入特典は10/31まで <br />
        ※商品名に「 - Feel it Edition -」が付いているグッズが一つ以上含まれる全注文が対象です。
      </div>
    </div>
  </div>

  {/* 下部：商品ショーケース */}
  <FeelItProductShowcase />

  {/* 下部：ボタン */}
  <div className="flex justify-center">
    <a
      href="https://playtune.jp/group/pryme/store"
      target="_blank"
      rel="noopener noreferrer"
      className="block w-full md:w-auto text-center rounded-full bg-purple-500 text-white font-bold text-lg py-3 px-8 shadow hover:bg-purple-700 transition"
    >
      グッズ一覧へ →
    </a>
  </div>
</div>

        {/* Song Cover Feature Card - Just image and link button */}
        <div className="bg-white rounded-xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] p-4 mb-12 flex flex-col items-center">
          <Image src="https://i.imgur.com/JLgfKXW.jpg" alt="Feel it Song Cover" width={320} height={320} className="rounded-xl object-cover shadow-lg mb-4" />
          <a
            href="https://linkco.re/98EZd73C"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-6 py-2 bg-pink-500 text-white font-bold rounded-full shadow hover:bg-pink-600 transition"
          >
            「Feel it」を聴く
          </a>
        </div>

        {/* Footer/Navigation */}
        <div className="text-center mt-8">
          <Link href="/group/pryme" className="text-pink-600 underline font-bold text-lg">
            PRYMEの他のコンテンツを見る
          </Link>
        </div>
      </div>
    </div>
  );
}
