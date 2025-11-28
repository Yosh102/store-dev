// src/app/group/[slug]/store/page.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { useCart } from '@/lib/CartContext';
import type { Product, ProductOption, SelectedOption } from '@/types/product';
import type { Group } from '@/types/group';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Lock, ShoppingBag, Grid3X3, List, ArrowLeft, Plus, Minus, ShoppingCart, ArrowRight, ChevronUp } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useParams } from 'next/navigation';

type ViewMode = 'grid' | 'list';
type SortOption = 'newest' | 'oldest' | 'price-low' | 'price-high' | 'name';

const LOAD_STEP = 20;
const NEW_DAYS = 90;
type FilterKey = 'ALL' | 'NEW' | 'FEEL_IT' | 'PINKY' | `CAT:${string}`;

export default function GroupStorePage() {
  const { slug } = useParams();
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // フィルタ（全て/新着/Feel it/Pinky/カテゴリ）
  const [selectedFilter, setSelectedFilter] = useState<FilterKey>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(LOAD_STEP);

  // 並び替え
  const [sortBy, setSortBy] = useState<SortOption>('newest');

  const [hasAccess, setHasAccess] = useState(false);
  const [showToTop, setShowToTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowToTop(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  // グループ情報と商品を取得
  useEffect(() => {
    const fetchGroupAndProducts = async () => {
      if (!slug) return;
      try {
        setLoading(true);

        // グループ
        const groupQuery = query(collection(db, 'groups'), where('slug', '==', slug));
        const groupSnap = await getDocs(groupQuery);
        if (groupSnap.empty) {
          setError('グループが見つかりませんでした');
          return;
        }
        const groupData = { id: groupSnap.docs[0].id, ...groupSnap.docs[0].data() } as Group;
        setGroup(groupData);

        // 商品
        const productsQuery = query(
          collection(db, 'products'),
          where('groups', 'array-contains', groupData.id),
          where('status', '==', 'published')
        );
        const productsSnap = await getDocs(productsQuery);
        const productsData = productsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Product[];

        setProducts(productsData);
        setFilteredProducts(productsData);

        // アクセス権限
        if (user) {
          const hasGroupAccess = (user as any)?.subscriptions?.[groupData.id]?.status === 'active';
          setHasAccess(hasGroupAccess);
        }
      } catch (err) {
        console.error('Error fetching group store data:', err);
        setError('データの取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };
    fetchGroupAndProducts();
  }, [slug, user]);

  // カテゴリ一覧（角丸チップ用）
  const categoryKeys = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      const c = (p.category ?? '').trim();
      if (c) set.add(c);
    });
    return Array.from(set);
  }, [products]);

  // ヘルパー：ProductList と揃える
  const toMillis = (p: Product) =>
    (p.createdAt as any)?.toMillis?.() ??
    ((p.createdAt as any)?.seconds ? (p.createdAt as any).seconds * 1000 : 0);

  const isNew = (p: Product) => {
    const created = toMillis(p);
    if (!created) return false;
    const diffDays = (Date.now() - created) / (1000 * 60 * 60 * 24);
    return diffDays <= NEW_DAYS;
  };
  const isFeelIt = (p: Product) => (p.name || '').toLowerCase().includes('feel it');
  const isPinky  = (p: Product) => (p.name || '').toLowerCase().includes('pinky');

  // フィルタリング＆ソート
  useEffect(() => {
    let base = [...products];

    // フィルタ
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

    // ソート
    base.sort((a, b) => {
      const ta = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const tb = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      switch (sortBy) {
        case 'newest': return tb - ta;
        case 'oldest': return ta - tb;
        case 'price-low': return a.price - b.price;
        case 'price-high': return b.price - a.price;
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

    setFilteredProducts(base);
  }, [products, selectedFilter, sortBy]);

  // フィルタ変更時は「さらに読み込む」をリセット
  useEffect(() => {
    setVisibleCount(LOAD_STEP);
  }, [selectedFilter]);

  // 会員限定の表示制御
  const accessibleProducts = filteredProducts.filter(p => !p.isMembersOnly || hasAccess);
  const canViewProduct = (p: Product) => !p.isMembersOnly || hasAccess;

  // ✅ さらに読み込む用（Hook を早期 return より前に）
  const listToShow = useMemo(
    () => accessibleProducts.slice(0, visibleCount),
    [accessibleProducts, visibleCount]
  );
  const canLoadMore = accessibleProducts.length > visibleCount;

  // 画像URL解決
  const resolveImageUrl = (url?: string) => {
    if (!url) return '/placeholder.svg';
    if (url.includes('firebasestorage.googleapis.com')) return url;
    if (url.startsWith('/')) return url;
    return `/${url}`;
  };

  // フィルタボタン（角丸チップ）
  const FilterButton = ({ label, value }: { label: string; value: FilterKey }) => {
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

  // 早期 return（ここより下で新規 Hook を増やさない）
  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Skeleton className="h-8 w-64 mb-4" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-lg" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">エラーが発生しました</h1>
          <p className="mb-4">{error}</p>
          <Button asChild><Link href="/store">ストアに戻る</Link></Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヒーロー */}
      <div className="relative h-96 overflow-hidden bg-black">
        <div className="relative z-10 flex flex-col justify-between h-full pt-16">
          <div className="pt-4 px-6">
            <div className="container mx-auto">
              <Button variant="ghost" size="sm" asChild className="text-white hover:bg-white/10">
                <Link href={`/group/${group.slug}`}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {group.name}トップページに戻る
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex-1 flex items-center justify-center px-6">
            <div className="text-center max-w-4xl mx-auto">
              {group.logoUrl && (
                <div className="mb-4">
                  <div className="w-20 h-20 mx-auto rounded-full overflow-hidden bg-white/10 backdrop-blur-sm p-3">
                    <Image
                      src={resolveImageUrl(group.logoUrl)}
                      alt={`${group.name} logo`}
                      width={80}
                      height={80}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
              <div className="mb-4">
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-2 tracking-wider">
                  {group.name.toUpperCase()}
                </h1>
                <p className="text-lg md:text-xl text-white/80 font-light tracking-wider">
                  OFFICIAL STORE
                </p>
              </div>
            </div>
          </div>

          {!hasAccess && products.some(p => p.isMembersOnly) && (
            <div className="pb-6 px-6">
              <div className="container mx-auto max-w-2xl">
                <div className="bg-white backdrop-blur-md border border-white/20 rounded-2xl p-4">
                  <div className="flex items-start text-white">
                    <Lock className="h-5 w-5 mr-3 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium mb-1 text-sm">メンバーシップ限定商品があります</p>
                      <p className="text-white/80 text-xs mb-3">
                        {group.name}のメンバーシップに登録すると、限定商品をご購入いただけます。
                      </p>
                      <Button size="sm" className="bg-white text-black hover:bg-white/90 font-medium text-xs" asChild>
                        <Link href={`/group/${group.slug}`}>
                          メンバーシップを見る
                          <ArrowRight className="h-3 w-3 ml-2" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* フィルター・並び替え */}
      <div className="bg-white border-b shadow-sm">
        <div className="container mx-auto px-4 py-6 space-y-4">
          {/* 角丸チップフィルタ */}
          <div className="flex flex-wrap gap-2">
            <FilterButton label="全て" value="ALL" />
            <FilterButton label="新着" value="NEW" />
            <FilterButton label="Feel it" value="FEEL_IT" />
            <FilterButton label="Pinky" value="PINKY" />
            {categoryKeys.map((cat) => (
              <FilterButton key={cat} label={cat} value={`CAT:${cat}`} />
            ))}
          </div>

          {/* 表示切り替え + 並び順 */}
          <div className="flex items-center gap-3">
            <div className="flex border rounded-lg">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 ${viewMode === 'grid' ? 'bg-gray-100' : ''}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 ${viewMode === 'list' ? 'bg-gray-100' : ''}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="border rounded-md px-2 py-1 text-sm"
            >
              <option value="newest">新着順</option>
              <option value="oldest">古い順</option>
              <option value="price-low">価格の安い順</option>
              <option value="price-high">価格の高い順</option>
              <option value="name">名前順</option>
            </select>
          </div>
        </div>
      </div>

      {/* 商品一覧 */}
      <div className="container mx-auto px-4 py-8">
        {accessibleProducts.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">商品が見つかりませんでした</h3>
            <p className="text-gray-500">まだ商品が登録されていません</p>
          </div>
        ) : (
          <>
            <div className={viewMode === 'grid'
              ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6'
              : 'space-y-4'}
            >
              {listToShow.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  group={group}
                  viewMode={viewMode}
                  canView={canViewProduct(product)}
                  showCampaignBadge={isFeelIt(product)} // Feel it のみバッジ
                />
              ))}
            </div>

            {/* さらに読み込む */}
            {canLoadMore && (
              <div className="flex justify-center mt-6">
                <Button variant="outline" className="rounded-full px-6" onClick={() => setVisibleCount((c) => c + LOAD_STEP)}>
                  さらに読み込む
                </Button>
              </div>
            )}
          </>
        )}
      </div>

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

/* =========================
   商品カード
   ========================= */
function ProductCard({
  product,
  group,
  viewMode,
  canView,
  showCampaignBadge,
}: {
  product: Product;
  group: Group;
  viewMode: ViewMode;
  canView: boolean;
  showCampaignBadge: boolean;
}) {
  const isOutOfStock = product.stock === 0;

  if (viewMode === 'list') {
    return (
      <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
        <div className="flex gap-4">
          <div className="w-24 h-24 relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
            <Image
              src={product.images[0] || '/placeholder.svg'}
              alt={product.name}
              fill
              className="object-cover"
            />
            {product.isMembersOnly && (
              <div className="absolute top-1 right-1 bg-black bg-opacity-70 text-white p-1 rounded-full">
                <Lock className="h-3 w-3" />
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-medium text-lg">{product.name}</h3>
                {product.subtitle && <p className="text-gray-600 text-sm">{product.subtitle}</p>}
              </div>
              <div className="text-right">
                <p className="text-xl font-bold">¥{product.price.toLocaleString()}</p>
                {isOutOfStock && <Badge variant="destructive" className="mt-1">売り切れ</Badge>}
              </div>
            </div>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{product.description}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {product.category && <Badge variant="secondary">{product.category}</Badge>}
                {product.requiresShipping && <Badge variant="outline" className="text-xs">配送あり</Badge>}
              </div>
              <div className="flex gap-2">
                <AddToCartModal product={product} canView={canView} isOutOfStock={isOutOfStock} />
                <Button variant="outline" size="sm" asChild disabled={!canView || isOutOfStock}>
                  <Link href={`/product/${product.id}?from=group-store&groupSlug=${group.slug}`}>詳細を見る</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group bg-white rounded-lg overflow-hidden hover:shadow-md transition-shadow flex flex-col h-full">
      <Link
        href={canView ? `/product/${product.id}?from=group-store&groupSlug=${group.slug}` : '#'}
        className={`block ${!canView ? 'cursor-not-allowed opacity-75' : ''}`}
      >
        {/* サムネ（キャンペーンバッジ） */}
        <div className="relative aspect-square mb-0 bg-white rounded-lg overflow-hidden p-2">
          <Image
            src={product.images?.[0] || '/placeholder.svg'}
            alt={product.name}
            fill
            className="object-contain rounded-lg"
          />
          {showCampaignBadge && (
            <span className="absolute top-2 left-2 rounded px-2 py-1 text-[10px] font-bold text-white shadow-sm
                             bg-gradient-to-r from-purple-500 via-purple-600 to-purple-700">
              キャンペーン対象
            </span>
          )}
          {product.isMembersOnly && (
            <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white p-1 rounded-full">
              <Lock className="h-3 w-3" />
            </div>
          )}
          {isOutOfStock && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
              <Badge variant="destructive">売り切れ</Badge>
            </div>
          )}
        </div>
      </Link>

      <div className="p-4 flex flex-col flex-1">
        {product.category && (
          <Badge variant="secondary" className="mb-2 text-xs self-start">
            {product.category}
          </Badge>
        )}
        <h3 className="font-medium mb-1 line-clamp-2">{product.name}</h3>
        {product.subtitle && <p className="text-gray-600 text-sm mb-2 line-clamp-1">{product.subtitle}</p>}
        <div className="flex items-center justify-between mb-3">
          <p className="text-lg font-bold">¥{product.price.toLocaleString()}</p>
          {product.requiresShipping && <Badge variant="outline" className="text-xs">配送あり</Badge>}
        </div>
        <div className="mt-auto">
          {!canView && product.isMembersOnly ? (
            <p className="text-xs text-gray-500">メンバーシップ限定</p>
          ) : (
            <AddToCartModal product={product} canView={canView} isOutOfStock={isOutOfStock} />
          )}
        </div>
      </div>
    </div>
  );
}

/* =========================
   カート追加モーダル
   ========================= */
function AddToCartModal({
  product,
  canView,
  isOutOfStock
}: {
  product: Product;
  canView: boolean;
  isOutOfStock: boolean;
}) {
  const { addItem } = useCart();
  const [isOpen, setIsOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [optionErrors, setOptionErrors] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedOptions([]);
      setOptionErrors([]);
    }
  }, [isOpen]);

  const handleOptionChange = (option: ProductOption, valueId: string, valueName: string, priceModifier?: number) => {
    setSelectedOptions(prev => {
      const filtered = prev.filter(opt => opt.optionId !== option.id);
      return [...filtered, { optionId: option.id, optionName: option.name, valueId, valueName, priceModifier }];
    });
    setOptionErrors(prev => prev.filter(err => err !== option.id));
  };

  const validateOptions = () => {
    if (!product?.options) return true;
    const errors: string[] = [];
    product.options.forEach(o => {
      if (o.required && !selectedOptions.find(s => s.optionId === o.id)) errors.push(o.id);
    });
    setOptionErrors(errors);
    return errors.length === 0;
  };

  const calculateTotalPrice = () => {
    const optionPrice = selectedOptions.reduce((sum, s) => sum + (s.priceModifier || 0), 0);
    return product.price + optionPrice;
  };

  const handleAddToCart = () => {
    if (!validateOptions()) {
      toast({ title: '選択が必要です', description: '必須のオプションを選択してください。', variant: 'destructive' });
      return;
    }
    const totalPrice = calculateTotalPrice();
    addItem({
      id: product.id,
      name: product.name,
      price: totalPrice,
      quantity,
      images: product.images,
      requiresShipping: product.requiresShipping,
      selectedOptions
    });
    toast({ title: 'カートに追加しました', description: `${product.name} をカートに追加しました。` });
    setIsOpen(false);
  };

  const maxQty = product.maxQuantity || 10;
  const totalPrice = calculateTotalPrice();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button className="w-full bg-black hover:bg-gray-800 text-white" disabled={!canView || isOutOfStock} size="sm">
          <ShoppingCart className="h-4 w-4 mr-2" />
          カートに追加
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>カートに追加</DialogTitle></DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="w-20 h-20 relative rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
              <Image src={product.images[0] || '/placeholder.svg'} alt={product.name} fill className="object-cover" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium">{product.name}</h3>
              {product.subtitle && <p className="text-gray-600 text-sm">{product.subtitle}</p>}
              <div className="flex items-center mt-1">
                <p className="text-lg font-bold">¥{totalPrice.toLocaleString()}</p>
                {totalPrice !== product.price && (
                  <span className="text-gray-500 ml-2 text-sm">(+オプション)</span>
                )}
              </div>
            </div>
          </div>

          {product.options && product.options.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-medium">オプションを選択</h4>
              {product.options.map((option) => (
                <div key={option.id} className="space-y-2">
                  <label className="block font-medium text-sm">
                    {option.name}{option.required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  <div className={cn(optionErrors.includes(option.id) && 'border-red-500')}>
                    {option.type === 'radio' ? (
                      <div className="space-y-2">
                        {option.values.map((v) => (
                          <label key={`${option.id}-${v.id}`} className="flex items-center space-x-2">
                            <input
                              type="radio"
                              name={`option-${option.id}`}
                              value={v.id}
                              onChange={() => handleOptionChange(option, v.id, v.name, v.priceModifier)}
                            />
                            <span className="text-sm">
                              {v.name}{v.priceModifier ? ` (+¥${v.priceModifier})` : ''}
                            </span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <select
                        className="w-full border rounded-md px-2 py-2"
                        defaultValue=""
                        onChange={(e) => {
                          const v = option.values.find(x => x.id === e.target.value);
                          if (v) handleOptionChange(option, v.id, v.name, v.priceModifier);
                        }}
                      >
                        <option value="" disabled>選択してください</option>
                        {option.values.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.name}{v.priceModifier ? ` (+¥${v.priceModifier})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {optionErrors.includes(option.id) && (
                    <p className="text-red-500 text-sm">このオプションの選択は必須です</p>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="block font-medium text-sm">数量</label>
            <div className="flex items-center space-x-3">
              <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1} className="h-8 w-8">
                <Minus className="h-4 w-4" />
              </Button>
              <span className="min-w-[3rem] text-center font-medium">{quantity}</span>
              <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} disabled={quantity >= maxQty} className="h-8 w-8">
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-sm text-gray-500">(最大{maxQty}個)</span>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex justify-between items-center mb-2">
              <span>小計:</span>
              <span className="font-bold">¥{(totalPrice * quantity).toLocaleString()}</span>
            </div>
            {product.requiresShipping && <p className="text-xs text-gray-500">※配送料は別途¥800かかります</p>}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setIsOpen(false)} className="flex-1">キャンセル</Button>
            <Button onClick={handleAddToCart} className="flex-1 bg-black hover:bg-gray-800 text-white">カートに追加</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
