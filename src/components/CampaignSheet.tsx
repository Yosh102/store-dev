"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Gift } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useLocalStorage } from "@/hooks/use-local-storage"
import { useAuth } from "@/context/auth-context"

export function CampaignSheet() {
  const { user } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [hasSeenCampaign, setHasSeenCampaign] = useLocalStorage("hasSeenCampaign", false)
  const [isFirstVisit, setIsFirstVisit] = useState(true)

  useEffect(() => {
    if (!user && !hasSeenCampaign) {
      const timer = setTimeout(() => {
        setIsOpen(true)
        setHasSeenCampaign(true)
      }, 3000)

      return () => clearTimeout(timer)
    }
    setIsFirstVisit(false)
  }, [user, hasSeenCampaign, setHasSeenCampaign])

  return (
    <>
      <AnimatePresence>
        {isOpen && !user && (
          <>
            {/* Backdrop with blur effect */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              onClick={() => setIsOpen(false)}
            />

            {/* Campaign Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{
                type: "spring",
                damping: 30,
                stiffness: 300,
                mass: 0.8,
              }}
              className="fixed bottom-0 left-0 right-0 z-50"
            >
              {/* iOS-style handle bar */}
              <div className="w-full flex justify-center mb-2">
                <div className="w-10 h-1 bg-white/50 rounded-full" />
              </div>

              <div className="bg-white rounded-t-[32px] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
                <div className="relative p-6">
                  <button
                    onClick={() => setIsOpen(false)}
                    className="absolute right-4 top-4 p-2 hover:bg-gray-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>

                  <div className="flex flex-col items-center text-center space-y-4 pt-2">
                    <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center">
                      <Gift className="w-10 h-10 text-emerald-600" />
                    </div>

                    <div>
                      <h3 className="text-xl font-bold mb-2">新規会員登録キャンペーン</h3>
                      <p className="text-gray-600 mb-4">
                        今なら新規会員登録で
                        <br />
                        <span className="text-2xl font-bold text-emerald-600">1,000円分のクーポン</span>
                        <br />
                        をプレゼント！
                      </p>
                    </div>

                    <Button
                      onClick={() => {
                        setIsOpen(false)
                        // Add navigation to signup page or other action
                      }}
                      size="lg"
                      className="w-full max-w-xs bg-black hover:bg-gray-800"
                    >
                      会員登録してクーポンをもらう
                    </Button>

                    <p className="text-sm text-gray-500">
                      ※クーポンは会員登録完了後、自動的に付与されます。
                      <br />
                      有効期限：登録日より30日間
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating button when sheet is closed */}
      {!isOpen && !isFirstVisit && !user && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-4 right-4 z-50 w-16 h-16 rounded-full bg-gray-600 shadow-lg 
            flex items-center justify-center hover:bg-gray-700 transition-colors
            shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.2)]"
        >
          <Gift className="w-8 h-8 text-white" />
        </motion.button>
      )}
    </>
  )
}

