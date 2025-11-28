import { PromoCard } from "@/components/home/PromoCard"
import PostCarousel from "@/components/home/PostCarousel"
import CategorySelection from "@/components/home/CategorySelection"
import GroupList from "@/components/group/GroupList"
import FeaturedProducts from "@/components/home/FeauturedProducts"
import { FanClubPromotion } from "@/components/home/FanClubPromotion"
import { Metadata } from 'next';
import GroupShowcase from "@/components/home/GroupShowcase"
import AllDiscographyCarousel from "@/components/home/DiscographyList"
import LiveList from "@/components/live/LiveList";
import FeelItProductList from "@/components/product/FeelItProductList";
import MembershipFromCards from "@/components/home/MembershipFromCards"
import NewGoodsShowcase from "@/components/product/NewGoodsShowcase"
import GroupReleasesShowcase from "@/components/home/GroupShowcase"
export const metadata: Metadata = {
  title: 'PLAY TUNE オフィシャルサイト',
  description: '2.9次元アイドル事務所「PLAY TUNE」の公式サイトです。',
};

export default function Home() {
  return (
  <>
    <div className="container mx-auto px-2 py-6">

      {/* PICKUP記事カルーセル */}
      <section className="mb-4">
        <PostCarousel tag="pickup" limit={5} className="max-w-7xl mx-auto" />
      </section>

      <LiveList />
      <div className="mb-4">
        <FeelItProductList />
      </div>
      {/* ニュースカテゴリーの記事 */}
      <section className="mb-8">
        <div className="bg-white rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] p-4 md:p-6">
          <h2 className="text-2xl font-bold mb-3">お知らせ</h2>        
          <CategorySelection category="ニュース" limit={10} className="max-w-7xl mx-auto" />
        </div>
      </section>
      {/* 特集商品（カテゴリーなし） */}
      <div className="mb-4">
        <NewGoodsShowcase />
      </div>
      <div className="mb-4">
        <MembershipFromCards />
      </div>

      <div className="mb-4">

      <GroupReleasesShowcase />
      </div>

    </div>
  </>
  )
}