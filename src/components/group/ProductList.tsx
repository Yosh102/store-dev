'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types/product';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

interface ProductListProps {
  initialProducts: Product[];
  groupSlug?: string;
  className?: string;
}

export default function ProductList({ 
  initialProducts, 
  groupSlug,
  className = ''
}: ProductListProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  useEffect(() => {
    // 最大8個まで表示
    setProducts(initialProducts.slice(0, 8));
  }, [initialProducts]);

  if (!products || products.length === 0) {
    return (
      <div className={className}>
        <div className="text-center py-12 text-gray-400">
          現在、表示できる商品がありません。
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* スマホ: 横スクロール、デスクトップ: グリッド */}
      <div className="md:grid md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 md:gap-6 md:block hidden">
        {/* デスクトップ表示 */}
        {products.map((product) => (
          <Link 
            key={product.id} 
            href={`/product/${product.id}`} 
            className="group bg-white hover:bg-gray-50 rounded-lg p-4 transition-all duration-200 border border-gray-200 hover:border-gray-300 flex flex-col h-[400px]"
          >
            <div className="flex flex-col h-full">
              <div className="relative aspect-square mb-4 bg-gray-50 rounded-lg overflow-hidden">
                <Image
                  src={product.images?.[0] || '/placeholder.svg'}
                  alt={product.name}
                  fill
                  className="object-contain p-2"
                />
              </div>
              <div className="space-y-2 flex-1 flex flex-col">
                {product.category && (
                  <span className="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded-full w-fit">
                    {product.category}
                  </span>
                )}
                <h3 className="text-sm font-medium line-clamp-2 text-gray-900 group-hover:text-gray-700 transition-colors flex-1">
                  {product.name}
                </h3>
                <p className="text-base font-bold text-gray-900 mt-auto">
                  ¥{product.price?.toLocaleString() || '0'}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* スマホ表示: 横スクロール */}
      <div className="md:hidden">
        <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide px-4">
          {products.map((product) => (
            <Link 
              key={product.id} 
              href={`/product/${product.id}`} 
              className="group bg-white hover:bg-gray-50 rounded-lg p-6 transition-all duration-200 border border-gray-200 hover:border-gray-300 w-[280px] h-[420px] flex-shrink-0 flex flex-col"
            >
              <div className="flex flex-col h-full">
                <div className="relative aspect-square mb-4 bg-gray-50 rounded-lg overflow-hidden">
                  <Image
                    src={product.images?.[0] || '/placeholder.svg'}
                    alt={product.name}
                    fill
                    className="object-contain p-4"
                  />
                </div>
                <div className="space-y-3 flex-1 flex flex-col">
                  {product.category && (
                    <span className="inline-block text-sm px-3 py-1 bg-gray-100 text-gray-800 rounded-full w-fit">
                      {product.category}
                    </span>
                  )}
                  <h3 className="text-base font-medium line-clamp-2 text-gray-900 group-hover:text-gray-700 transition-colors leading-relaxed flex-1">
                    {product.name}
                  </h3>
                  <p className="text-lg font-bold text-gray-900 mt-auto">
                    ¥{product.price?.toLocaleString() || '0'}
                  </p>
                </div>
              </div>
            </Link>
          ))}
          
          {/* スマホ用「全て見る」カード */}
          <Link 
            href={groupSlug ? `/group/${groupSlug}/store` : '/store'}
            className="group bg-white hover:bg-gray-50 rounded-lg p-6 transition-all duration-200 border border-gray-200 hover:border-gray-300 w-[280px] h-[420px] flex-shrink-0 flex flex-col items-center justify-center text-center"
          >
            <div className="flex flex-col items-center justify-center h-full">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <ArrowRight className="w-10 h-10 text-gray-900" strokeWidth={2} />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                全て見る
              </h3>
            </div>
          </Link>
        </div>
      </div>

      {/* 「全て見る」ボタン（共通） */}
      <div className="flex justify-center mt-8">
        <Link href={groupSlug ? `/group/${groupSlug}/store` : '/store'}>
          <Button 
            variant="outline" 
            size="lg"
            className="w-full md:w-auto bg-white text-black hover:bg-gray-100 text-lg font-bold px-12 py-4 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-xl group"
          >
            グッズを全て見る
            <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" strokeWidth={2} />
          </Button>
        </Link>
      </div>
    </div>
  );
}