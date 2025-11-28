import StorePage from '@/components/store/StorePage';
import VerifyEmailGuard from '@/components/auth/VerifyEmailGuard';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'ストア | PLAY TUNE オフィシャルサイト',
  description: 'PLAY TUNE オフィシャルストア',
};
export default function Store() {
  return (
    <VerifyEmailGuard>
      <StorePage />
    </VerifyEmailGuard>
  );
}

