"use client"

// src/app/(public)/membership/page.tsx
import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { CheckCircle } from 'lucide-react';

export default function MembershipPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      {/* メンバーシップ紹介セクション - Uber Oneスタイル */}
      <div className="mb-24 bg-gray-50 rounded-xl overflow-hidden">
        <div className="flex flex-col md:flex-row items-center p-6 md:p-12">
          <div className="md:w-1/2 mb-8 md:mb-0 md:pr-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-3xl font-bold">PLAY TUNE メンバーシップ</h2>
            </div>
            <p className="text-gray-700 mb-6">
              PLAY TUNEのサブスクリプション（定額）サービスの総合メンバーシップなら、月額440円でメンバー限定の特典やコンテンツがお楽しみいただけます。
            </p>
            <Button className="rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 text-white">
            <Link href="/group/playtune">
                ご登録はこちら
            </Link>
            </Button>
          </div>
          <div className="md:w-1/2">
            <div className="relative rounded-xl overflow-hidden">
              <Image
                src="/img/campaign.png"
                alt="メンバーシップキャンペーン"
                width={900}
                height={600}
                className="w-full h-auto object-cover rounded-xl"
                priority
                onError={(e) => {
                  // 画像読み込みエラー時のフォールバック
                  const target = e.target as HTMLImageElement;
                  target.onerror = null;
                  target.style.display = 'none';
                }}
              />
            </div>
          </div>
        </div>
      </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
        <div className="flex">
            <div className="mr-6">
            <div className="bg-amber-100 p-4 rounded-lg w-16 h-16 flex items-center justify-center">
                <Image
                src="/img/content-icon.png"
                alt="限定コンテンツアイコン"
                width={48}
                height={48}
                className="object-contain"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = "";
                    target.className = "bg-amber-200 w-12 h-12 rounded-lg";
                }}
                />
            </div>
            </div>
            <div>
            <h3 className="text-xl font-bold mb-2">限定コンテンツ</h3>
            <p className="text-gray-600">
                PLAY TUNE所属アーティストの限定コンテンツにアクセスできます。限定グッズ、写真、動画、音源など様々なコンテンツをお楽しみいただけます！
            </p>
            </div>
        </div>

        <div className="flex">
            <div className="mr-6">
            <div className="bg-sky-100 p-4 rounded-lg w-16 h-16 flex items-center justify-center">
                <Image
                src="/img/early-access-icon.png"
                alt="先行アクセスアイコン"
                width={48}
                height={48}
                className="object-contain"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = "";
                    target.className = "bg-sky-200 w-12 h-12 rounded-lg";
                }}
                />
            </div>
            </div>
            <div>
            <h3 className="text-xl font-bold mb-2">最新情報の先行お知らせ</h3>
            <p className="text-gray-600">
                楽曲の先行配信などの最新情報を一般公開前に先行してお届けします！
            </p>
            </div>
        </div>

        <div className="flex">
            <div className="mr-6">
            <div className="bg-purple-100 p-4 rounded-lg w-16 h-16 flex items-center justify-center">
                <Image
                src="/img/gift-icon.png"
                alt="ギフトアイコン"
                width={48}
                height={48}
                className="object-contain"
                onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.onerror = null;
                    target.src = "";
                    target.className = "bg-purple-200 w-12 h-12 rounded-lg";
                }}
                />
            </div>
            </div>
            <div>
            <h3 className="text-xl font-bold mb-2">限定イベント</h3>
            <p className="text-gray-600">
                メンバーシップ参加メンバー限定のオンラインイベントへ申し込み可能！
            </p>
            </div>
        </div>
        </div>

      {/* メンバーシッププラン比較テーブル */}
      <div className="mb-20">
        <h2 className="text-2xl font-bold mb-6 text-center">メンバーシッププラン比較</h2>
        
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="w-1/3 p-4 bg-gray-50 text-left"></th>
                <th className="p-4 bg-emerald-50 font-bold text-emerald-800 border-b border-gray-200">
                  <div className="flex items-center justify-between text-center">
                    <span className="text-center">総合メンバーシップ</span>
                  </div>
                </th>
                <th className="p-4 bg-gray-50 font-bold text-gray-600 border-b border-gray-200 text-center">
                  <div className="flex items-center justify-between">
                    <span className="text-center">ユニット別メンバーシップ</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-4 font-medium border-b border-gray-200">月額料金</td>
                <td className="p-4 text-center border-b border-gray-200 font-bold text-lg text-emerald-700">¥440</td>
                <td className="p-4 text-center border-b border-gray-200 font-bold text-lg text-gray-500">-</td>
              </tr>
              <tr>
                <td className="p-4 font-medium border-b border-gray-200">限定コンテンツの閲覧</td>
                <td className="p-4 text-center border-b border-gray-200">
                  <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto" />
                </td>
                <td className="p-4 text-center border-b border-gray-200">
                  <CheckCircle className="h-5 w-5 text-gray-400 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="p-4 font-medium border-b border-gray-200">デジタル会員証</td>
                <td className="p-4 text-center border-b border-gray-200">
                  <CheckCircle className="h-5 w-5 text-emerald-500 mx-auto" />
                </td>
                <td className="p-4 text-center border-b border-gray-200">
                  <CheckCircle className="h-5 w-5 text-gray-400 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="p-4 font-medium border-b border-gray-200">年三回の会報</td>
                <td className="p-4 text-center border-b border-gray-200">-</td>
                <td className="p-4 text-center border-b border-gray-200">
                  <CheckCircle className="h-5 w-5 text-gray-400 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="p-4 font-medium border-b border-gray-200">限定グッズの購入権</td>
                <td className="p-4 text-center border-b border-gray-200">-</td>
                <td className="p-4 text-center border-b border-gray-200">
                  <CheckCircle className="h-5 w-5 text-gray-400 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="p-4 font-medium border-b border-gray-200">年賀状</td>
                <td className="p-4 text-center border-b border-gray-200">-</td>
                <td className="p-4 text-center border-b border-gray-200">
                  <CheckCircle className="h-5 w-5 text-gray-400 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="p-4 font-medium border-b border-gray-200">ファンクラブ限定イベントへの参加</td>
                <td className="p-4 text-center border-b border-gray-200">-</td>
                <td className="p-4 text-center border-b border-gray-200">
                  <CheckCircle className="h-5 w-5 text-gray-400 mx-auto" />
                </td>
              </tr>
              <tr>
                <td className="p-4"></td>
                <td className="p-4">
                  <Button className="w-full bg-emerald-500 hover:bg-emerald-600">
                  <Link href="/group/playtune">
                    登録する
                </Link>
                  </Button>
                </td>
                <td className="p-4">
                  <Button disabled className="w-full bg-gray-400 cursor-not-allowed">
                    Coming soon...
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      
      {/* よくある質問 */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold mb-6">よくある質問</h2>
        <div className="space-y-6">
          {[
            {
              question: '総合メンバーシップとユニット別メンバーシップの違いは何ですか？',
              answer: '総合メンバーシップはPLAY TUNE事務所全体のコンテンツにアクセスできるプランです。ユニット別メンバーシップは、各ユニット・アーティスト専用のコンテンツや特典が充実したプランとなります。現在はユニット別メンバーシップは準備中です。'
            },
            {
              question: 'デジタル会員証とは何ですか？',
              answer: 'デジタル会員証はスマートフォンで表示できる電子的な会員証です。会員番号、会員ステータスなどが表示されます。'
            },
            {
              question: 'サブスクリプションはいつでもキャンセルできますか？',
              answer: 'はい、いつでもキャンセル可能です。キャンセルした場合でも、支払い済みの期間終了までは引き続きメンバーシップの特典を利用できます。'
            },
            {
              question: '支払い方法は何がありますか？',
              answer: 'クレジットカード（Visa、Mastercard、American Express、JCB等）、銀行振込、PayPayでのお支払いに対応しています。'
            },
            {
              question: 'メンバーシップに加入したらすぐに特典を利用できますか？',
              answer: 'はい、支払い完了後すぐにメンバーシップの特典をご利用いただけます。限定コンテンツへのアクセス権がすぐに付与されます。デジタル会員証もすぐに発行されます。'
            }
          ].map((faq, index) => (
            <div key={index} className="border-b border-gray-200 pb-6">
              <h3 className="font-bold text-lg mb-2">{faq.question}</h3>
              <p className="text-gray-600">{faq.answer}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTAセクション */}
      <div className="bg-gradient-to-r from-emerald-500 to-sky-500 rounded-2xl p-8 text-white text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">メンバーシップに参加しませんか？</h2>
        <p className="mb-8 max-w-2xl mx-auto">
          お気に入りのアーティストやクリエイターを直接サポートしながら、限定コンテンツをお楽しみいただけます。
          まずはグループページをチェックして、気になるクリエイターを見つけましょう。
        </p>
        <div className="flex justify-center">
          <Button
            variant="secondary" 
            className="bg-white text-emerald-700 hover:bg-gray-100"
            size="lg"
            asChild
          >
            <Link href="/group">グループを探す</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}