//src/app/(protected)/cart/CartClient.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/lib/CartContext';
import { useAuth } from '@/context/auth-context';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Trash2, Plus, Minus, Truck, Tag } from 'lucide-react';
import PlayTuneBackButton from '@/components/group/PlayTuneBackButton';

export default function CartClient() {
  // CartContext の計算関数を利用
  const { items, removeItem, updateQuantity, getSubtotal, getShippingFee, getTotal, needsShipping } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const [coupon, setCoupon] = useState('');
  const [discount, setDiscount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ── 税率定義 ───────────────────────────────
  const TAX_RATE = 0.1; // 10%消費税

  // ── キャンペーン定義 ───────────────────────────────
  const CAMPAIGN_TITLE = '【Feel it リリース記念キャンペーン実施中！】';
  const PERK_THRESHOLD = 5000;      // 特典（サイン入りトレカ）※税抜基準
  const FREESHIP_THRESHOLD = 10000; // 送料無料※税抜基準
  const SHIPPING_FEE = 800;         // 送料（一律800円・税込）

  const hasShippingAny = needsShipping();

  // 「Feel it」判定（商品名 or tags に 'feel it' を含む）
  const hasFeelItItem = false;

  // ── 金額計算 ──────────────────────
  const subtotalExcludingTax = getSubtotal();  // 商品小計（税抜）
  const taxAmount = Math.round(subtotalExcludingTax * TAX_RATE);  // 消費税額
  const subtotalIncludingTax = subtotalExcludingTax + taxAmount;  // 商品小計（税込）

  // キャンペーン達成判定（税抜金額で判定）
  const qualifiesPerk = hasFeelItItem && subtotalExcludingTax >= PERK_THRESHOLD;
  const qualifiesFreeShip = hasShippingAny && hasFeelItItem && subtotalExcludingTax >= FREESHIP_THRESHOLD;

  // 表示上の送料（送料無料達成時は 0、それ以外は800円固定）
  const displayedShipping = hasShippingAny ? (qualifiesFreeShip ? 0 : SHIPPING_FEE) : 0;

  // 表示用合計（割引考慮）
  const finalTotal = Math.max(0, (subtotalIncludingTax + displayedShipping) - discount);

  // しきい値までの残額（税抜基準）
  const perkRemaining = Math.max(0, PERK_THRESHOLD - subtotalExcludingTax);
  const shipRemaining = Math.max(0, FREESHIP_THRESHOLD - subtotalExcludingTax);

  // カートアイテムの一意キー（既存ロジック踏襲）
  const getUniqueItemKey = (item: any): string => {
    const optionsKey = item.selectedOptions 
      ? item.selectedOptions
          .sort((a: any, b: any) => a.optionId.localeCompare(b.optionId))
          .map((opt: any) => `${opt.optionId}:${opt.valueId}`)
          .join('|')
      : '';
    return `${item.id}${optionsKey ? `_${optionsKey}` : ''}`;
  };

  // オプション表示
  const formatSelectedOptions = (selectedOptions?: any[]) => {
    if (!selectedOptions || selectedOptions.length === 0) return null;
    return selectedOptions.map(opt => `${opt.optionName}: ${opt.valueName}`).join(', ');
  };

  // 基本価格（オプション除く）※税抜
  const getBasePrice = (item: any) => {
    if (!item.selectedOptions || item.selectedOptions.length === 0) return item.price;
    const optionPrice = item.selectedOptions.reduce((total: number, opt: any) => total + (opt.priceModifier || 0), 0);
    return item.price - optionPrice;
  };

  // 税額を計算
  const calculateTax = (price: number) => Math.round(price * TAX_RATE);
  
  // 税込価格を計算（税抜 + 税額）
  const getTaxIncludedPrice = (price: number) => price + calculateTax(price);

  const handleQuantityChange = (uniqueKey: string, newQuantity: number) => {
    if (newQuantity > 0) updateQuantity(uniqueKey, newQuantity);
  };

  const handleRemoveItem = (uniqueKey: string) => {
    removeItem(uniqueKey);
  };

  const handleApplyCoupon = () => {
    if (coupon === 'DISCOUNT10') {
      setDiscount(subtotalIncludingTax * 0.1); // 割引は税込小計基準
      setErrorMessage(null);
    } else {
      setDiscount(0);
      setErrorMessage('無効なクーポンコードです');
    }
  };

  const handleProceedToCheckout = () => {
    if (user) router.push('/checkout');
    else router.push('/login?redirect=checkout');
  };

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">カート</h1>
        <p>カートは空です。<Link href="/store" className="text-blue-500 hover:underline">買い物を続ける</Link></p>
      </div>
    );
  }

  const showShippingRow = hasShippingAny; // 配送がある時だけ送料行を表示
  const isFreeShipping = showShippingRow && displayedShipping === 0;

  return (
    <>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">カート</h1>

        {errorMessage && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">
            <span className="block sm:inline">{errorMessage}</span>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardContent className="p-4">
                <h2 className="text-xl font-semibold mb-4">カート内の商品</h2>
                {items.map((item) => {
                  const optionsText = formatSelectedOptions(item.selectedOptions);
                  const basePrice = getBasePrice(item);
                  const basePriceTaxIncluded = getTaxIncludedPrice(basePrice);
                  const itemPriceTaxIncluded = getTaxIncludedPrice(item.price);
                  const hasOptions = item.selectedOptions && item.selectedOptions.length > 0;
                  const uniqueKey = getUniqueItemKey(item);

                  return (
                    <div key={uniqueKey} className="flex items-start mb-4 border-b pb-4">
                      <div className="w-20 h-20 relative mr-4 flex-shrink-0">
                        <Image
                          src={item.images?.[0] || '/placeholder.png'}
                          alt={item.name}
                          fill
                          sizes="(max-width: 80px) 100vw, 80px"
                          className="rounded-md object-cover"
                        />
                      </div>
                      <div className="flex-grow">
                        <h3 className="font-medium">{item.name}</h3>
                        
                        {/* オプション情報 */}
                        {optionsText && (
                          <div className="flex items-center text-sm text-gray-600 mt-1 mb-2">
                            <Tag className="h-3 w-3 mr-1" />
                            <span>{optionsText}</span>
                          </div>
                        )}

                        {/* 価格表示（税込） */}
                        <div className="flex items-center">
                          {hasOptions ? (
                            <div className="text-sm">
                              <div className="flex items-center">
                                <span className="font-medium">¥{itemPriceTaxIncluded.toLocaleString()}</span>
                                <span className="text-gray-500 ml-2 text-xs">
                                  (基本価格: ¥{basePriceTaxIncluded.toLocaleString()})
                                </span>
                              </div>
                              <div className="text-xs text-gray-500 mt-0.5">税込</div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-sm font-medium">¥{itemPriceTaxIncluded.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">税込</p>
                            </div>
                          )}
                          
                          {/* 配送表示 */}
                          {item.requiresShipping && (
                            <span className="ml-2 text-xs text-gray-500 flex items-center">
                              <Truck className="h-3 w-3 mr-1" />
                              配送が必要な商品
                            </span>
                          )}
                        </div>

                        {/* 数量コントロール */}
                        <div className="flex items-center mt-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleQuantityChange(uniqueKey, item.quantity - 1)}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="mx-2">{item.quantity}</span>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleQuantityChange(uniqueKey, item.quantity + 1)}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="font-medium">¥{(itemPriceTaxIncluded * item.quantity).toLocaleString()}</p>
                        {hasOptions && (
                          <p className="text-xs text-gray-500">
                            ¥{basePriceTaxIncluded.toLocaleString()} × {item.quantity}
                            {item.selectedOptions?.some((opt: any) => opt.priceModifier > 0) && 
                              ` + オプション料金`
                            }
                          </p>
                        )}
                        <p className="text-xs text-gray-500">税込</p>
                        <Button
                          variant="ghost"
                          onClick={() => handleRemoveItem(uniqueKey)}
                          className="text-red-500 mt-2"
                        >
                          <Trash2 size={20} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-4">
                <h2 className="text-xl font-semibold mb-4">注文サマリー</h2>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>小計（税抜）</span>
                    <span>¥{subtotalExcludingTax.toLocaleString()}</span>
                  </div>

                  {/* 消費税 */}
                  <div className="flex justify-between">
                    <span>消費税（10%）</span>
                    <span>¥{taxAmount.toLocaleString()}</span>
                  </div>

                  {/* 送料（800円固定・税込） */}
                  {showShippingRow && (
                    <div className="flex justify-between items-center">
                      <span className="flex items-center">
                        <Truck className="h-4 w-4 mr-1" />
                        送料
                      </span>
                      <span>
                        {isFreeShipping ? (
                          <span className="text-green-600 font-medium">¥0（キャンペーン送料無料）</span>
                        ) : (
                          <>¥{displayedShipping.toLocaleString()}</>
                        )}
                      </span>
                    </div>
                  )}

                  {/* 割引表示（あれば） */}
                  {discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>割引</span>
                      <span>- ¥{discount.toLocaleString()}</span>
                    </div>
                  )}

                  {/* 合計 */}
                  <div className="flex justify-between font-bold text-lg pt-2 border-t">
                    <span>合計</span>
                    <span>¥{finalTotal.toLocaleString()}</span>
                  </div>

                </div>

                {/* クーポン入力 */}
                <div className="mt-4">
                  <label htmlFor="coupon" className="block text-sm font-medium text-gray-700 mb-1">
                    クーポンコード
                  </label>
                  <div className="flex space-x-2">
                    <Input
                      type="text"
                      id="coupon"
                      value={coupon}
                      onChange={(e) => setCoupon(e.target.value)}
                      placeholder="クーポンコードを入力"
                      className="flex-grow h-10 bg-gray-100 border-0 focus:ring-2 focus:ring-[#5CD1E5] h-12"
                    />
                    <Button onClick={handleApplyCoupon} className="h-12">適用</Button>
                  </div>
                </div>

                <Button
                  onClick={handleProceedToCheckout}
                  className="w-full mt-4 bg-black hover:bg-gray-800 text-white"
                >
                  レジへ進む
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <PlayTuneBackButton />
    </>
  );
}