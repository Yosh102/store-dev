"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { useCart } from "@/lib/CartContext";
import { Lock, Truck, AlertTriangle, ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Product, ProductOption, SelectedOption } from "@/types/product";

type ApiResult =
  | { product: Product }
  | { error: string };

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, getIdToken } = useAuth(); // ★ AuthContext 側で currentUser.getIdToken() をラップしている想定
  const { addItem } = useCart();

  const from = searchParams.get("from");
  const groupSlug = searchParams.get("groupSlug");

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [groupName, setGroupName] = useState<string>("");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [optionErrors, setOptionErrors] = useState<string[]>([]);
  const [authError, setAuthError] = useState<null | 401 | 403>(null);

  const handleGoBack = () => {
    if (from === "group-store" && groupSlug) {
      router.push(`/group/${groupSlug}/store`);
    } else {
      router.push("/store");
    }
  };

  useEffect(() => {
    const run = async () => {
      if (!id) return;
      setLoading(true);
      setAuthError(null);

      try {
        const headers: HeadersInit = {};
        // ログイン済みなら ID トークンを付与（メン限対応）
        try {
          const token = await getIdToken?.();
          if (token) headers["Authorization"] = `Bearer ${token}`;
        } catch {
          // 非ログインの場合は何もしない（公開商品はそのまま取得できる）
        }

        const res = await fetch(`/api/store/products/${id}`, { headers, cache: "no-store" });
        if (res.status === 401 || res.status === 403) {
          setAuthError(res.status as 401 | 403);
          setProduct(null);
          return;
        }
        if (res.status === 404) {
          setProduct(null);
          return;
        }
        if (!res.ok) {
          throw new Error(`Failed: ${res.status}`);
        }
        const json = (await res.json()) as ApiResult;

        if ("product" in json && json.product) {
          const p = json.product;
          setProduct(p);
          document.title = `${p.name} | PLAY TUNE オフィシャルストア`;

          // 表示用: メンバーシップバッジのグループ名（必要なら別API化してもOK）
          if ((p as any).isMembersOnly && Array.isArray((p as any).groups) && (p as any).groups[0]) {
            // ※ ここは必要なら軽量APIに差し替え。ひとまずクライアントで読み飛ばし。
            // setGroupName("メンバー限定");
          }
        } else {
          setProduct(null);
        }
      } catch (e) {
        console.error("fetch product failed", e);
        toast({
          title: "エラー",
          description: "商品の取得に失敗しました。",
          variant: "destructive",
        });
        setProduct(null);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id, getIdToken]);

  const handleOptionChange = (option: ProductOption, valueId: string, valueName: string, priceModifier?: number) => {
    setSelectedOptions((prev) => {
      const filtered = prev.filter((opt) => opt.optionId !== option.id);
      return [...filtered, { optionId: option.id, optionName: option.name, valueId, valueName, priceModifier }];
    });
    setOptionErrors((prev) => prev.filter((err) => err !== option.id));
  };

  const validateOptions = (): boolean => {
    if (!product?.options) return true;
    const errors: string[] = [];
    product.options.forEach((option) => {
      if (option.required && !selectedOptions.find((opt) => opt.optionId === option.id)) {
        errors.push(option.id);
      }
    });
    setOptionErrors(errors);
    return errors.length === 0;
  };

  const calculateTotalPrice = (): number => {
    if (!product) return 0;
    const basePrice = product.price;
    const optionPrice = selectedOptions.reduce((sum, o) => sum + (o.priceModifier || 0), 0);
    return basePrice + optionPrice;
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!validateOptions()) {
      toast({
        title: "選択が必要です",
        description: "必須のオプションを選択してください。",
        variant: "destructive",
      });
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
      selectedOptions,
    });
    toast({ title: "カートに追加しました", description: `${product.name} をカートに追加しました。` });
    setTimeout(() => handleGoBack(), 1000);
  };

  // --- レンダリング ---
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[60vh]">
        <div className="animate-pulse text-gray-500">読み込み中...</div>
      </div>
    );
  }

  // 認可エラー（401/403）
  if (authError && !product) {
    return (
      <div className="container mx-auto px-4 py-8 mt-4">
        <Button variant="ghost" onClick={handleGoBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {from === "group-store" && groupSlug ? "グループストアに戻る" : "ストアに戻る"}
        </Button>

        <h1 className="text-2xl font-bold mb-4">メンバーシップ限定商品</h1>
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 mb-4">
          {authError === 401 ? (
            <>
              <p className="font-bold">ログインが必要です</p>
              <p>この商品を表示するにはログインしてください。</p>
            </>
          ) : (
            <>
              <p className="font-bold">メンバーシップ登録が必要です</p>
              <p>この商品を閲覧するには、メンバーシップへの登録が必要です。</p>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/login")}>ログイン</Button>
          <Button variant="secondary" onClick={() => router.push("/membership")}>メンバーシップに登録</Button>
        </div>
      </div>
    );
  }

  // 404 相当
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[60vh]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">商品が見つかりませんでした</h1>
          <p className="mb-4">お探しの商品は存在しないか、公開期間外の可能性があります。</p>
          <Button onClick={handleGoBack}>
            {from === "group-store" && groupSlug ? "グループストアに戻る" : "ストアに戻る"}
          </Button>
        </div>
      </div>
    );
  }

  // 以降は元の表示ロジック（ほぼ据え置き）
  const maxQty = product.maxQuantity || 10;
  const totalPrice = calculateTotalPrice();
  const hasMultipleImages = product.images && product.images.length > 1;
  const currentImage =
    product.images && product.images.length > 0 ? product.images[currentImageIndex] : "/placeholder.png";

  const incrementQuantity = () => quantity < maxQty && setQuantity(quantity + 1);
  const decrementQuantity = () => quantity > 1 && setQuantity(quantity - 1);
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseInt(e.target.value);
    if (!isNaN(v)) setQuantity(Math.max(1, Math.min(maxQty, v)));
  };
  const nextImage = () => hasMultipleImages && setCurrentImageIndex((i) => (i === product.images.length - 1 ? 0 : i + 1));
  const prevImage = () => hasMultipleImages && setCurrentImageIndex((i) => (i === 0 ? product.images.length - 1 : i - 1));
  const goToImage = (idx: number) => hasMultipleImages && setCurrentImageIndex(idx);

  return (
    <div className="container mx-auto px-4 py-8">
      {/* 戻る */}
      <div className="mb-6">
        <Button variant="ghost" onClick={handleGoBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          {from === "group-store" && groupSlug ? "グループストアに戻る" : "ストアに戻る"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          {/* 画像 */}
          <div className="relative rounded-lg overflow-hidden">
            <div className="aspect-square relative">
              <Image src={currentImage} alt={`${product.name} - 画像 ${currentImageIndex + 1}`} fill className="object-cover" />
            </div>
            {hasMultipleImages && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white/90 p-2 rounded-full shadow-md"
                  aria-label="前の画像"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/70 hover:bg-white/90 p-2 rounded-full shadow-md"
                  aria-label="次の画像"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}
          </div>

          {hasMultipleImages && (
            <div className="flex justify-center mt-4 gap-2 overflow-x-auto py-2">
              {product.images.map((img, index) => (
                <button
                  key={index}
                  onClick={() => goToImage(index)}
                  className={cn(
                    "relative w-16 h-16 border-2 rounded overflow-hidden transition-all",
                    currentImageIndex === index ? "border-gray-500 opacity-100 scale-105" : "border-transparent opacity-70 hover:opacity-100"
                  )}
                >
                  <Image src={img} alt={`${product.name} - サムネイル ${index + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          {(product as any).isMembersOnly && (
            <div className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full",
              "bg-gradient-to-r from-emerald-500 to-sky-500 text-white text-sm font-medium mb-4")}>
              <Lock className="h-4 w-4" />
              <span>{groupName ? `${groupName}メンバーシップ限定` : "メンバーシップ限定"}</span>
            </div>
          )}

          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>

          <div className="flex items-center mb-4">
            <p className="text-2xl font-bold">¥{totalPrice.toLocaleString()}</p>
            {totalPrice !== product.price && (
              <span className="text-gray-500 line-through ml-2">¥{product.price.toLocaleString()}</span>
            )}
            {product.requiresShipping && (
              <div className="ml-2 flex items-center text-gray-500 text-sm">
                <Truck className="h-4 w-4 mr-1" />
                <span>(送料別)</span>
              </div>
            )}
          </div>

          <p className="mb-6">{product.description}</p>

          {/* オプション */}
          {product.options?.length ? (
            <div className="mb-6 space-y-4">
              {product.options.map((option) => (
                <div key={option.id} className="space-y-2">
                  <label className="block font-medium">
                    {option.name}{option.required && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {option.type === "select" && (
                    <select
                      className={cn("w-full p-2 border rounded", optionErrors.includes(option.id) && "border-red-500")}
                      onChange={(e) => {
                        const v = option.values.find((vv) => vv.id === e.target.value);
                        if (v) handleOptionChange(option, v.id, v.name, v.priceModifier);
                      }}
                      defaultValue=""
                    >
                      <option value="" disabled>選択してください</option>
                      {option.values.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}{v.priceModifier && v.priceModifier > 0 && ` (+¥${v.priceModifier})`}
                        </option>
                      ))}
                    </select>
                  )}

                  {option.type === "radio" && (
                    <div className="space-y-2">
                      {option.values.map((v) => (
                        <label key={`${option.id}-${v.id}`} className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name={`option-${option.id}`}
                            value={v.id}
                            onChange={() => handleOptionChange(option, v.id, v.name, v.priceModifier)}
                            className="text-blue-600"
                          />
                          <span>{v.name}{v.priceModifier && v.priceModifier > 0 && ` (+¥${v.priceModifier})`}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {optionErrors.includes(option.id) && (
                    <p className="text-red-500 text-sm">このオプションの選択は必須です</p>
                  )}
                </div>
              ))}
            </div>
          ) : null}

          {/* 数量 */}
          <div className="mb-6">
            <label htmlFor="quantity" className="block mb-2 font-medium">数量:</label>
            <div className="flex items-center">
              <button onClick={decrementQuantity} className="px-3 py-2 border rounded-l bg-gray-100 hover:bg-gray-200" aria-label="数量を減らす">-</button>
              <input
                type="number"
                id="quantity"
                min={1}
                max={maxQty}
                value={quantity}
                onChange={handleQuantityChange}
                className="border-y px-3 py-2 w-16 text-center"
              />
              <button onClick={incrementQuantity} className="px-3 py-2 border rounded-r bg-gray-100 hover:bg-gray-200" aria-label="数量を増やす">+</button>
              <span className="ml-2 text-sm text-gray-500">(最大{maxQty}個まで)</span>
            </div>
          </div>

          {product.requiresShipping && (
            <div className="bg-gray-50 p-3 rounded-lg mb-4 text-sm text-gray-700 flex items-start">
              <Truck className="h-5 w-5 text-gray-500 mr-2 flex-shrink-0 mt-0.5" />
              <p>この商品は配送が必要です。ご購入時に一律¥800の送料がかかります。</p>
            </div>
          )}

          {/* 注意事項（税抜価格の表示は常に表示） */}
          <div className="bg-gray-100 p-4 rounded-lg mb-6">
            <div className="flex items-start mb-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 mr-2 flex-shrink-0 mt-0.5" />
              <h3 className="font-medium">【ご注意事項】</h3>
            </div>
            <div className="text-sm text-gray-700 ml-7">
              {/* 税抜価格の注意書き（常に表示・太字） */}
              <p className="mb-2">
                <span className="font-bold">※表示価格は税抜き価格です。</span>
              </p>
              
              {/* 商品固有の注意事項（product.noticeがあれば表示） */}
              {product.notice && product.notice.split("※").map((item, index) => {
                if (index === 0 && !item.trim()) return null;
                return <p key={index} className="mb-2">{index > 0 ? "※" : ""}{item.trim()}</p>;
              })}
            </div>
          </div>

          <Button onClick={handleAddToCart} size="lg" className="w-full">カートに追加</Button>
        </div>
      </div>
    </div>
  );
}