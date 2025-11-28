'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Product } from '@/types/product';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductListProps {
    initialProducts?: Product[];  // オプショナルに変更
  }

export default function ProductList({ initialProducts }: ProductListProps) {
  const [products, setProducts] = useState<Product[]>(initialProducts || []);
  const [isLoading, setIsLoading] = useState(!initialProducts || initialProducts.length === 0);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/store/products');
        if (!res.ok) {
          throw new Error(`Failed to fetch products: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        setProducts(data.products);
      } catch (error) {
        console.error('Error fetching products:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!initialProducts || initialProducts.length === 0) {
      fetchProducts();
    }
  }, [initialProducts]);

  if (isLoading) {
    return (
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
    );
  }

  if (!products || products.length === 0) {
    return <div>現在、表示できる商品がありません。</div>;
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {products.map((product) => (
        <Link 
          key={product.id} 
          href={`/product/${product.id}`} 
          className="group bg-white"
        >
          <div className="flex flex-col">
            <div className="relative aspect-square mb-3 bg-white">
              <Image
                src={product.images[0] || '/placeholder.svg'}
                alt={product.name}
                fill
                className="object-contain rounded-lg p-2"
              />
            </div>
            <div className="space-y-1 px-1">
              {product.category && (
                <span className="inline-block text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">
                  {product.category}
                </span>
              )}
              <h2 className="text-sm font-medium mt-2 line-clamp-2">
                {product.name}
              </h2>
              <p className="text-base font-bold">
                ¥{product.price.toLocaleString()}
              </p>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

