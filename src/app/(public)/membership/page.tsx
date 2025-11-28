// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import MembershipClient from './MembershipClient';

export const metadata: Metadata = {
  title: 'メンバーシップについて | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストアのショッピングカート',
  robots: 'noindex',
};

export default function CartPage() {
  return <MembershipClient />;
}