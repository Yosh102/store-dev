"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useAuth } from "@/context/auth-context"
import { db } from "@/lib/firebase"
import { collection, query, where, getDocs, doc, getDoc, orderBy, limit } from "firebase/firestore"
import type { Group, MemberWithProfile } from "@/types/group"
import type { User, FavoriteMember } from "@/types/user"
import type { Post } from "@/types/post"
import type { Product } from "@/types/product"
import type { GroupBanner } from "@/types/group"
import type { HomeMovie } from "@/types/group"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import SubscriptionPanel from "@/components/store/SubscriptionPanel"
import LoginModal from "@/components/auth/LoginModal"
import { MemberDetailModal } from "@/components/group/MemberDetailModal"
import { FavoriteMemberModal } from "@/components/group/FavoriteMemberModal"
import { CelebrationPopup } from "@/components/group/CelebrationPopup"
import { MembershipCard } from "@/components/group/MembershipCard"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import ProductList from "@/components/group/ProductList"
import GroupHero from "@/components/group/GroupHero"
import JoinSection from "@/components/group/JoinSection"
import GroupBannerCarousel from "@/components/group/GroupBannerComponent"
import MovieSection from "@/components/group/MovieSection"
import Link from "next/link"
import Image from "next/image"
import { format } from "date-fns"
import { ChevronRight, ArrowRight } from "lucide-react"
import PlayTuneBackButton from "@/components/group/FixedButton"


// 既存のヘルパー関数
const isFirebaseStorageUrl = (url: string | undefined): boolean => {
  return Boolean(url && typeof url === 'string' && url.includes('firebasestorage.googleapis.com'));
}

const resolveImageUrl = (imageUrl: string | undefined): string => {
  if (!imageUrl) return "/placeholder.svg";
  if (isFirebaseStorageUrl(imageUrl)) return imageUrl;
  if (imageUrl.startsWith('/')) return imageUrl;
  return `/${imageUrl}`;
}

export default function GroupPage() {
  const { slug } = useParams()
  const { user } = useAuth()
  
  // 既存の状態
  const [group, setGroup] = useState<Group | null>(null)
  const [membersWithProfiles, setMembersWithProfiles] = useState<MemberWithProfile[]>([])
  const [showSubscription, setShowSubscription] = useState(false)
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<MemberWithProfile | null>(null)
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [groupNames, setGroupNames] = useState<{ [key: string]: string }>({})
  const [groupSlugs, setGroupSlugs] = useState<{ [key: string]: string }>({})
  const [posts, setPosts] = useState<Post[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [photos, setPhotos] = useState<Post[]>([]) // 新しい写真用state
  
  // バナー関連の状態
  const [banners, setBanners] = useState<GroupBanner[]>([])
  
  // 動画関連の状態
  const [movies, setMovies] = useState<HomeMovie[]>([])
  
  // 推しメン関連の状態
  const [showFavoriteMemberModal, setShowFavoriteMemberModal] = useState(false)
  const [favoriteMember, setFavoriteMember] = useState<FavoriteMember | null>(null)
  const [favoriteMemberAvatar, setFavoriteMemberAvatar] = useState<string | undefined>(undefined)
  const [hasFavoriteMember, setHasFavoriteMember] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const [isFirstVisit, setIsFirstVisit] = useState(true)
  const [recentlySelected, setRecentlySelected] = useState(false)
  const [celebrationOnly, setCelebrationOnly] = useState(false)

  // 会員証関連のステート
  const [showMembershipCard, setShowMembershipCard] = useState(false)
  const [memberSince, setMemberSince] = useState<any>(null)

  // Firestoreからユーザーの推しメン情報を取得する関数
  const fetchFavoriteMemberInfo = async (groupId: string) => {
    if (!user || !user.uid) return null;
    
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (!userDoc.exists()) return null;
      
      const userData = userDoc.data();
      if (!userData.favoriteMembers || !userData.favoriteMembers[groupId]) return null;
      
      return userData.favoriteMembers[groupId] as FavoriteMember;
    } catch (error) {
      // console.error("Error fetching favorite member info:", error);
      return null;
    }
  };

  // 推しメンのアバターURLを取得する関数
  const getFavoriteMemberAvatar = (memberId: string) => {
    const member = membersWithProfiles.find(m => m.id === memberId);
    return member?.profile?.avatarUrl;
  };

  // グループバナーを取得する関数
  const fetchGroupBanners = async (groupId: string) => {
    try {
      const bannersRef = collection(db, "group_banners")
      const q = query(
        bannersRef,
        where("groupId", "==", groupId),
        where("isActive", "==", true),
        orderBy("priority", "asc")
      )
      const querySnapshot = await getDocs(q)
      const fetchedBanners = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GroupBanner[]
      
      setBanners(fetchedBanners)
    } catch (error) {
      // console.error("Error fetching group banners:", error)
      setBanners([])
    }
  }

  // 動画を取得する関数
  const fetchMovies = async (groupId: string) => {
    // console.log('Fetching movies for groupId:', groupId)
    try {
      const moviesRef = collection(db, "home_movie")
      const q = query(
        moviesRef,
        where("groupId", "==", groupId),
        where("isActive", "==", true),
        orderBy("priority", "asc")
      )
      const querySnapshot = await getDocs(q)
      // console.log('Movies query snapshot size:', querySnapshot.size)
      
      const fetchedMovies = querySnapshot.docs.map((doc) => {
        const data = doc.data()
        // console.log('Movie document:', doc.id, data)
        return {
          id: doc.id,
          ...data,
        }
      }) as HomeMovie[]
      
      // console.log('Fetched movies:', fetchedMovies)
      setMovies(fetchedMovies)
    } catch (error) {
      // console.error("Error fetching movies:", error)
      setMovies([])
    }
  }

  useEffect(() => {
    const fetchGroup = async () => {
      if (!slug) return;
      
      setLoading(true)
      try {
        // Fetch group data
        const groupsRef = collection(db, "groups")
        const q = query(groupsRef, where("slug", "==", slug))
        const querySnapshot = await getDocs(q)
        
        if (querySnapshot.empty) {
          setLoading(false)
          return
        }
        
        const groupDoc = querySnapshot.docs[0]
        const groupData = groupDoc.data()
        const groupWithId = {
          id: groupDoc.id,
          ...groupData,
        } as Group
        setGroup(groupWithId)

        // Fetch group banners
        await fetchGroupBanners(groupDoc.id)

        // Fetch movies
        await fetchMovies(groupDoc.id)

        // Fetch all group names and slugs for reference
        const allGroupsSnapshot = await getDocs(collection(db, "groups"))
        const groupNamesMap: { [key: string]: string } = {}
        const groupSlugsMap: { [key: string]: string } = {}
        
        allGroupsSnapshot.forEach((doc) => {
          const groupData = doc.data()
          groupNamesMap[doc.id] = groupData.name
          if (groupData.slug) {
            groupSlugsMap[doc.id] = groupData.slug
          }
        })
        
        setGroupNames(groupNamesMap)
        setGroupSlugs(groupSlugsMap)

        // Fetch member profiles based on member IDs in the group
        if (groupData.members && Array.isArray(groupData.members)) {
          const memberProfiles = await Promise.all(
            groupData.members.map(async (member) => {
              try {
                const memberId = typeof member === 'string' ? member : member.id
                const userDoc = await getDoc(doc(db, "users", memberId))
                
                if (userDoc.exists()) {
                  const userData = userDoc.data() as User
                  return {
                    id: memberId,
                    name: userData.displayName || "名前なし",
                    profile: userData
                  } as MemberWithProfile
                }
              } catch (error) {
                // console.error(`Error fetching user:`, error)
              }
              
              return {
                id: typeof member === 'string' ? member : member.id,
                name: typeof member === 'object' && member.name ? member.name : "名前なし",
                profile: {} as User
              } as MemberWithProfile
            })
          )
          
          setMembersWithProfiles(memberProfiles.filter(Boolean) as MemberWithProfile[])
        }

        // Fetch posts for the group
        await fetchPosts(groupDoc.id);
        
        // Fetch photos for the group
        await fetchPhotos(groupDoc.id);
        
        // Fetch products for the group
        await fetchProducts(groupDoc.id);
        
        // グループIDとユーザーIDが取得できたらユーザー情報を取得
        if (groupDoc.id && user && user.uid) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            
            // 推しメン情報を取得
            if (userData.favoriteMembers && userData.favoriteMembers[groupDoc.id]) {
              const favMember = userData.favoriteMembers[groupDoc.id];
              setFavoriteMember(favMember);
              setHasFavoriteMember(true);
              
              // 推しメンの選択時刻を確認
              if (favMember.selectedAt) {
                const selectedTime = favMember.selectedAt.toDate ? 
                  favMember.selectedAt.toDate().getTime() : 
                  new Date(favMember.selectedAt.seconds * 1000).getTime();
                
                const isRecentlySelected = Date.now() - selectedTime < 10 * 60 * 1000;
                
                if (isRecentlySelected && isFirstVisit) {
                  setRecentlySelected(true);
                  setCelebrationOnly(true);
                }
              }
              
              const member = membersWithProfiles.find(m => m.id === favMember.memberId);
              if (member && member.profile) {
                setFavoriteMemberAvatar(member.profile.avatarUrl);
              }
            } else {
              setFavoriteMember(null);
              setHasFavoriteMember(false);
            }
            
            // サブスクリプション情報から会員開始日を取得
            if (userData.subscriptions && userData.subscriptions[groupDoc.id]) {
              const subscription = userData.subscriptions[groupDoc.id];
              if (subscription.status === "active") {
                setMemberSince(subscription.createdAt);
              }
            }
          }
        }
      } catch (error) {
        // console.error("Error fetching group data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchGroup()
  }, [slug, user])
  
  // 最近選択された推しメンがある場合にお祝いポップアップを表示
  useEffect(() => {
    if (recentlySelected && favoriteMember && !loading && isFirstVisit) {
      const timer = setTimeout(() => {
        setShowCelebration(true);
        setIsFirstVisit(false);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [recentlySelected, favoriteMember, loading, isFirstVisit]);

  // membersWithProfilesが更新されたら推しメンのアバターを設定
  useEffect(() => {
    if (favoriteMember && membersWithProfiles.length > 0) {
      const avatarUrl = getFavoriteMemberAvatar(favoriteMember.memberId);
      setFavoriteMemberAvatar(avatarUrl);
    }
  }, [favoriteMember, membersWithProfiles]);

  const fetchPosts = async (groupId: string) => {
    try {
      const postsRef = collection(db, "posts")
      const q = query(
        postsRef,
        where("groups", "array-contains", groupId),
        where("status", "==", "published"),
        where("membersOnly", "==", true), // 限定コンテンツのみ
        orderBy("publishDate", "desc"),
        limit(6) // 3つ表示用に6つ取得
      )
      const querySnapshot = await getDocs(q)
      const fetchedPosts = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[]
      setPosts(fetchedPosts)
    } catch (error) {
      // console.error("Error fetching posts:", error)
    }
  }

  const fetchPhotos = async (groupId: string) => {
    try {
      const photosRef = collection(db, "posts")
      const q = query(
        photosRef,
        where("groups", "array-contains", groupId),
        where("status", "==", "published"),
        where("category", "==", "photo"), // カテゴリが"photo"のもの
        orderBy("publishDate", "desc"),
        limit(6) // 3つ表示用に6つ取得
      )
      const querySnapshot = await getDocs(q)
      const fetchedPhotos = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[]
      setPhotos(fetchedPhotos)
    } catch (error) {
      // console.error("Error fetching photos:", error)
    }
  }

  const fetchProducts = async (groupId: string) => {
    try {
      const productsRef = collection(db, "products");
      const q = query(
        productsRef,
        where("groups", "array-contains", groupId),
        where("status", "==", "published"),
        limit(20) // 8個以上取得して、ProductListで8個に制限
      );
      const querySnapshot = await getDocs(q);
      const fetchedProducts = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Product[];
      setProducts(fetchedProducts);
    } catch (error) {
      // console.error("Error fetching products:", error);
    }
  };

  const handleSubscribeClick = () => {
    if (user) {
      setShowSubscription(true)
    } else {
      setShowLoginModal(true)
    }
  }
  
  const handleFavoriteMemberClick = () => {
    if (user) {
      setCelebrationOnly(false);
      setShowFavoriteMemberModal(true);
    } else {
      setShowLoginModal(true)
    }
  }
  
  const handleFavoriteMemberSelected = (member: FavoriteMember) => {
    setFavoriteMember(member);
    setHasFavoriteMember(true);
    
    const avatarUrl = getFavoriteMemberAvatar(member.memberId);
    setFavoriteMemberAvatar(avatarUrl);
    
    setShowCelebration(true);
  }

  const handleShowMembershipCard = () => {
    setShowMembershipCard(true);
  }

  const getSortedMembers = () => {
    if (!favoriteMember || !membersWithProfiles.length) {
      return membersWithProfiles;
    }
    
    const favoriteId = favoriteMember.memberId;
    const favorite = membersWithProfiles.find(member => member.id === favoriteId);
    const others = membersWithProfiles.filter(member => member.id !== favoriteId);
    
    return favorite ? [favorite, ...others] : membersWithProfiles;
  }

  const isSubscribed = group?.id && user?.subscriptions?.[group.id] 
    ? user.subscriptions[group.id].status === "active" 
    : false;

  // お知らせ用のフィルタリング関数
  const getNewsItems = () => {
    return posts.filter((post) => !post.membersOnly);
  }

  const getDisplayedNews = () => {
    return getNewsItems().slice(0, 3);
  }

  const hasMoreNews = () => {
    return getNewsItems().length > 3;
  }

  // お知らせを取得する関数を追加
  const fetchNews = async (groupId: string) => {
    try {
      const newsRef = collection(db, "posts")
      const q = query(
        newsRef,
        where("groups", "array-contains", groupId),
        where("status", "==", "published"),
        where("membersOnly", "==", false), // お知らせは非限定
        orderBy("publishDate", "desc"),
        limit(10)
      )
      const querySnapshot = await getDocs(q)
      const fetchedNews = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[]
      
      // ニュース用のstateを追加する必要があります
      // ここでは既存のpostsを使用します
    } catch (error) {
      // console.error("Error fetching news:", error)
    }
  }

// GroupPage.tsx のローディング部分を以下に置き換え：

if (loading) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center space-y-8">
        {/* グループロゴ（透明度アニメーション） */}
        <div className="relative w-32 h-32">
          {group?.logoUrl ? (
            <Image
              src={group.logoUrl}
              alt={`${group.name} ロゴ`}
              fill
              className="object-contain animate-[fade_2s_infinite] opacity-50"
              priority
            />
          ) : (
            /* ロゴがない場合はプレースホルダー */
            <div className="w-full h-full bg-gray-700 rounded-full animate-[fade_2s_infinite] opacity-50 flex items-center justify-center">
            </div>
          )}
        </div>
        
        {/* Loadingインジケーター */}
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <div className="w-2 h-2 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '200ms' }}></div>
            <div className="w-2 h-2 bg-white rounded-full animate-[bounce_1.4s_infinite] opacity-60" style={{ animationDelay: '400ms' }}></div>
          </div>
          <span className="text-white text-sm font-medium ml-3">Loading...</span>
        </div>
      </div>
      
      {/* カスタムアニメーション */}
      <style dangerouslySetInnerHTML={{
        __html: `
          @keyframes fade {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.8; }
          }
        `
      }} />
    </div>
  )
}

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-4">GROUP NOT FOUND</h1>
          <p className="mb-8">お探しのグループは存在しないか、削除された可能性があります。</p>
          <Link href="/" className="text-blue-400 hover:text-blue-300 underline">
            トップページに戻る
          </Link>
        </div>
      </div>
    )
  }

  // メインコンテンツをレンダリング
  return (
    <div>
      {/* Heroセクション */}
      <GroupHero
        group={group}
        isSubscribed={isSubscribed}
        hasFavoriteMember={hasFavoriteMember}
        favoriteMember={favoriteMember}
        favoriteMemberAvatar={favoriteMemberAvatar}
        memberSince={memberSince}
        onSubscribeClick={handleSubscribeClick}
        onFavoriteMemberClick={handleFavoriteMemberClick}
        onShowMembershipCard={handleShowMembershipCard}
      />

      {/* バナーセクション */}
      <GroupBannerCarousel banners={banners} />

      {/* お知らせセクション */}
      <div className="bg-black">
        <div className="container mx-auto px-4 py-16">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">NEWS</h2>
          </div>
          
          {getDisplayedNews().length > 0 ? (
            <div className="space-y-4">
              {getDisplayedNews().map((post) => (
                <Link
                  key={post.id}
                  href={`/post/${post.id}`}
                  className="flex items-center justify-between p-6 bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors group border border-gray-700"
                >
                  <div>
                    <h4 className="font-bold text-lg text-white group-hover:text-gray-200 transition-colors">
                      {post.title}
                    </h4>
                    {post.publishDate && (
                      <time className="text-sm text-gray-400 font-medium">
                        {format(post.publishDate.toDate(), "yyyy.MM.dd")}
                      </time>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-gray-200" strokeWidth={2} />
                </Link>
              ))}
              
              {/* MORE ボタン */}
              {hasMoreNews() && (
                <div className="flex justify-end mt-6">
                  <Link href={`/group/${slug}/news`}>
                    <Button 
                      variant="ghost" 
                      className="text-gray-300 hover:text-white hover:bg-gray-800 font-semibold group"
                    >
                      MORE
                      <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" strokeWidth={2} />
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-12 font-semibold">お知らせはありません。</p>
          )}
        </div>
      </div>

      {/* 動画セクション */}
      <MovieSection group={group} movies={movies} />
      
      <div className="bg-white">
        {/* 商品セクション */}
        <div className="bg-black">
          <div className="container mx-auto px-4 py-16">
            <div className="mb-12">
              <h3 className="text-3xl font-bold text-white">OFFICIAL GOODS</h3>
            </div>
            
            {products.length > 0 ? (
              <ProductList 
                initialProducts={products.sort(() => Math.random() - 0.5)} 
                groupSlug={group.slug}
              />
            ) : (
              <p className="text-gray-400 text-center py-12 font-semibold">現在、販売中の商品はありません。</p>
            )}
          </div>
        </div>

        {/* CONTENTとPHOTOSセクション */}
        <div className="bg-black">
          <div className="container mx-auto px-4 py-16">
            {/* 限定コンテンツセクション - レスポンシブレイアウト */}
            <div className="mb-16">
              <div className="flex justify-between items-end mb-8">
                <h3 className="text-3xl font-bold text-white">CONTENT</h3>
                {posts.length > 0 && (
                  <Link href={`/group/${slug}/posts`} className="text-white hover:text-gray-100 underline">
                    バックナンバー
                  </Link>
                )}
              </div>
              
              {posts.length > 0 ? (
                <>
                  {/* スマホ用 - 横スクロール */}
                  <div className="block md:hidden overflow-x-auto scrollbar-hide">
                    <div className="flex gap-6 pb-4" style={{ width: 'max-content' }}>
                      {posts.slice(0, 3).map((post) => (
                        <Link key={post.id} href={`/post/${post.id}`} className="group block flex-shrink-0">
                          <div className="relative w-80 aspect-video rounded-lg overflow-hidden mb-4">
                            <Image
                              src={resolveImageUrl(post.thumbnailUrl)}
                              alt={post.title}
                              fill
                              className="object-cover transition-transform group-hover:scale-105"
                            />
                          </div>
                          {post.publishDate && (
                            <time className="text-sm text-white">
                              {format(post.publishDate.toDate(), "yyyy.MM.dd")}
                            </time>
                          )}
                          <h4 className="font-medium text-lg text-white mb-2 w-80">
                            <b>{post.title}</b>
                          </h4>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {/* デスクトップ用 - グリッドレイアウト */}
                  <div className="hidden md:grid grid-cols-2 lg:grid-cols-3 gap-6">
                    {posts.slice(0, 3).map((post) => (
                      <Link key={post.id} href={`/post/${post.id}`} className="group block">
                        <div className="relative aspect-video rounded-lg overflow-hidden mb-4">
                          <Image
                            src={resolveImageUrl(post.thumbnailUrl)}
                            alt={post.title}
                            fill
                            className="object-cover transition-transform group-hover:scale-105"
                          />
                        </div>
                        {post.publishDate && (
                          <time className="text-sm text-white">
                            {format(post.publishDate.toDate(), "yyyy.MM.dd")}
                          </time>
                        )}
                        <h4 className="font-medium text-lg text-white mb-2">
                          <b>{post.title}</b>
                        </h4>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-center py-12">限定コンテンツはありません。</p>
              )}
            </div>
            <PlayTuneBackButton />
          </div>
          {/* PHOTOSセクション - 3列グリッドレイアウト */}
          {/* <div>
            <div className="flex justify-between items-end mb-8">
              <h3 className="text-3xl font-bold">PHOTOS</h3>
              {photos.length > 0 && (
                <Link href={`/group/${slug}/photos`} className="text-gray-600 hover:text-gray-900 underline">
                  View All
                </Link>
              )}
            </div>
            
            {photos.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {photos.slice(0, 3).map((photo) => (
                  <Link key={photo.id} href={`/post/${photo.id}`} className="group block">
                    <div className="relative aspect-video rounded-lg overflow-hidden mb-4">
                      <Image
                        src={resolveImageUrl(photo.thumbnailUrl)}
                        alt={photo.title}
                        fill
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    </div>
                    <h4 className="font-medium text-lg group-hover:text-blue-600 transition-colors mb-2">
                      {photo.title}
                    </h4>
                    {photo.publishDate && (
                      <time className="text-sm text-gray-500">
                        {format(photo.publishDate.toDate(), "yyyy.MM.dd")}
                      </time>
                    )}
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-12">写真はありません。</p>
            )}
          </div> */}
        </div>

        {/* JOINセクション - 未ログインまたは未サブスクの場合のみ表示 */}
        {(!user || !isSubscribed) && (
        <JoinSection group={group} />
        )}
      </div>

      {/* モーダル群 */}
      {showCelebration && favoriteMember && (
        <CelebrationPopup
          isOpen={showCelebration}
          onClose={() => setShowCelebration(false)}
          member={favoriteMember}
          avatarUrl={favoriteMemberAvatar}
          groupName={group.name}
        />
      )}
      
      {showSubscription && <SubscriptionPanel group={group} onClose={() => setShowSubscription(false)} />}
      
      {showLoginModal && (
        <LoginModal
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={() => {
            setShowLoginModal(false)
            setShowSubscription(true)
          }}
        />
      )}
      
      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          isOpen={isMemberModalOpen}
          onClose={() => setIsMemberModalOpen(false)}
          groupNames={groupNames}
          groupSlugs={groupSlugs}
        />
      )}
      
      {showFavoriteMemberModal && !celebrationOnly && (
        <FavoriteMemberModal
          isOpen={showFavoriteMemberModal}
          onClose={() => setShowFavoriteMemberModal(false)}
          members={membersWithProfiles}
          groupId={group.id}
          groupName={group.name}
          user={user as User}
          onSelected={handleFavoriteMemberSelected}
        />
      )}
      
      {showMembershipCard && isSubscribed && memberSince && (
        <Dialog open={showMembershipCard} onOpenChange={setShowMembershipCard}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-center">会員証</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <MembershipCard
                groupName={group.name}
                groupLogo={group.coverImage}
                memberSince={memberSince}
                favoriteMember={favoriteMember}
                favoriteMemberAvatarUrl={favoriteMemberAvatar}
                accentColor={group.accentColor}
              />
            </div>
            <div className="text-center text-xs text-gray-500 mt-2">
              この会員証はあなた専用です。スクリーンショットを撮って保存することができます。
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}