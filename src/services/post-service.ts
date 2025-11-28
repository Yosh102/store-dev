// post-service.ts
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    getDocs, 
    doc, 
    getDoc,
    Timestamp
  } from "firebase/firestore"
  import { db } from "@/lib/firebase"
  
  export interface Post {
    id: string
    title: string
    content: string
    thumbnailUrl: string
    publishDate: Timestamp
    status: string
    categories: string[] 
    tags: string[]
    membersOnly: boolean
    isOfficialAnnouncement?: boolean
    groups?: string[]
  }
  
  /**
   * 画像URLを解決する（FirebaseStorageのURLを適切に処理）
   */
  export function resolveImageUrl(imageUrl: string | undefined): string {
    if (!imageUrl) return "/placeholder.svg";
    
    // Firebase Storage URLは直接使用
    if (imageUrl && typeof imageUrl === 'string' && imageUrl.includes('firebasestorage.googleapis.com')) {
      return imageUrl;
    }
    
    // スラッシュから始まるパスはそのまま使用
    if (imageUrl.startsWith('/')) {
      return imageUrl;
    }
    
    // それ以外の場合はスラッシュを追加
    return `/${imageUrl}`;
  }
  
  /**
   * 特定のカテゴリの投稿を取得
   */
  export async function getPostsByCategory(category: string, postLimit: number = 10): Promise<Post[]> {
    try {
      const postsRef = collection(db, "posts");
      const q = query(
        postsRef,
        where("categories", "array-contains", category),  // 'categories' に変更 & array-contains を使用
        where("status", "==", "published"),
        orderBy("publishDate", "desc"),
        limit(postLimit)
      );
  
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
    } catch (error) {
      console.error("Error fetching posts by category:", error);
      throw new Error("カテゴリ別の投稿の取得に失敗しました");
    }
  }
  
  
  /**
   * 特定のタグがついた投稿を取得
   */
  export async function getPostsByTag(tag: string, postLimit: number = 10): Promise<Post[]> {
    try {
      const postsRef = collection(db, "posts");
      const q = query(
        postsRef,
        where("tags", "array-contains", tag),
        where("status", "==", "published"),
        orderBy("publishDate", "desc"),
        limit(postLimit)
      );
  
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
    } catch (error) {
      console.error("Error fetching posts by tag:", error);
      throw new Error("タグ別の投稿の取得に失敗しました");
    }
  }
  
  /**
   * カテゴリとタグで投稿を取得 (オプショナル)
   */
  export async function getPosts({ 
    category, 
    tag, 
    postLimit = 10 
  }: { 
    category?: string, 
    tag?: string, 
    postLimit?: number 
  }): Promise<Post[]> {
    try {
      const postsRef = collection(db, "posts");
      let q = query(
        postsRef,
        where("status", "==", "published"),
        orderBy("publishDate", "desc"),
        limit(postLimit)
      );
  
      if (category) {
        q = query(q, where("category", "==", category));
      }
  
      if (tag) {
        q = query(q, where("tags", "array-contains", tag));
      }
  
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
    } catch (error) {
      console.error("Error fetching posts:", error);
      throw new Error("投稿の取得に失敗しました");
    }
  }
  
  /**
   * 特定の投稿を取得
   */
  export async function getPostById(postId: string): Promise<Post | null> {
    try {
      const postDoc = await getDoc(doc(db, "posts", postId));
      
      if (postDoc.exists()) {
        return { 
          id: postDoc.id, 
          ...postDoc.data() 
        } as Post;
      }
      
      return null;
    } catch (error) {
      console.error("Error fetching post:", error);
      throw new Error("投稿の取得に失敗しました");
    }
  }
  
  /**
   * 特定のグループに関連する投稿を取得
   */
  export async function getPostsByGroup(groupId: string, postLimit: number = 10): Promise<Post[]> {
    try {
      const postsRef = collection(db, "posts");
      const q = query(
        postsRef,
        where("groups", "array-contains", groupId),
        where("status", "==", "published"),
        orderBy("publishDate", "desc"),
        limit(postLimit)
      );
  
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      })) as Post[];
    } catch (error) {
      console.error("Error fetching posts by group:", error);
      throw new Error("グループ別の投稿の取得に失敗しました");
    }
  }