"use client"

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Head from 'next/head'
import { ArrowLeft, ArrowRight, Mail, Lock, CreditCard, MapPin, Settings, User as UserIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/context/auth-context'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { generateMembershipId, generateBarcodeSVG } from '@/lib/membership'
import { resolveImageUrl } from '@/lib/staff-diary'
import type { Group } from '@/types/group'
import type { User } from '@/types/user'
import GroupNavbar from '@/components/group/GroupNavbar'

// メンバーズカードコンポーネント
interface MemberCardProps {
  user: User
  group: Group
  membershipId: string
  joinDate: Date
}

const MemberCard: React.FC<MemberCardProps> = ({ user, group, membershipId, joinDate }) => {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    })
  }

  const formatBirthday = (timestamp: any) => {
    if (!timestamp) return '未設定'
    return timestamp.toDate().toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric'
    })
  }

  // より複雑なバーコードを生成
  const generateComplexBarcode = (membershipId: string): string => {
    const patterns: number[] = []
    const seed = membershipId + user.uid + group.id
    
    // より複雑なアルゴリズムでパターン生成
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i)
      const multiplier = (i + 1) * 31 // より複雑な乗数
      const base = (char * multiplier) % 127
      
      // 複数の幅パターンを生成
      patterns.push((base % 7) + 1)        // 1-7の幅
      patterns.push(((base * 17) % 5) + 1) // 1-5の幅
      patterns.push(((base * 23) % 3) + 1) // 1-3の幅
    }
    
    // さらに複雑なパターンを追加
    for (let i = 0; i < 30; i++) {
      const complexSeed = membershipId.charCodeAt(i % membershipId.length) * (i + 1)
      const pattern1 = (Math.sin(complexSeed * 0.1) * 5) + 3
      const pattern2 = (Math.cos(complexSeed * 0.15) * 3) + 2
      patterns.push(Math.floor(Math.abs(pattern1)))
      patterns.push(Math.floor(Math.abs(pattern2)))
    }
    
    let x = 0
    const totalWidth = 250
    const barHeight = 60
    const totalPatternWidth = patterns.reduce((sum, width) => sum + width, 0)
    const barWidth = totalWidth / totalPatternWidth
    
    const rects = patterns.map((width, index) => {
      const isBlack = index % 2 === 0
      const rectWidth = barWidth * width
      const rect = `<rect x="${x}" y="0" width="${rectWidth}" height="${barHeight}" fill="${isBlack ? '#000000' : '#ffffff'}" />`
      x += rectWidth
      return rect
    }).join('')
    
    return `
      <svg width="${totalWidth}" height="${barHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="white"/>
        ${rects}
      </svg>
    `
  }

  return (
    <div className="relative mx-auto mb-8">
      {/* Card */}
      <div className="relative mx-auto" style={{ width: 350, height: 220 }}>
        <div className="w-full h-full rounded-2xl shadow-2xl relative overflow-hidden bg-black border border-gray-800">
          {/* Decorative background */}
          <div className="absolute inset-0 opacity-5">
            <div className="absolute top-6 right-6 w-20 h-20 border-2 border-white rounded-full" />
            <div className="absolute bottom-6 left-6 w-10 h-10 border border-white rounded-full" />
            <div className="absolute inset-1/2 w-40 h-40 border border-white rounded-full -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute top-12 left-12 w-4 h-4 bg-yellow-400 rounded-full" />
            <div className="absolute bottom-12 right-12 w-6 h-6 bg-yellow-400 rounded-full opacity-50" />
          </div>

          {/* Watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-5 z-5">
            {group.logoUrl ? (
              <Image
                src={group.logoUrl}
                alt={`${group.name} logo`}
                fill
                className="object-contain"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            ) : (
              <div className="w-32 h-32 border-2 border-white rounded-full flex items-center justify-center">
                <span className="text-white text-xs font-bold">LOGO</span>
              </div>
            )}
          </div>

          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800 opacity-80" />

          {/* Content */}
          <div className="relative z-10 p-6 h-full flex flex-col text-white">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="text-xs font-light text-yellow-400 mb-1 tracking-widest uppercase font-mono">
                  OFFICIAL MEMBER
                </div>
                <div className="text-lg font-bold tracking-wide font-sans">{group.name}</div>
              </div>
              <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-700 flex items-center justify-center border-2 border-yellow-400">
                {user.avatarUrl ? (
                  <Image src={user.avatarUrl} alt="avatar" width={48} height={48} className="object-cover w-full h-full" />
                ) : (
                  <UserIcon className="w-6 h-6 text-yellow-400" />
                )}
              </div>
            </div>

            {/* Name & ID */}
            <div className="mt-6">
              <div className="text-xl font-bold tracking-wide font-sans">{user.displayName || 'ユーザー'}</div>
              <div className="text-sm text-gray-300 font-mono">ID: {membershipId}</div>
            </div>

            {/* Footer (絶対配置で下部へ) */}
            <div className="absolute bottom-6 left-6 right-6 flex justify-between items-center text-xs text-gray-400">
              <span className="font-mono">参加日：{formatDate(joinDate)}</span>
              <span className="font-mono">誕生日：{formatBirthday(user.birthday)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Barcode */}
      <div className="mt-4 flex justify-center">
        <div className="bg-white rounded-lg p-4 shadow-lg border border-gray-200">
          <div dangerouslySetInnerHTML={{ __html: generateComplexBarcode(membershipId) }} />
        </div>
      </div>
    </div>
  )
}

// 設定ボタンコンポーネント
interface SettingButtonProps {
  title: string
  href?: string
  onClick?: () => void
  icon: React.ReactNode
}

const SettingButton: React.FC<SettingButtonProps> = ({ title, href, onClick, icon }) => {
  const buttonContent = (
    <div className="bg-black hover:bg-gray-800 text-white rounded-full px-6 py-4 flex items-center justify-between transition-colors cursor-pointer group">
      <div className="flex items-center gap-3">
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </div>
      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block w-full">
        {buttonContent}
      </Link>
    )
  }

  return (
    <button onClick={onClick} className="w-full">
      {buttonContent}
    </button>
  )
}

export default function MyPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const { user: authUser, loading: authLoading } = useAuth()
  
  const [group, setGroup] = useState<Group | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [membershipId, setMembershipId] = useState<string>('')
  const [joinDate, setJoinDate] = useState<Date>(new Date())
  const [forceAccess, setForceAccess] = useState<boolean>(false)

  // 開発環境チェック
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENV === 'development'

  // slugからグループを取得する関数
  const getGroupBySlug = async (slug: string): Promise<Group | null> => {
    try {
      const groupsRef = collection(db, 'groups')
      const q = query(groupsRef, where('slug', '==', slug))
      const querySnapshot = await getDocs(q)
      
      if (querySnapshot.empty) {
        return null
      }
      
      const groupDoc = querySnapshot.docs[0]
      return {
        id: groupDoc.id,
        ...groupDoc.data()
      } as Group
    } catch (error) {
      console.error('Error fetching group by slug:', error)
      return null
    }
  }

  // サブスクリプション状態をチェック（STAFF DIARYと同じロジック）
  const isSubscribed = (() => {
    
    if (isDevelopment || forceAccess) {
      console.log('Development mode or force access - allowing access')
      return true
    }
    
    if (!group?.id || !authUser?.subscriptions?.[group.id]) {
      console.log('No subscription found for group')
      return false
    }
    
    const subscription = authUser.subscriptions[group.id]
    
    const result = subscription.status === "active"
    
    return result
  })()

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // グループ情報を取得
        const groupData = await getGroupBySlug(slug)
        if (!groupData) {
          setError('グループが見つかりません')
          return
        }
        
        setGroup(groupData)
        
        // AuthContextからユーザー情報を直接使用
        if (authUser) {
          setUser(authUser)
          
          // メンバーシップIDを生成
          const membershipIdGenerated = generateMembershipId(authUser.id)
          setMembershipId(membershipIdGenerated)
          
          // 参加日を設定（サブスクリプション開始日または作成日）
          const subscription = authUser.subscriptions?.[groupData.id]
          if (subscription?.currentPeriodEnd) {
            // currentPeriodEndはTimestamp型なのでtoDate()で変換
            const periodEnd = subscription.currentPeriodEnd.toDate()
            const isYearly = subscription.planType === 'yearly'
            const calculatedJoinDate = new Date(periodEnd)
            if (isYearly) {
              calculatedJoinDate.setFullYear(calculatedJoinDate.getFullYear() - 1)
            } else {
              calculatedJoinDate.setMonth(calculatedJoinDate.getMonth() - 1)
            }
            setJoinDate(calculatedJoinDate)
          } else if (authUser.createdAt) {
            setJoinDate(authUser.createdAt.toDate())
          }
        }
        
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    if (!authLoading) {
      fetchData()
    }
  }, [slug, authUser, authLoading])

  // ローディング中
  if (authLoading || loading) {
    return (
      <>
        <Head>
          <title>マイページ | ローディング中...</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        {group && <GroupNavbar group={group} slug={slug} />}
        <div className="min-h-screen bg-gray-50 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-64 mb-8"></div>
              <div className="bg-gray-200 rounded-2xl h-48 mb-8"></div>
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-16 bg-gray-200 rounded-full"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // 開発環境では認証チェックをスキップ
  if (!isDevelopment && !authUser) {
    return (
      <>
        <Head>
          <title>ログインが必要です | {group?.name || 'PLAY TUNE'} オフィシャルサイト</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
          {/* Background Image with Parallax Effect */}
          <div className="absolute inset-0">
            <div className="relative w-full h-full">
              <Image
                src={group ? resolveImageUrl(group.coverImage) : '/placeholder.jpg'}
                alt={group?.name || 'Cover'}
                fill
                priority
                className="object-cover object-center"
                style={{ 
                  objectFit: "cover",
                  transform: "scale(1.1)" // Slight zoom for parallax effect
                }}
              />
              
              {/* Gradient Overlay - darker and more dramatic */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />
              
              {/* Noise texture overlay for film-like effect */}
              <div 
                className="absolute inset-0 opacity-20 mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">PLAY TUNE IDへログインが必要です</h2>
            <p className="text-white/90 mb-6 drop-shadow-lg">このページを閲覧するにはログインしてください。</p>
            <Link href="/login">
              <Button 
                variant="outline" 
                size="default"
                className="w-full md:w-auto bg-white text-black hover:bg-gray-100 text-lg font-bold px-12 py-4 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-xl group"
              >
                ログイン
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" strokeWidth={2} />
              </Button>
            </Link>
          </div>
        </div>
      </>
    )
  }

  // 開発環境ではサブスクリプションチェックもスキップ
  if (!isDevelopment && !isSubscribed) {
    return (
      <>
        <Head>
          <title>メンバーシップが必要です | {group?.name || 'PLAY TUNE'} オフィシャルサイト</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
          {/* Background Image with Parallax Effect */}
          <div className="absolute inset-0">
            <div className="relative w-full h-full">
              <Image
                src={group ? resolveImageUrl(group.coverImage) : '/placeholder.jpg'}
                alt={group?.name || 'Cover'}
                fill
                priority
                className="object-cover object-center"
                style={{ 
                  objectFit: "cover",
                  transform: "scale(1.1)" // Slight zoom for parallax effect
                }}
              />
              
              {/* Gradient Overlay - darker and more dramatic */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />
              
              {/* Noise texture overlay for film-like effect */}
              <div 
                className="absolute inset-0 opacity-20 mix-blend-overlay"
                style={{
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='200' height='200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noizeFilter)'/%3E%3C/svg%3E")`,
                }}
              />
            </div>
          </div>

          {/* Content */}
          <div className="relative z-10 text-center">
            <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">メンバーシップが必要です</h2>
            <p className="text-white/90 mb-6 drop-shadow-lg">このページを閲覧するには{group?.name}のメンバーシップが必要です。</p>
            
            {/* 開発環境では強制アクセスボタンを表示 */}
            {isDevelopment && (
              <div className="mb-4">
                <Button 
                  onClick={() => setForceAccess(true)}
                  variant="outline" 
                  size="default"
                  className="w-full md:w-auto bg-yellow-500 text-black hover:bg-yellow-400 text-lg font-bold px-12 py-4 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-xl group mr-4"
                >
                  開発用: 強制アクセス
                </Button>
              </div>
            )}
            
            <Link href={`/group/${slug}#join-section`}>
              <Button 
                variant="outline" 
                size="default"
                className="w-full md:w-auto bg-white text-black hover:bg-gray-100 text-lg font-bold px-12 py-4 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-xl group"
              >
                メンバーシップに加入
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" strokeWidth={2} />
              </Button>
            </Link>
          </div>
        </div>
      </>
    )
  }

  // エラー表示
  if (error || !group) {
    return (
      <>
        <Head>
          <title>エラー | {group?.name || 'PLAY TUNE'} オフィシャルサイト</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        {group && <GroupNavbar group={group} slug={slug} />}
        <div className="min-h-screen bg-gray-50 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <p className="text-red-500 text-lg mb-4">{error || 'データが見つかりません'}</p>
              <Link 
                href={`/group/${slug}`}
                className="inline-flex items-center text-blue-500 hover:text-blue-600"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                ホームに戻る
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ユーザーデータが存在しない場合
  if (!user) {
    return (
      <>
        <Head>
          <title>ユーザー情報が見つかりません | {group.name} オフィシャルサイト</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        {group && <GroupNavbar group={group} slug={slug} />}
        <div className="min-h-screen bg-gray-50 pt-16">
          <div className="container mx-auto px-4 py-8">
            <div className="text-center">
              <p className="text-red-500 text-lg mb-4">ユーザー情報が見つかりません</p>
              <Link 
                href={`/group/${slug}`}
                className="inline-flex items-center text-blue-500 hover:text-blue-600"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                ホームに戻る
              </Link>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head>
        <title>マイページ | {group.name} オフィシャルサイト</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <GroupNavbar group={group} slug={slug} />
      
      <div className="min-h-screen bg-gray-50 pt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            {/* 開発環境表示 */}
            {isDevelopment && (
              <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
                <strong>開発環境:</strong> 認証チェックがスキップされています
              </div>
            )}

            {/* ページタイトル */}
            <Link 
              href={`/group/${slug}`} 
              className="inline-flex items-center text-black hover:text-gray-600 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              HOME
            </Link>
            <h1 className="text-3xl font-bold text-black mb-8">MY PAGE</h1>

            {/* メンバーズカード */}
            <MemberCard 
              user={user}
              group={group}
              membershipId={membershipId}
              joinDate={joinDate}
            />

            {/* 設定メニュー */}
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <SettingButton
                  title="プロフィール設定"
                  href={`/profile`}
                  icon={<UserIcon className="w-5 h-5" />}
                />
                
                <SettingButton
                  title="パスワード変更"
                  href={`/change-password`}
                  icon={<Lock className="w-5 h-5" />}
                />
                
                <SettingButton
                  title="メール受信設定"
                  href={`/notifications`}
                  icon={<Settings className="w-5 h-5" />}
                />
                
                <SettingButton
                  title="入会状況・お支払方法変更"
                  href="/subscription"
                  icon={<CreditCard className="w-5 h-5" />}
                />
                
                <SettingButton
                    title="ファンクラブ商品送付先設定"
                    href="/address"
                    icon={<MapPin className="w-5 h-5" />}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}