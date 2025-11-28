import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AddressDetails } from '@/types/address';
import { MapPin, Plus, Loader2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/context/auth-context';
import { toast } from 'react-hot-toast';

interface AddressSelectionProps {
  onSelect: (address: AddressDetails) => void;
}

export default function AddressSelection({ onSelect }: AddressSelectionProps) {
  const { user } = useAuth(); 
  const [addresses, setAddresses] = useState<AddressDetails[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newAddress, setNewAddress] = useState<AddressDetails>({
    id: '',
    name: '',
    postalCode: '',
    prefecture: '',
    city: '',
    line1: '',
    line2: '',
    phoneNumber: '',
  });

  useEffect(() => {
    fetchAddresses();
  }, [user]); // user依存関係を追加してユーザー変更時に再取得

  const fetchAddresses = async () => {
    if (!user) return; 
    setLoading(true);
    
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('認証されていません');
      }
  
      const response = await fetch('/api/user/addresses', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('住所の取得に失敗しました');
      }
      
      const data = await response.json();
      
      // 現在のユーザーの住所のみフィルタリング
      const userAddresses = data.addresses.filter((address: AddressDetails & { userId?: string }) => 
        !address.userId || address.userId === user.uid
      );
      
      setAddresses(userAddresses);
    } catch (error) {
      console.error('住所の取得中にエラーが発生しました:', error);
      toast.error('住所の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleAddressSelect = (addressId: string) => {
    // 選択された住所が現在のユーザーのものか確認
    const selected = addresses.find(addr => addr.id === addressId);
    if (selected) {
      setSelectedAddress(addressId);
      onSelect(selected);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        throw new Error('認証されていません');
      }
      
      // 明示的にユーザーIDを含める
      const addressWithUserId = {
        ...newAddress,
        userId: user.uid // ユーザーIDを明示的に追加
      };
      
      const response = await fetch('/api/user/addresses', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ address: addressWithUserId }),
      });
  
      if (!response.ok) {
        throw new Error('住所の追加に失敗しました');
      }
  
      const result = await response.json();
      
      // サーバーから返された住所のユーザーIDを確認
      if (result.address.userId && result.address.userId !== user.uid) {
        throw new Error('不正な住所データが返されました');
      }
      
      // サーバーから返された IDを持つ住所を使用
      setAddresses([...addresses, result.address]);
      
      // 新しく追加された住所を自動選択
      handleAddressSelect(result.address.id);
      setShowAddForm(false);
      
      // フォームをリセット
      setNewAddress({
        id: '',
        name: '',
        postalCode: '',
        prefecture: '',
        city: '',
        line1: '',
        line2: '',
        phoneNumber: '',
      });
      
      toast.success('住所を追加しました');
    } catch (error) {
      console.error('住所の追加中にエラーが発生しました:', error);
      toast.error('住所の追加に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // 郵便番号から住所情報を取得する関数
  const fetchAddressByPostalCode = async (postalCode: string) => {
    if (postalCode.length !== 7) return;
    
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
      const data = await response.json();
      
      if (data.results) {
        const result = data.results[0];
        setNewAddress(prev => ({
          ...prev,
          prefecture: result.address1,
          city: result.address2,
          line1: result.address3,
        }));
        
        toast.success('住所情報を取得しました');
      } else {
        toast.error('郵便番号に該当する住所が見つかりませんでした');
      }
    } catch (error) {
      console.error('住所情報の取得中にエラーが発生しました:', error);
      toast.error('住所情報の取得に失敗しました');
    }
  };

  // 郵便番号入力時の処理
  const handlePostalCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const postalCode = e.target.value;
    setNewAddress({ ...newAddress, postalCode });
    
    // 7桁入力されたら自動的に住所検索
    if (postalCode.length === 7) {
      fetchAddressByPostalCode(postalCode);
    }
  };

  return (
    <div className="space-y-4">
      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
        </div>
      )}
      
      {!loading && addresses.length === 0 ? (
        <div className="text-center py-6">
          <MapPin className="h-12 w-12 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-500">登録されている住所はありません</p>
        </div>
      ) : (
        addresses.map((address) => (
          <Card
            key={address.id}
            className={`cursor-pointer transition-all duration-200 ${
              selectedAddress === address.id ? 'border-2 border-black bg-gray-100' : 'border border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => handleAddressSelect(address.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-start">
                <MapPin className="mr-2 mt-1 flex-shrink-0" />
                <div>
                  <p className="font-medium">{address.name}</p>
                  <p className="text-sm text-gray-600">{address.postalCode}</p>
                  <p className="text-sm text-gray-600">{`${address.prefecture}${address.city}${address.line1}${address.line2 || ''}`}</p>
                  <p className="text-sm text-gray-600">{address.phoneNumber}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {!showAddForm && (
        <Button
          onClick={() => setShowAddForm(true)}
          variant="outline"
          className="w-full border-dashed border-2"
          disabled={loading}
        >
          <Plus className="mr-2" />
          新しい住所を追加
        </Button>
      )}

      {showAddForm && (
        <form onSubmit={handleAddAddress} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">氏名</Label>
            <Input
              id="name"
              value={newAddress.name}
              onChange={(e) => setNewAddress({ ...newAddress, name: e.target.value })}
              required
              disabled={loading}
              className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">郵便番号（ハイフンなし）</Label>
            <Input
              id="postalCode"
              value={newAddress.postalCode}
              onChange={handlePostalCodeChange}
              required
              maxLength={7}
              placeholder="1000001"
              disabled={loading}
              className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prefecture">都道府県</Label>
            <Input
              id="prefecture"
              value={newAddress.prefecture}
              onChange={(e) => setNewAddress({ ...newAddress, prefecture: e.target.value })}
              required
              disabled={loading}
              className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">市区町村</Label>
            <Input
              id="city"
              value={newAddress.city}
              onChange={(e) => setNewAddress({ ...newAddress, city: e.target.value })}
              required
              disabled={loading}
              className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line1">番地</Label>
            <Input
              id="line1"
              value={newAddress.line1}
              onChange={(e) => setNewAddress({ ...newAddress, line1: e.target.value })}
              required
              disabled={loading}
              className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="line2">建物名・部屋番号（任意）</Label>
            <Input
              id="line2"
              value={newAddress.line2}
              onChange={(e) => setNewAddress({ ...newAddress, line2: e.target.value })}
              disabled={loading}
              className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phoneNumber">電話番号</Label>
            <Input
              id="phoneNumber"
              value={newAddress.phoneNumber}
              onChange={(e) => setNewAddress({ ...newAddress, phoneNumber: e.target.value })}
              required
              disabled={loading}
              className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5]"
            />
          </div>
          <div className="flex space-x-2">
            <Button 
              type="submit" 
              className="flex-1"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : '住所を追加'}
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setShowAddForm(false)} 
              className="flex-1"
              disabled={loading}
            >
              キャンセル
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}