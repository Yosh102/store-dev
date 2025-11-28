//src/types/address.ts
export interface AddressDetails {
  id: string;
  name: string;
  postalCode: string;
  prefecture: string;
  city: string;
  line1: string;
  line2?: string;
  phoneNumber: string;
  userId?: string; // ユーザーIDをオプショナルプロパティとして追加
  nameKana?: string 

}