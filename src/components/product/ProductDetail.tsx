'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { useCart } from '@/lib/CartContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Share2 } from 'lucide-react';
import { Product } from '@/types/product';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/context/auth-context';

async function getProduct(id: string) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const url = new URL(`/api/store/products/${id}`, baseUrl);

  try {
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`Failed to fetch product: ${res.status} ${res.statusText}`);
    }
    return res.json();
  } catch (error) {
    console.error('Error fetching product:', error);
    throw error;
  }
}

export default function ProductDetail({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const { addItem } = useCart();
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await getProduct(id);
        setProduct(data.product);
      } catch (err) {
        setError('商品の取得に失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleQuantityChange = (delta: number) => {
    if (product) {
      const maxQuantity = Math.min(product.maxQuantity || 10, 10);
      const newQuantity = Math.max(1, Math.min(maxQuantity, quantity + delta));
      setQuantity(newQuantity);
    }
  };

  const handleAddToCart = () => {
    if (product) {
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        images: product.images // 画像の配列を追加
      });
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      router.push('/login');
      return;
    }
  
    if (product) {
      addItem({
        id: product.id,
        name: product.name,
        price: product.price,
        quantity: quantity,
        images: product.images // 画像の配列を追加
      });
      router.push('/checkout');
    }
  };

  if (isLoading) {
    return <ProductDetailSkeleton />;
  }

  if (error || !product) {
    return <div className="text-center py-10">{error || '商品が見つかりません。'}</div>;
  }

  const productImage = product.images?.[0] || '/placeholder.svg';
  const maxQuantity = Math.min(product.maxQuantity || 10, 10);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Left Column - Image */}
        <div className="relative">
          {product.label && (
            <div className="absolute top-4 left-4 z-10 text-xl font-bold">
              {product.label}
            </div>
          )}
          <div className="aspect-square relative">
            <Image
              src={productImage}
              alt={product.name || '商品画像'}
              fill
              className="object-contain p-8"
            />
          </div>
        </div>

        {/* Right Column - Product Details */}
        <div className="space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold">{product.name}</h1>
              {product.subtitle && <h2 className="text-xl">{product.subtitle}</h2>}
            </div>
            <button className="text-gray-500">
              <Share2 className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-2xl font-bold">
              ¥{product.price.toLocaleString()}(税込)
            </div>
            {product.shopCash && (
              <div className="text-sm text-blue-600">
                最大{product.shopCash}Weverse Shop Cash
              </div>
            )}
          </div>

          <div className="border rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span>{product.subtitle || product.name}</span>
              <span>¥{product.price.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button 
                  className="w-8 h-8 flex items-center justify-center border rounded"
                  onClick={() => handleQuantityChange(-1)}
                >
                  -
                </button>
                <span>{quantity}</span>
                <button 
                  className="w-8 h-8 flex items-center justify-center border rounded"
                  onClick={() => handleQuantityChange(1)}
                >
                  +
                </button>
              </div>
              <span className="font-bold">¥{(product.price * quantity).toLocaleString()}</span>
            </div>
          </div>

          <div className="text-sm">
            {quantity}個選択<br />
            最大{maxQuantity}個までご購入いただけます。
          </div>

          <div className="flex gap-4">
            <Button
              variant="secondary"
              className="flex-1 h-12"
              onClick={handleAddToCart}
            >
              カートに入れる
            </Button>
            <Button
              className="flex-1 h-12 bg-black hover:bg-gray-800 text-white"
              onClick={handleBuyNow}
            >
              今すぐ購入
            </Button>
          </div>

          <div className="flex items-center gap-2 text-gray-600">
            <span className="w-4 h-4 rounded-full border-2 border-gray-600 flex items-center justify-center">
              !
            </span>
            お届け先が登録されていません。
          </div>
        </div>
      </div>

      {/* Tabs moved below the image */}
      <div className="mt-8">
        <Tabs defaultValue="details" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="details" className="text-lg">詳細情報</TabsTrigger>
            <TabsTrigger value="notes" className="text-lg">注意事項</TabsTrigger>
          </TabsList>
          <TabsContent value="details" className="mt-4">
            <div className="bg-gray-50 p-6 rounded-lg space-y-2">
              {Array.isArray(product.description) ? (
                product.description.map((line, index) => (
                  <p key={index} className="text-sm">
                    {line}
                  </p>
                ))
              ) : (
                <p className="text-sm">{product.description || '商品の説明はありません。'}</p>
              )}
            </div>
          </TabsContent>
          <TabsContent value="notes" className="mt-4">
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-sm">
                注意事項がここに表示されます。
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <Skeleton className="aspect-square w-full" />
        <div className="space-y-6">
          <div className="flex justify-between">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-8 w-8" />
          </div>
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <div className="flex gap-4">
            <Skeleton className="h-12 flex-1" />
            <Skeleton className="h-12 flex-1" />
          </div>
          <Skeleton className="h-6 w-full" />
        </div>
      </div>
      <Skeleton className="h-12 w-full mt-8" />
      <Skeleton className="h-40 w-full mt-4" />
    </div>
  );
}

