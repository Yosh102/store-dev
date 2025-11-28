'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { Product } from '@/types/product';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ChevronUp } from 'lucide-react';

interface ProductListProps {
  initialProducts?: Product[];
  title?: string;
  showAllLink?: boolean;
  allProductsLink?: string;
}

const LOAD_STEP = 20;
const NEW_DAYS = 90; // 「新着」= 直近90日

type FilterKey = 'ALL' | 'NEW' | 'FEEL_IT' | 'PINKY' | `CAT:${string}`;

export default function ProductList({
  initialProducts,
  title,
  showAllLink = false,
  allProductsLink = '/store',
}: ProductListProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [isLoading, setIsLoading] = useState(!initialProducts || initialProducts.length === 0);

  // フィルタ状態
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('ALL');

  // 追加読み込み
  const [visibleCount, setVisibleCount] = useState<number>(LOAD_STEP);

  // 初期データ（なければAPI取得）
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/store/products');
        if (!res.ok) throw new Error(`Failed to fetch products: ${res.status} ${res.statusText}`);
        const data = await res.json();
        setProducts(data.products as Product[]);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!initialProducts || initialProducts.length === 0) {
      fetchProducts();
    } else {
      setProducts(initialProducts);
      setIsLoading(false);
    }
  }, [initialProducts]);

  // カテゴリ一覧
  const categoryKeys = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const c = (p.category ?? '').trim();
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [products]);

  // ヘルパー
  const toMillis = (p: Product) =>
    (p.createdAt as any)?.toMillis?.() ??
    ((p.createdAt as any)?.seconds ? (p.createdAt as any).seconds * 1000 : 0);

  const isFeelIt = (p: Product) =>
    (p.name || '').toLowerCase().includes('feel it');
  const isPinky = (p: Product) =>
    (p.name || '').toLowerCase().includes('pinky');

  const isNew = (p: Product) => {
    const created = toMillis(p);
    if (!created) return false;
    const diffDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
    return diffDays <= NEW_DAYS;
  };

  // フィルタリング
  const filteredProducts = useMemo(() => {
    let base = products;

    switch (selectedFilter) {
      case 'NEW':
        base = base.filter(isNew);
        break;
      case 'FEEL_IT':
        base = base.filter(isFeelIt);
        break;
      case 'PINKY':
        base = base.filter(isPinky);
        break;
      default:
        if (selectedFilter.startsWith('CAT:')) {
          const cat = selectedFilter.replace('CAT:', '');
          base = base.filter((p) => (p.category ?? '').trim() === cat);
        }
    }

    // 新着順
    return [...base].sort((a, b) => toMillis(b) - toMillis(a));
  }, [products, selectedFilter]);

  // フィルタ変更時は件数リセット
  useEffect(() => {
    setVisibleCount(LOAD_STEP);
  }, [selectedFilter]);

  const listToShow = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const canLoadMore = filteredProducts.length > visibleCount;

  // トップへ戻る（モバイル）
  const [showToTop, setShowToTop] = useState(false);
  useEffect(() => {
    const onScroll = () => setShowToTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const scrollToTop = useCallback(() => window.scrollTo({ top: 0, behavior: 'smooth' }), []);

  // フィルタボタンのUI
  const FilterButton = ({
    label,
    value,
  }: {
    label: string;
    value: FilterKey;
  }) => {
    const active = selectedFilter === value;
    return (
      <button
        onClick={() => setSelectedFilter(value)}
        className={[
          'px-3 py-1.5 rounded-full text-sm border transition-colors',
          active ? 'bg-black text-white border-black' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100',
        ].join(' ')}
        aria-pressed={active}
      >
        {label}
      </button>
    );
  };

  if (isLoading) {
    return (
      <div className="p-3 md:p-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, index) => (
            <div key={index} className="flex flex-col bg-white">
              <Skeleton className="aspect-square mb-3 rounded-lg" />
              <div className="space-y-1 px-1">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return <div className="p-6 md:p-8">現在、表示できる商品がありません。</div>;
  }

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto px-8">
      {title && (
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-xl font-bold flex items-center">{title}</h3>
          {showAllLink && products.length > 0 && (
            <Link href={allProductsLink} className="text-sm text-gray-600 hover:text-gray-900">
              すべての商品を見る
            </Link>
          )}
        </div>
      )}

      {/* クイックフィルタ：全て / 新着 / Feel it / Pinky → カテゴリ */}
      <div className="mb-6 flex flex-wrap gap-2">
        <FilterButton label="全て" value="ALL" />
        <FilterButton label="新着" value="NEW" />
        <FilterButton label="Feel it" value="FEEL_IT" />
        <FilterButton label="Pinky" value="PINKY" />
        {categoryKeys.map((cat) => (
          <FilterButton key={cat} label={cat} value={`CAT:${cat}`} />
        ))}
      </div>

      {/* 一覧 */}
      {filteredProducts.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg text-gray-600">該当する商品がありません。</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {listToShow.map((product) => {
              const showCampaignBadge = isFeelIt(product);
              return (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  className="group bg-white w-full rounded-xl transition-shadow duration-200"
                >
                  <div className="flex flex-col p-2">
                    {/* サムネ：指定の形式に統一（キャンペーンバッジ付き） */}
                    <div className="relative aspect-square mb-3 bg-white rounded-lg overflow-hidden p-2">
                      <Image
                        src={product.images?.[0] || '/placeholder.svg'}
                        alt={product.name}
                        fill
                        className="object-contain rounded-lg"
                      />
                      {/* {showCampaignBadge && (
                        <span
                          className="absolute top-2 left-2 rounded px-2 py-1 text-[10px] font-bold text-white shadow-sm
                                     bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700"
                        >
                          キャンペーン対象
                        </span>
                      )} */}
                    </div>

                    {/* 情報 */}
                    <div className="space-y-1 px-2 pb-3 w-full">
                      {product.category && (
                        <span className="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">
                          {product.category}
                        </span>
                      )}
                      <h2 className="text-sm font-medium mt-2 line-clamp-2">{product.name}</h2>
                      {product.subtitle && (
                        <p className="text-xs text-gray-500 line-clamp-1">{product.subtitle}</p>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-base font-bold text-gray-800">¥{product.price.toLocaleString()}</p>
                        {product.stock === 0 && <span className="text-xs text-red-600">売り切れ</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* さらに読み込む */}
          {canLoadMore && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => setVisibleCount((c) => c + LOAD_STEP)}
              >
                さらに読み込む
              </Button>
            </div>
          )}
        </>
      )}

      {/* モバイル右下：トップへ戻る */}
      {showToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-20 right-4 sm:bottom-6 sm:right-6 z-40 sm:hidden
                     w-12 h-12 rounded-full shadow-lg bg-black text-white
                     flex items-center justify-center active:scale-95 transition-transform"
          aria-label="トップへ戻る"
          title="トップへ戻る"
        >
          <ChevronUp className="w-6 h-6" />
        </button>
      )}
    </div>
  );
}
