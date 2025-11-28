"use client"

import dynamic from "next/dynamic"
import { useState } from "react"
import "@uiw/react-md-editor/markdown-editor.css"
import "@uiw/react-markdown-preview/markdown.css"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

interface MarkdownEditorProps {
  content: string
  onChange: (content: string) => void
}

export function MarkdownEditor({ content, onChange }: MarkdownEditorProps) {
  const [mounted, setMounted] = useState(false)

  // クライアントサイドでのみレンダリング
  if (typeof window !== "undefined" && !mounted) {
    setMounted(true)
  }

  if (!mounted) {
    return null
  }

  return (
    <div className="w-full" data-color-mode="light">
      <MDEditor
        value={content}
        onChange={(val) => onChange(val || "")}
        preview="edit"
        height={400}
        visibleDragbar={false}
        hideToolbar={false}
        enableScroll={true}
        textareaProps={{
          placeholder: "内容を入力してください...",
        }}
      />
    </div>
  )
}

