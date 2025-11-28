import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';

interface AddressFormProps {
  onSubmit: (address: {
    name: string;
    postalCode: string;
    prefecture: string;
    city: string;
    line1: string;
    line2?: string;
    phoneNumber: string;
  }) => void;
  onCancel: () => void;
}

const AddressForm: React.FC<AddressFormProps> = ({ onSubmit, onCancel }) => {
  const [address, setAddress] = useState({
    name: '',
    postalCode: '',
    prefecture: '',
    city: '',
    line1: '',
    line2: '',
    phoneNumber: '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddress((prev) => ({ ...prev, [name]: value }));
    if (name === 'postalCode' && value.length === 7) {
      fetchAddress(value);
    }
  };

  const fetchAddress = async (postalCode: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postalCode}`);
      const data = await response.json();
      if (data.results) {
        const result = data.results[0];
        setAddress((prev) => ({
          ...prev,
          prefecture: result.address1,
          city: result.address2,
          line1: result.address3,
        }));
      } else {
        setError('郵便番号に該当する住所が見つかりませんでした。');
      }
    } catch (error) {
      setError('住所の取得中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(address);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="name">氏名</Label>
        <Input
          id="name"
          name="name"
          value={address.name}
          onChange={handleChange}
          required
          className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5] h-32 resize-none text-[14px]"
        />
      </div>
      <div>
        <Label htmlFor="postalCode">郵便番号（ハイフンなし）</Label>
        <Input
          id="postalCode"
          name="postalCode"
          value={address.postalCode}
          onChange={handleChange}
          required
          maxLength={7}
          className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5] h-32 resize-none text-[14px]"
        />
      </div>
      {isLoading && <Loader2 className="animate-spin" />}
      {error && <p className="text-red-500 text-sm">{error}</p>}
      <div>
        <Label htmlFor="prefecture">都道府県</Label>
        <Input
          id="prefecture"
          name="prefecture"
          value={address.prefecture}
          onChange={handleChange}
          required
          className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5] h-32 resize-none text-[14px]"
        />
      </div>
      <div>
        <Label htmlFor="city">市区町村</Label>
        <Input
          id="city"
          name="city"
          value={address.city}
          onChange={handleChange}
          required
          className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5] h-32 resize-none text-[14px]"
        />
      </div>
      <div>
        <Label htmlFor="line1">番地</Label>
        <Input
          id="line1"
          name="line1"
          value={address.line1}
          onChange={handleChange}
          required
          className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5] h-32 resize-none text-[14px]"
        />
      </div>
      <div>
        <Label htmlFor="line2">建物名・部屋番号（任意）</Label>
        <Input
          id="line2"
          name="line2"
          value={address.line2}
          onChange={handleChange}
          className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5] h-32 resize-none text-[14px]"
        />
      </div>
      <div>
        <Label htmlFor="phoneNumber">電話番号</Label>
        <Input
          id="phoneNumber"
          name="phoneNumber"
          value={address.phoneNumber}
          onChange={handleChange}
          required
          className="w-full pl-4 pr-4 py-3 mt-2 bg-gray-100 border-0 rounded-lg focus:ring-2 focus:ring-[#5CD1E5] h-32 resize-none text-[14px]"
        />
      </div>
      <div className="flex justify-end space-x-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          キャンセル
        </Button>
        <Button type="submit">保存</Button>
      </div>
    </form>
  );
};

export default AddressForm;

