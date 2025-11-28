// app/(protected)/cart/page.tsx
import { Metadata } from 'next';
import PostClient from './PostClient';

export const metadata: Metadata = {
  title: '記事 | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
  robots: 'noindex',
};

export default function GroupListPage() {
  return <PostClient />;
}