import { Timestamp } from 'firebase/firestore'

interface Subscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'incomplete';
  planType: 'monthly' | 'yearly';
  currentPeriodEnd: Timestamp;
  createdAt: Timestamp;
}

export interface FavoriteMember {
  memberId: string;
  memberName: string;
  groupId: string;
  selectedAt: Timestamp;
}

export interface User {
  id: string;
  uid: string;
  email: string;
  displayName: string | null;  // null許容を維持
  groupIds: string[];
  role: 'admin' | 'artist' | 'user';
  avatarUrl?: string;
  createdAt?: Timestamp;
  introduction?: string;
  xUsername?: string;
  birthday?: Timestamp
  youtubeChannel?: string;
  tiktokUsername?: string;
  emailVerified: boolean;
  emailNotifications?: EmailNotifications
  subscriptions?: {
    [groupId: string]: {
      planType: "monthly" | "yearly"
      status: string
      currentPeriodEnd: Timestamp;     }
  };
  favoriteMembers?: {
    [groupId: string]: FavoriteMember
  }
}
export interface EmailNotifications {
  generalAnnouncements?: boolean // PLAY TUNE全体のお知らせ
  groupAnnouncements?: boolean // グループに関するお知らせ  
  membershipContentUpdates?: boolean // メンバーシップコンテンツの更新
  membershipOtherNotifications?: boolean // その他メンバーシップ関連
}