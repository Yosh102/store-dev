"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/context/auth-context"
import { doc, getDoc, updateDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { User } from "@/types/user"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Toaster, toast } from "react-hot-toast"
import { Bell, AlertCircle, Users, FileText, Star } from "lucide-react"

interface EmailNotifications {
  generalAnnouncements: boolean // PLAY TUNE全体のお知らせ
  groupAnnouncements: boolean // グループに関するお知らせ
  membershipContentUpdates: boolean // メンバーシップコンテンツの更新
  membershipOtherNotifications: boolean // その他メンバーシップ関連
}

export default function NotificationSettingsClient() {
  const { user: authUser } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notifications, setNotifications] = useState<EmailNotifications>({
    generalAnnouncements: true,
    groupAnnouncements: true,
    membershipContentUpdates: true,
    membershipOtherNotifications: true,
  })

  useEffect(() => {
    const fetchUserData = async () => {
      if (!authUser || !authUser.uid) {
        setLoading(false)
        setError("User not authenticated")
        return
      }

      setLoading(true)
      try {
        const userDoc = await getDoc(doc(db, "users", authUser.uid))
        if (userDoc.exists()) {
          const userData = userDoc.data() as User
          setUser({
            id: userDoc.id,
            uid: authUser.uid,
            email: userData.email || "",
            displayName: userData.displayName || "",
            groupIds: userData.groupIds || [],
            role: userData.role || "user",
            avatarUrl: userData.avatarUrl || "/img/avatar/default-avatar.png",
            introduction: userData.introduction || "",
            xUsername: userData.xUsername || "",
            youtubeChannel: userData.youtubeChannel || "",
            tiktokUsername: userData.tiktokUsername || "",
            birthday: userData.birthday,
            emailVerified: authUser.emailVerified,
          })

          // メール通知設定を取得
          const emailNotifications = userData.emailNotifications || {}
          setNotifications({
            generalAnnouncements: emailNotifications.generalAnnouncements ?? true,
            groupAnnouncements: emailNotifications.groupAnnouncements ?? true,
            membershipContentUpdates: emailNotifications.membershipContentUpdates ?? true,
            membershipOtherNotifications: emailNotifications.membershipOtherNotifications ?? true,
          })
        } else {
          setError("User data not found")
        }
      } catch (err) {
        console.error("Error fetching user data:", err)
        setError("Failed to fetch user data")
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [authUser])

  const handleNotificationChange = (key: keyof EmailNotifications, value: boolean) => {
    setNotifications(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleSaveNotifications = async () => {
    if (!user) return

    setSaving(true)
    try {
      await updateDoc(doc(db, "users", user.uid), {
        emailNotifications: notifications,
        updatedAt: new Date()
      })
      toast.success("通知設定を更新しました")
    } catch (err) {
      console.error("Error updating notification settings:", err)
      toast.error("通知設定の更新に失敗しました")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-64 mb-6"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500">Error: {error}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p>No user data available</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 pt-16 pb-8">
      <Toaster />
      
      <div className="mb-6 mt-8">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="h-6 w-6" />
          <h1 className="text-2xl font-bold">メール通知設定</h1>
        </div>
        <p className="text-gray-600">
          受信したいメール通知を選択してください
        </p>
      </div>

      {/* 注意書き */}
      <Card className="mb-6 bg-amber-50">
        <CardContent>
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm text-amber-800">
                アカウントのセキュリティ、決済関連、利用規約の変更など、重要なメールについては設定の有無に関わらず送信されます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 通知設定 */}
      <Card>
        <CardContent className="space-y-6">
          
          {/* PLAY TUNE全体のお知らせ */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="space-y-1">
                <Label htmlFor="generalAnnouncements" className="text-base font-medium">
                  PLAY TUNE全体のお知らせ
                </Label>
                <p className="text-sm text-gray-600">
                  サービス全体に関する重要なお知らせやアップデート情報
                </p>
              </div>
            </div>
            <Switch
              id="generalAnnouncements"
              checked={notifications.generalAnnouncements}
              onCheckedChange={(value) => handleNotificationChange('generalAnnouncements', value)}
            />
          </div>

          <Separator />

          {/* グループに関するお知らせ */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="space-y-1">
                <Label htmlFor="groupAnnouncements" className="text-base font-medium">
                  登録メンバーシップのグループに関するお知らせ
                </Label>
                <p className="text-sm text-gray-600">
                  加入しているグループからの一般的なお知らせやイベント情報
                </p>
              </div>
            </div>
            <Switch
              id="groupAnnouncements"
              checked={notifications.groupAnnouncements}
              onCheckedChange={(value) => handleNotificationChange('groupAnnouncements', value)}
            />
          </div>

          <Separator />

          {/* メンバーシップコンテンツの更新 */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="space-y-1">
                <Label htmlFor="membershipContentUpdates" className="text-base font-medium">
                  メンバーシップコンテンツの更新のお知らせ
                </Label>
                <p className="text-sm text-gray-600">
                  新しい限定コンテンツが投稿された際の通知
                </p>
              </div>
            </div>
            <Switch
              id="membershipContentUpdates"
              checked={notifications.membershipContentUpdates}
              onCheckedChange={(value) => handleNotificationChange('membershipContentUpdates', value)}
            />
          </div>

          <Separator />

          {/* その他メンバーシップ関連 */}
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="space-y-1">
                <Label htmlFor="membershipOtherNotifications" className="text-base font-medium">
                  その他メンバーシップコンテンツに関するお知らせ
                </Label>
                <p className="text-sm text-gray-600">
                  メンバーシップ特典、ライブ配信、特別企画などの案内
                </p>
              </div>
            </div>
            <Switch
              id="membershipOtherNotifications"
              checked={notifications.membershipOtherNotifications}
              onCheckedChange={(value) => handleNotificationChange('membershipOtherNotifications', value)}
            />
          </div>

        </CardContent>
      </Card>

      {/* 保存ボタン */}
      <div className="mt-6">
        <Button 
          onClick={handleSaveNotifications}
          disabled={saving}
          className="w-full md:w-auto bg-black hover:bg-gray-700 text-white"
        >
          {saving ? "保存中..." : "設定を保存"}
        </Button>
      </div>
    </div>
  )
}