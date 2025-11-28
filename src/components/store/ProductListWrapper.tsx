'use client';

import { useState } from 'react';
import ProductList from '@/components/product/ProductListStore';
import GroupProductList from '@/components/store/GroupProductList';
import { Button } from '@/components/ui/button';
import { Grid, Layers } from 'lucide-react';

interface ProductListWrapperProps {
  initialProducts?: any[];
  initialGroups?: any[];
  title?: string;
  showAllLink?: boolean;
  allProductsLink?: string;
}

export default function ProductListWrapper({
  initialProducts,
  initialGroups,
  title,
  showAllLink = false,
  allProductsLink = "/store"
}: ProductListWrapperProps) {
  // Default to grouped view as shown in the reference image
  const [viewMode, setViewMode] = useState<'regular' | 'grouped'>('grouped');

  return (
    <div>
      {/* View toggle buttons - アイコンのみのスタイリッシュなバージョン
      <div className="flex justify-end p-4">
        <div className="flex space-x-2 bg-gray-100 p-1 rounded-full shadow-sm">
          <button
            className={`p-2 rounded-full transition-all ${viewMode === 'grouped' ? 'bg-gray-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-400'}`}
            onClick={() => setViewMode('grouped')}
            aria-label="メイン表示"
            title="メイン表示"
          >
            <Layers className="h-5 w-5" />
          </button>
          <button
            className={`p-2 rounded-full transition-all ${viewMode === 'regular' ? 'bg-gray-200' : 'bg-gray-100 text-gray-700 hover:bg-gray-400'}`}
            onClick={() => setViewMode('regular')}
            aria-label="一覧表示"
            title="一覧表示"
          >
            <Grid className="h-5 w-5" />
          </button>
        </div>
      </div> */}

      {/* Render the appropriate view based on viewMode */}
      {/* {viewMode === 'regular' ? ( */}
        <ProductList
          initialProducts={initialProducts}
          title={title}
          showAllLink={showAllLink}
          allProductsLink={allProductsLink}
        />
      {/* // ) : (
      //   <GroupProductList
      //     initialProducts={initialProducts}
      //     initialGroups={initialGroups}
      //   />
      // )}*/}
    </div>
  );
}