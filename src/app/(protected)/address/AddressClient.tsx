"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import { db, auth } from "@/lib/firebase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Toaster, toast } from "react-hot-toast"
import { Card, CardContent } from "@/components/ui/card"
import { PencilIcon, Trash2Icon, MapPinIcon, PlusIcon, Loader2, AlertCircle, StarIcon } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { AddressDetails } from '@/types/address'
import { fetchWithAuth } from '@/lib/fetch-with-auth' // ✅ 統一ヘルパー使用

export default function AddressManager() {
  const { user: authUser } = useAuth()
  const [addresses, setAddresses] = useState<AddressDetails[]>([])
  const [defaultShippingAddressId, setDefaultShippingAddressId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // モーダル制御用の状態
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  
  // 住所フォーム用の状態
  const [currentAddress, setCurrentAddress] = useState<AddressDetails>({
    id: "",
    name: "",
    postalCode: "",
    prefecture: "",
    city: "",
    line1: "",
    line2: "",
    phoneNumber: "",
  })
  
  // 郵便番号検索の状態
  const [isPostalLoading, setIsPostalLoading] = useState(false)
  const [postalError, setPostalError] = useState<string | null>(null)

  // ✅ 統一fetchヘルパー用のgetIdToken関数
  const getIdToken = async () => {
    const token = await auth.currentUser?.getIdToken()
    if (!token) throw new Error("認証されていません")
    return token
  }

  // 住所一覧とデフォルト住所を取得
  useEffect(() => {
    const fetchAddresses = async () => {
      if (!authUser || !authUser.uid) {
        setLoading(false)
        setError("ユーザーが認証されていません")
        return
      }
      
      setLoading(true)
      try {
        // ✅ fetchWithAuth使用（GETなのでCSRFは不要だが統一感のため使用）
        const addressResponse = await fetchWithAuth(getIdToken, '/api/user/addresses')
        
        if (!addressResponse.ok) {
          const errorData = await addressResponse.json().catch(() => ({}))
          throw new Error(errorData.error || "住所の取得に失敗しました")
        }
        
        const addressData = await addressResponse.json()
        
        // UIに表示する前に必ずユーザーIDをチェック
        const userAddresses = addressData.addresses ? addressData.addresses.filter((address: any) => 
          address.userId === authUser.uid
        ) : [];
        
        setAddresses(userAddresses)

        // デフォルト配送先住所を取得
        const defaultResponse = await fetchWithAuth(getIdToken, '/api/user/default-shipping-address')
        
        if (defaultResponse.ok) {
          const defaultData = await defaultResponse.json()
          setDefaultShippingAddressId(defaultData.defaultAddressId || null)
        } else {
          console.warn('Failed to fetch default shipping address:', defaultResponse.status)
        }
        
      } catch (err) {
        console.error("住所の取得中にエラーが発生しました:", err)
        setError(err instanceof Error ? err.message : "住所の取得に失敗しました")
      } finally {
        setLoading(false)
      }
    }

    fetchAddresses()
  }, [authUser])

  // デフォルト配送先住所を設定
  const setDefaultShippingAddress = async (addressId: string) => {
    if (!authUser) {
      toast.error("ユーザーが認証されていません")
      return
    }
    
    try {
      // ✅ fetchWithAuth使用（自動でCSRF付与）
      const response = await fetchWithAuth(
        getIdToken,
        '/api/user/default-shipping-address',
        {
          method: 'POST',
          body: JSON.stringify({ addressId }),
        }
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "デフォルト住所の設定に失敗しました")
      }
      
      setDefaultShippingAddressId(addressId)
      toast.success("メンバーシップ特典送付用住所を設定しました")
    } catch (err) {
      console.error("デフォルト住所の設定中にエラーが発生しました:", err)
      toast.error(err instanceof Error ? err.message : "デフォルト住所の設定に失敗しました")
    }
  }

  // デフォルト配送先住所を解除
  const removeDefaultShippingAddress = async () => {
    if (!authUser) {
      toast.error("ユーザーが認証されていません")
      return
    }
    
    try {
      // ✅ fetchWithAuth使用（自動でCSRF付与）
      const response = await fetchWithAuth(
        getIdToken,
        '/api/user/default-shipping-address',
        {
          method: 'DELETE',
        }
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "デフォルト住所の解除に失敗しました")
      }
      
      setDefaultShippingAddressId(null)
      toast.success("メンバーシップ特典送付用住所を解除しました")
    } catch (err) {
      console.error("デフォルト住所の解除中にエラーが発生しました:", err)
      toast.error(err instanceof Error ? err.message : "デフォルト住所の解除に失敗しました")
    }
  }

  // 郵便番号から住所を取得する
  const fetchAddressByPostalCode = async (postalCode: string) => {
    if (postalCode.length !== 7) return
    
    setIsPostalLoading(true)
    setPostalError(null)
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`)
      if (!response.ok) {
        throw new Error("郵便番号検索APIへのアクセスに失敗しました")
      }
      
      const data = await response.json()
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0]
        setCurrentAddress(prev => ({
          ...prev,
          prefecture: result.address1,
          city: result.address2,
          line1: result.address3,
        }))
      } else {
        setPostalError("郵便番号に該当する住所が見つかりませんでした")
      }
    } catch (error) {
      console.error("郵便番号検索エラー:", error)
      setPostalError("住所の取得中にエラーが発生しました")
    } finally {
      setIsPostalLoading(false)
    }
  }

  // 住所を追加
  const addAddress = async () => {
    if (!authUser) {
      toast.error("ユーザーが認証されていません")
      return
    }
    
    // バリデーション
    if (!currentAddress.name || !currentAddress.postalCode || !currentAddress.prefecture || 
        !currentAddress.city || !currentAddress.line1 || !currentAddress.phoneNumber) {
      toast.error("必須項目を入力してください")
      return
    }
    
    try {
      const addressWithUserId = {
        ...currentAddress,
        userId: authUser.uid
      }
      
      // ✅ fetchWithAuth使用（自動でCSRF付与）
      const response = await fetchWithAuth(
        getIdToken,
        '/api/user/addresses',
        {
          method: 'POST',
          body: JSON.stringify({ address: addressWithUserId }),
        }
      )
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || "住所の追加に失敗しました")
      }
      
      const result = await response.json()
      
      if (result.address && result.address.userId !== authUser.uid) {
        throw new Error("不正な住所データが返されました")
      }
      
      setAddresses([...addresses, result.address])
      setShowAddDialog(false)
      resetCurrentAddress()
      toast.success("住所を追加しました")
    } catch (err) {
      console.error("住所の追加中にエラーが発生しました:", err)
      toast.error(err instanceof Error ? err.message : "住所の追加に失敗しました")
    }
  }

  // 住所を更新
  // AddressClient.tsx の updateAddress 関数を修正

// 住所を更新
const updateAddress = async () => {
  if (!authUser || !currentAddress.id) {
    toast.error("更新する住所が選択されていません")
    return
  }
  
  // バリデーション
  if (!currentAddress.name || !currentAddress.postalCode || !currentAddress.prefecture || 
      !currentAddress.city || !currentAddress.line1 || !currentAddress.phoneNumber) {
    toast.error("必須項目を入力してください")
    return
  }
  
  try {
    const addressToUpdate = addresses.find(addr => addr.id === currentAddress.id)
    if (!addressToUpdate) {
      throw new Error("更新する住所が見つかりませんでした")
    }
    
    const addressWithUserId = {
      ...currentAddress,
      userId: authUser.uid
    }
    
    // ✅ 修正: URLではなくボディに addressId を含める
    const response = await fetchWithAuth(
      getIdToken,
      '/api/user/addresses', // ← addressId を削除
      {
        method: 'PUT',
        body: JSON.stringify({ 
          addressId: currentAddress.id, // ✅ ボディに addressId を追加
          address: addressWithUserId 
        }),
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "住所の更新に失敗しました")
    }
    
    const result = await response.json()
    
    if (result.address && result.address.userId !== authUser.uid) {
      throw new Error("不正な住所データが返されました")
    }
    
    setAddresses(addresses.map(addr => 
      addr.id === currentAddress.id ? result.address || currentAddress : addr
    ))
    setShowEditDialog(false)
    resetCurrentAddress()
    toast.success("住所を更新しました")
  } catch (err) {
    console.error("住所の更新中にエラーが発生しました:", err)
    toast.error(err instanceof Error ? err.message : "住所の更新に失敗しました")
  }
}
  // 住所を削除
const deleteAddress = async () => {
  if (!authUser || !currentAddress.id) {
    toast.error("削除する住所が選択されていません")
    return
  }
  
  try {
    const addressToDelete = addresses.find(addr => addr.id === currentAddress.id)
    if (!addressToDelete) {
      throw new Error("削除する住所が見つかりませんでした")
    }
    
    if (currentAddress.id === defaultShippingAddressId) {
      const confirmDelete = confirm("この住所はメンバーシップ特典送付用に設定されています。削除してもよろしいですか？")
      if (!confirmDelete) {
        return
      }
    }
    
    // ✅ 修正: URLではなくボディに addressId を含める
    const response = await fetchWithAuth(
      getIdToken,
      '/api/user/addresses', // ← addressId を削除
      {
        method: 'DELETE',
        body: JSON.stringify({ addressId: currentAddress.id }), // ✅ ボディに含める
      }
    )
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "住所の削除に失敗しました")
    }
    
    setAddresses(addresses.filter(addr => addr.id !== currentAddress.id))
    
    if (currentAddress.id === defaultShippingAddressId) {
      setDefaultShippingAddressId(null)
    }
    
    setShowDeleteDialog(false)
    resetCurrentAddress()
    toast.success("住所を削除しました")
  } catch (err) {
    console.error("住所の削除中にエラーが発生しました:", err)
    toast.error(err instanceof Error ? err.message : "住所の削除に失敗しました")
  }
}

  // 編集モードを開始
  const handleEditAddress = (address: AddressDetails) => {
    if (address.userId && address.userId !== authUser?.uid) {
      toast.error("この住所を編集する権限がありません")
      return
    }
    
    setCurrentAddress(address)
    setShowEditDialog(true)
  }

  // 削除モードを開始
  const handleDeleteAddress = (address: AddressDetails) => {
    if (address.userId && address.userId !== authUser?.uid) {
      toast.error("この住所を削除する権限がありません")
      return
    }
    
    setCurrentAddress(address)
    setShowDeleteDialog(true)
  }

  // 住所フォームの入力を処理
  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setCurrentAddress(prev => ({ ...prev, [name]: value }))
    
    if (name === "postalCode" && value.length === 7) {
      fetchAddressByPostalCode(value)
    }
  }

  // 現在の住所データをリセット
  const resetCurrentAddress = () => {
    setCurrentAddress({
      id: "",
      name: "",
      postalCode: "",
      prefecture: "",
      city: "",
      line1: "",
      line2: "",
      phoneNumber: "",
    })
    setPostalError(null)
  }

  // 新規住所追加ダイアログを開く
  const openAddAddressDialog = () => {
    resetCurrentAddress()
    setShowAddDialog(true)
  }

  if (loading) return (
    <div className="container mx-auto px-4 py-8 flex justify-center items-center min-h-[50vh]">
      <div className="flex flex-col items-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <p className="mt-2 text-gray-500">読み込み中...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
          <p className="text-red-500">エラー: {error}</p>
        </div>
      </div>
    </div>
  )

  return (
    <div className="container mx-auto px-4 py-8">
      <Toaster />
      
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-6">住所管理</h1>
        <p className="text-gray-600 mb-6">商品発送や請求書の送付に使用する住所を管理できます</p>
      </div>

      {/* デフォルト住所の説明 */}
      {addresses.length > 0 && (
        <div className="bg-gray-50 p-4 rounded-lg mb-6">
          <div className="flex items-start">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">メンバーシップ特典送付用住所について</h3>
              <p className="text-sm text-gray-700">
                メンバーシップ特典の送付に使用される住所を設定できます。
                {defaultShippingAddressId 
                  ? "現在設定されている住所には★マークが表示されています。" 
                  : "まだ設定されていません。住所の「デフォルトに設定」ボタンから設定してください。"
                }
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 住所一覧 */}
      <div className="space-y-4 mb-8">
        {addresses.length === 0 ? (
          <div className="text-center py-8">
            <MapPinIcon className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500">登録されている住所はありません</p>
          </div>
        ) : (
          addresses.map((address) => (
            <Card key={address.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-start flex-1">
                    <MapPinIcon className="h-5 w-5 mr-3 mt-1 text-gray-400" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <p className="font-medium text-base">{address.name}</p>
                        {address.id === defaultShippingAddressId && (
                          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                            <StarIcon className="h-3 w-3 mr-1" />
                            メンバーシップ特典送付先に設定されています
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">〒{address.postalCode}</p>
                      <p className="text-sm text-gray-600">{address.prefecture}{address.city}{address.line1}</p>
                      {address.line2 && <p className="text-sm text-gray-600">{address.line2}</p>}
                      <p className="text-sm text-gray-600 mt-1">{address.phoneNumber}</p>
                      
                      {/* デフォルト住所設定ボタン */}
                      <div className="mt-3">
                        {address.id === defaultShippingAddressId ? (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={removeDefaultShippingAddress}
                            className="text-xs"
                          >
                            特典送付先解除
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => setDefaultShippingAddress(address.id)}
                            className="text-xs"
                          >
                            <StarIcon className="h-3 w-3 mr-1" />
                            特典送付先に設定
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleEditAddress(address)}
                    >
                      <PencilIcon className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleDeleteAddress(address)}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2Icon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      
      {/* 住所追加ボタン */}
      <Button 
        onClick={openAddAddressDialog}
        className="w-full md:w-auto bg-black hover:bg-gray-700 text-white flex items-center justify-center"
      >
        <PlusIcon className="h-4 w-4 mr-2" />
        住所を追加
      </Button>
      
      {/* 住所追加ダイアログ */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>住所の追加</DialogTitle>
            <DialogDescription>
              新しい配送先住所の情報を入力してください
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">氏名</Label>
              <Input
                id="name"
                name="name"
                value={currentAddress.name}
                onChange={handleAddressChange}
                placeholder="例: 山田 太郎"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="postalCode">郵便番号（ハイフンなし）</Label>
              <div className="relative">
                <Input
                  id="postalCode"
                  name="postalCode"
                  value={currentAddress.postalCode}
                  onChange={handleAddressChange}
                  placeholder="例: 1000001"
                  maxLength={7}
                  required
                />
                {isPostalLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {postalError && (
                <p className="text-sm text-red-500">{postalError}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="prefecture">都道府県</Label>
              <Input
                id="prefecture"
                name="prefecture"
                value={currentAddress.prefecture}
                onChange={handleAddressChange}
                placeholder="例: 東京都"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="city">市区町村</Label>
              <Input
                id="city"
                name="city"
                value={currentAddress.city}
                onChange={handleAddressChange}
                placeholder="例: 千代田区"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="line1">番地</Label>
              <Input
                id="line1"
                name="line1"
                value={currentAddress.line1}
                onChange={handleAddressChange}
                placeholder="例: 千代田1-1"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="line2">建物名・部屋番号（任意）</Label>
              <Input
                id="line2"
                name="line2"
                value={currentAddress.line2 || ""}
                onChange={handleAddressChange}
                placeholder="例: 千代田マンション101"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">電話番号</Label>
              <Input
                id="phoneNumber"
                name="phoneNumber"
                value={currentAddress.phoneNumber}
                onChange={handleAddressChange}
                placeholder="例: 09012345678"
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={addAddress}>
              住所を追加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 住所編集ダイアログ */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>住所の編集</DialogTitle>
            <DialogDescription>
              配送先住所の情報を更新してください
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">氏名</Label>
              <Input
                id="edit-name"
                name="name"
                value={currentAddress.name}
                onChange={handleAddressChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-postalCode">郵便番号（ハイフンなし）</Label>
              <div className="relative">
                <Input
                  id="edit-postalCode"
                  name="postalCode"
                  value={currentAddress.postalCode}
                  onChange={handleAddressChange}
                  maxLength={7}
                  required
                />
                {isPostalLoading && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                  </div>
                )}
              </div>
              {postalError && (
                <p className="text-sm text-red-500">{postalError}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-prefecture">都道府県</Label>
              <Input
                id="edit-prefecture"
                name="prefecture"
                value={currentAddress.prefecture}
                onChange={handleAddressChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-city">市区町村</Label>
              <Input
                id="edit-city"
                name="city"
                value={currentAddress.city}
                onChange={handleAddressChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-line1">番地</Label>
              <Input
                id="edit-line1"
                name="line1"
                value={currentAddress.line1}
                onChange={handleAddressChange}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-line2">建物名・部屋番号（任意）</Label>
              <Input
                id="edit-line2"
                name="line2"
                value={currentAddress.line2 || ""}
                onChange={handleAddressChange}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="edit-phoneNumber">電話番号</Label>
              <Input
                id="edit-phoneNumber"
                name="phoneNumber"
                value={currentAddress.phoneNumber}
                onChange={handleAddressChange}
                required
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              キャンセル
            </Button>
            <Button onClick={updateAddress}>
              更新する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 削除確認ダイアログ */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>住所の削除</DialogTitle>
            <DialogDescription>
              本当にこの住所を削除しますか？この操作は元に戻せません。
              {currentAddress.id === defaultShippingAddressId && (
                <span className="block mt-2 text-yellow-600 font-medium">
                  ※この住所は現在メンバーシップ特典送付用に設定されています
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              キャンセル
            </Button>
            <Button 
              onClick={deleteAddress}
              variant="destructive"
              className="bg-red-500 hover:bg-red-600"
            >
              削除する
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}