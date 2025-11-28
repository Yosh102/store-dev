import { Suspense } from 'react';
import ProductList from '../product/ProductList';
import ProductListSkeleton from '../product/ProductDetailSkeleton';

export default function StorePage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">ストア</h1>
      <Suspense fallback={<ProductListSkeleton />}>
        <ProductList />
      </Suspense>
    </div>
  );
}

