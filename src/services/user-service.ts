// user-service.ts
import { 
  doc, 
  getDoc, 
  updateDoc, 
  Timestamp,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore"
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage"
import { db, storage } from "@/lib/firebase"
import type { User } from "@/types/user"

const USERS_COLLECTION = "users"

// ユーザーフォームデータの型定義
export interface UserFormData {
  email: string;
  displayName: string | null;
  isActive: boolean;
  introduction?: string;
  tiktokUsername?: string;
  xUsername?: string;
  youtubeChannel?: string;
  birthday?: Date | null;
  avatarFile?: File | null;
}


/**
 * 特定のユーザーを取得
 */
export async function getUserById(userId: string): Promise<User | null> {
  try {
    const docRef = doc(db, USERS_COLLECTION, userId)
    const docSnap = await getDoc(docRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      return {
        id: docSnap.id,
        uid: docSnap.id,
        ...data,
        emailVerified: data.emailVerified ?? false,
        groupIds: data.groupIds || [],
      } as User
    }

    return null
  } catch (error) {
    console.error("Error getting user:", error)
    throw new Error("ユーザーの取得に失敗しました")
  }
}

/**
 * ユーザーを更新
 */
export async function updateUser(userId: string, userData: Partial<UserFormData>, currentUserId: string): Promise<void> {
  try {
    const previousData = await getUserById(userId)
    if (!previousData) {
      throw new Error("更新対象のユーザーが見つかりません")
    }

    // 更新データを準備
    const updates: Record<string, any> = {
      ...userData,
      updatedAt: serverTimestamp(),
      updatedBy: currentUserId,
    }

    // 画像のアップロード処理
    if (userData.avatarFile) {
      updates.avatarUrl = await uploadUserAvatar(userData.avatarFile, userId)
    }

    // avatarFileはFirestoreに保存しない
    if ("avatarFile" in updates) {
      delete updates.avatarFile
    }

    // birthdayがDateオブジェクトの場合はTimestampに変換
    if (updates.birthday instanceof Date) {
      updates.birthday = Timestamp.fromDate(updates.birthday)
    }

    const userRef = doc(db, USERS_COLLECTION, userId)
    await updateDoc(userRef, updates)

  } catch (error) {
    console.error("Error updating user:", error)
    throw error
  }
}

/**
 * プロフィール情報を更新（ユーザー自身によるプロフィール更新用）
 */
export async function updateProfile(userId: string, profileData: Partial<User>): Promise<void> {
  try {
    const userRef = doc(db, USERS_COLLECTION, userId)
    
    // 更新データを準備
    const updates: Record<string, any> = {
      ...profileData,
      updatedAt: serverTimestamp(),
    }
    
    // birthdayがDateオブジェクトの場合はTimestampに変換
    if (updates.birthday instanceof Date) {
      updates.birthday = Timestamp.fromDate(updates.birthday)
    }
    
    await updateDoc(userRef, updates)
  } catch (error) {
    console.error("Error updating profile:", error)
    throw new Error("プロフィールの更新に失敗しました")
  }
}

/**
 * ユーザーアバターをアップロード
 */
export async function uploadUserAvatar(file: File, userId: string): Promise<string> {
  try {
    // Firebase Storageへのファイル名を作成
    const timestamp = Date.now()
    const fileName = `${userId}_${timestamp}_${file.name.replace(/\s+/g, '_')}`
    const filePath = `img/avatar/${fileName}`
    
    // Firebase Storageのリファレンスを作成
    const storageRef = ref(storage, filePath)
    
    // ファイルをアップロード
    await uploadBytes(storageRef, file)
    console.log("アバター画像をFirebase Storageにアップロードしました")
    
    // アップロードされたファイルのURLを取得
    const downloadUrl = await getDownloadURL(storageRef)
    console.log("ダウンロードURL:", downloadUrl)
    
    return downloadUrl
  } catch (error) {
    console.error("Error uploading avatar:", error)
    throw new Error("アバター画像のアップロードに失敗しました")
  }
}

/**
 * ユーザーのアバター画像を更新
 */
export async function updateUserAvatar(userId: string, file: File): Promise<string> {
  try {
    // 前のアバター画像がある場合は削除
    const user = await getUserById(userId)
    if (user && user.avatarUrl && user.avatarUrl.includes('firebasestorage.googleapis.com')) {
      try {
        // URLからStorageのパスを抽出
        const url = new URL(user.avatarUrl)
        const pathname = url.pathname
        if (pathname.includes('/o/')) {
          const path = decodeURIComponent(pathname.split('/o/')[1].split('?')[0])
          const oldAvatarRef = ref(storage, path)
          await deleteObject(oldAvatarRef)
        }
      } catch (error) {
        console.warn("古いアバター画像の削除に失敗しました:", error)
      }
    }

    // 新しいアバターをアップロード
    const avatarUrl = await uploadUserAvatar(file, userId)
    
    // Firestoreのユーザードキュメントを更新
    const userRef = doc(db, USERS_COLLECTION, userId)
    await updateDoc(userRef, {
      avatarUrl,
      updatedAt: serverTimestamp(),
    })
    
    return avatarUrl
  } catch (error) {
    console.error("Error updating user avatar:", error)
    throw new Error("アバター画像の更新に失敗しました")
  }
}

/**
 * サブスクリプションが有効かどうかを検証する関数
 */
export const isSubscriptionActive = (subscription: any): boolean => {
  // サブスクリプションが存在しない場合
  if (!subscription) return false;

  // ステータスが active であること
  if (subscription.status !== 'active') return false;

  // 現在の期間が終了していないこと
  const currentPeriodEnd = subscription.currentPeriodEnd.toDate();
  const now = new Date();
  
  // 現在の日付がcurrentPeriodEndより前であること
  return now < currentPeriodEnd;
};

/**
 * サブスクリプションの状態を検証し、必要に応じてFirestoreを更新する
 */
export const validateAndUpdateSubscriptionStatus = async (userId: string, groupId: string): Promise<boolean> => {
  try {
    // ユーザードキュメントを取得
    const userDoc = await getDoc(doc(db, USERS_COLLECTION, userId));
    if (!userDoc.exists()) return false;
    
    const userData = userDoc.data();
    const subscription = userData.subscriptions?.[groupId];
    
    // サブスクリプションが存在しない
    if (!subscription) return false;
    
    // 現在アクティブで期限も有効か確認
    const isActive = isSubscriptionActive(subscription);
    
    // 状態が不一致の場合（activeだが実際には期限切れ）、Firestoreを更新
    if (subscription.status === 'active' && !isActive) {
      await updateDoc(doc(db, USERS_COLLECTION, userId), {
        [`subscriptions.${groupId}.status`]: 'expired',
        [`subscriptions.${groupId}.updatedAt`]: serverTimestamp(),
      });
      console.log(`Updated expired subscription for user ${userId} and group ${groupId}`);
    }
    
    return isActive;
  } catch (error) {
    console.error('Error validating subscription:', error);
    return false;
  }
};

/**
 * 全ユーザーの特定グループのサブスクリプション状態を検証・更新するバッチ処理
 */
export const batchValidateSubscriptions = async (groupId: string): Promise<void> => {
  try {
    // グループのサブスクリプションを持つユーザーを検索
    const usersRef = collection(db, USERS_COLLECTION);
    const q = query(usersRef, where(`subscriptions.${groupId}.status`, '==', 'active'));
    const querySnapshot = await getDocs(q);
    
    const updatePromises: Promise<void>[] = [];
    
    querySnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      const subscription = userData.subscriptions?.[groupId];
      
      if (subscription) {
        const currentPeriodEnd = subscription.currentPeriodEnd.toDate();
        const now = new Date();
        
        // 期限切れを検出
        if (now >= currentPeriodEnd) {
          updatePromises.push(
            updateDoc(doc(db, USERS_COLLECTION, userDoc.id), {
              [`subscriptions.${groupId}.status`]: 'expired',
              [`subscriptions.${groupId}.updatedAt`]: serverTimestamp(),
            })
          );
        }
      }
    });
    
    // 一括更新を実行
    if (updatePromises.length > 0) {
      await Promise.all(updatePromises);
      console.log(`Updated ${updatePromises.length} expired subscriptions for group ${groupId}`);
    }
    
  } catch (error) {
    console.error('Error batch validating subscriptions:', error);
    throw new Error('サブスクリプションの一括検証に失敗しました');
  }
};