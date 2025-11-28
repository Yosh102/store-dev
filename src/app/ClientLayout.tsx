"use client"

import type React from "react"
import { useEffect } from "react"
import { initializeCampaign } from "@/lib/campaign-utils"

interface ClientLayoutProps {
  children: React.ReactNode
}

export default function ClientLayout({ children }: ClientLayoutProps) {
  useEffect(() => {
    initializeCampaign()
  }, [])

  return <>{children}</>
}

