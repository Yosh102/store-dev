"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// Product 型は既存のものを利用（id, name, images, category, price, tags, createdAt など）
import type { Product } from "@/types/product";

/** createdAt を Date に正規化（Firestore Timestamp / number(ms) / ISO string / Date） */
function toDate(v: any): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate();
  if (typeof v === "number") return new Date(v * 1000); // 秒の可能性
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  if (typeof v === "string") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isWithinTwoMonths(d: Date): boolean {
  const now = new Date();
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(now.getMonth() - 3);
  return d >= twoMonthsAgo && d <= now;
}

export default function NewGoodsShowcase({
  title = "新着グッズ",
  description = "新しく追加されたグッズをピックアップ！",
  storeUrl = "/store", // 全て見る 先
}: {
  title?: string;
  description?: string;
  storeUrl?: string;
}) {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setIsLoading(true);
      try {
        // API は全件取得 → クライアント側で3ヶ月フィルタ＆ソート
        const res = await fetch("/api/store/products", { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
        const data = await res.json();
        if (mounted) setAllProducts(Array.isArray(data.products) ? data.products : []);
      } catch (e) {
        console.error("Error fetching products:", e);
        if (mounted) setAllProducts([]);
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);


const products = useMemo(() => {
  const normalized = allProducts
    .map((p) => {
      const publishDate = toDate((p as any).publishStartDate);
      return { p, publishDate };
    })
    .filter((x) => x.publishDate && isWithinTwoMonths(x.publishDate!))
    .sort((a, b) => b.publishDate!.getTime() - a.publishDate!.getTime())
    .map((x) => x.p);

  return normalized;
}, [allProducts]);

  // 1件もなければセクションごと非表示
  if (!isLoading && products.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="bg-white rounded-2xl shadow-[0_20px_80px_rgba(0,0,0,0.18)] overflow-hidden">
        {/* ヘッダー（背景画像付き） */}
        <div className="relative">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 p-6 md:p-8">
            <div className="min-w-0">
              <h2 className="text-2xl md:text-3xl font-extrabold text-black">{title}</h2>
              <p className="mt-1 text-sm md:text-base text-black">{description}</p>
            </div>

            {/* 右ボタン：小画面では下段、PCでは右。はみ出し防止のため shrink-0 */}
            <Link
              href={storeUrl}
              className="relative inline-flex items-center rounded-full px-5 py-2 bg-white text-black text-xs md:text-sm font-semibold text-left hover:opacity-90 transition shrink-0"
            >
              {/* 左：テキスト */}
              <span className="pr-5 whitespace-nowrap">すべて見る</span>
              {/* 右：矢印（上下中央・右寄せ） */}
              <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-black" />
            </Link>
          </div>
        </div>

        {/* 商品一覧 */}
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
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {products.map((product) => (
                <Link key={product.id} href={`/product/${product.id}`} className="group bg-white">
                  <div className="flex flex-col">
                    {/* サムネ + NEW バッジ */}
                    <div className="relative aspect-square mb-3 bg-white rounded-lg overflow-hidden p-2">
                      <Image
                        src={product.images?.[0] || "/placeholder.svg"}
                        alt={product.name}
                        fill
                        className="object-contain rounded-lg"
                      />
                      <span className="absolute top-2 left-2 rounded px-2 py-1 text-[10px] font-bold text-white bg-black/70">
                        NEW
                      </span>
                    </div>

                    <div className="space-y-1 px-1">
                      {product.category && (
                        <span className="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded whitespace-nowrap">
                          {product.category}
                        </span>
                      )}
                      <h3 className="text-sm font-medium mt-2 line-clamp-2">{product.name}</h3>
                      <p className="text-base font-bold">¥{product.price.toLocaleString()}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
