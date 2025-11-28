'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import type { Product } from '@/types/product';
import { ChevronRight } from "lucide-react";


function hasFeelItTag(p: Product): boolean {
  const candidates: string[] = [];
  const arr = (p as any)?.tags;
  if (Array.isArray(arr)) candidates.push(...arr);
  if (typeof arr === 'string') candidates.push(...arr.split(','));
  const tag = (p as any)?.tag;
  if (typeof tag === 'string') candidates.push(tag);
  const metaTags = (p as any)?.metadata?.tags;
  if (Array.isArray(metaTags)) candidates.push(...metaTags);
  if (typeof metaTags === 'string') candidates.push(...metaTags.split(','));
  return candidates.some((raw) => {
    if (typeof raw !== 'string') return false;
    const s = raw.trim().toLowerCase().replace(/\s+/g, ' ');
    return s === 'feel it';
  });
}

function getCampaignDeadlineJST(): Date {
  const now = new Date();
  const year = now.getFullYear();
  return new Date(`${year}-10-31T23:59:00+09:00`);
}

function formatCountdown(to: Date): string {
  const now = new Date();
  const diff = to.getTime() - now.getTime();
  if (diff <= 0) return '終了しました';
  const s = Math.floor(diff / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  return `${days}日 ${String(hours).padStart(2, '0')}時間 ${String(minutes).padStart(2, '0')}分 ${String(seconds).padStart(2, '0')}秒`;
}

export default function FeelItShowcase({
  title = '「Feel it」特集！',
  description = 'PRYME 2nd Single「Feel it」リリース記念グッズをピックアップ！',
}: {
  title?: string;
  description?: string;
}) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [countdown, setCountdown] = useState<string>('');
  const deadline = useMemo(getCampaignDeadlineJST, []);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(deadline));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [deadline]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/store/products', { cache: 'no-store' });
        if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (mounted) setAllProducts(Array.isArray(data.products) ? data.products : []);
      } catch (e) {
        console.error('Error fetching products:', e);
        if (mounted) setAllProducts([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const products = useMemo(() => {
    const filtered = allProducts.filter(hasFeelItTag);
    return filtered.sort((a, b) => {
      const aIsGoods = a.category === 'グッズ';
      const bIsGoods = b.category === 'グッズ';
      if (aIsGoods && !bIsGoods) return -1;
      if (!aIsGoods && bIsGoods) return 1;
      return 0;
    });
  }, [allProducts]);

  return (
    <section className="mb-8">
      <div className="bg-white rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] overflow-hidden">
        
        {/* 🔹特集ヘッダー（背景画像付き） */}
        <div className="relative">
          <Image
            src="https://firebasestorage.googleapis.com/v0/b/playtunestore.firebasestorage.app/o/img%2Fgroups%2Fbg-gradient-03.png?alt=media&token=e071cd30-14c8-4836-b6f3-bd3f9a059c3e"
            alt="Feel it ヘッダー背景"
            fill
            className="object-cover"
            priority
          />
          
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 p-6 md:p-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-extrabold text-white">
                {title}
              </h2>
              <p className="mt-1 text-sm md:text-base text-white">
                {description}
              </p>
            </div>
          </div>
        </div>

        {/* 🔹商品一覧 */}
        <div className="p-4 md:p-6">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col bg-white">
                  <Skeleton className="aspect-square mb-3 rounded-lg" />
                  <div className="space-y-1 px-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="text-gray-600">「Feel it」タグの商品は見つかりませんでした。</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {products.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`} className="group bg-white">
                  <div className="flex flex-col">
                    {/* サムネ */}
                    <div className="relative aspect-square mb-3 bg-white rounded-lg overflow-hidden p-2">
                      <Image
                        src={product.images?.[0] || '/placeholder.svg'}
                        alt={product.name}
                        fill
                        className="object-contain rounded-lg"
                      />
                      {/* <span
                        className="absolute top-2 left-2 rounded px-2 py-1 text-[10px] font-bold text-white shadow-sm
                                   bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700"
                      >
                        キャンペーン対象
                      </span> */}
                    </div>

                    <div className="space-y-1 px-1">
                      {product.category && (
                        <span className="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">
                          {product.category}
                        </span>
                      )}
                      <h3 className="text-sm font-medium mt-2 line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-base font-bold">
                        ¥{product.price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {/* 配信予定一覧へ */}
            <div className="mt-4">
              <Link
                href="/store"
                className="w-full block text-center rounded-full border border-gray-300 bg-white px-4 py-1 text-sm font-semibold text-gray-800 hover:bg-gray-50"
              >
                PLAY TUNE STOREへ
              </Link>
            </div>
        </div>
      </div>
    </section>
  );
}
