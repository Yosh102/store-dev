// app/group/[slug]/staff/[id]/page.tsx
"use client"

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { format } from 'date-fns'
import { ArrowLeft, ArrowRight, User, Calendar, Lock } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkBreaks from 'remark-breaks'
import remarkEmoji from 'remark-emoji'
import rehypeKatex from 'rehype-katex'
import rehypeHighlight from 'rehype-highlight'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import { deepmerge } from 'deepmerge-ts'
import { defaultSchema } from 'hast-util-sanitize'
import { useAuth } from '@/context/auth-context'
import { getStaffDiary, getGroup, resolveImageUrl, getGroupStaffDiaries } from '@/lib/staff-diary'
import type { StaffDiaryWithMembers } from '@/types/staff_diary'
import type { Group } from '@/types/group'
import { Button } from '@/components/ui/button'

// カスタムサニタイズスキーマ - より多くのHTMLタグとJavaScriptを許可
const customSanitizeSchema = deepmerge(defaultSchema, {
  tagNames: [
    // 標準HTMLタグ
    'iframe', 'embed', 'object', 'param', 'video', 'audio', 'source', 'track',
    'canvas', 'svg', 'path', 'circle', 'rect', 'polygon', 'ellipse', 'line',
    'details', 'summary', 'dialog', 'menu', 'menuitem',
    'form', 'input', 'textarea', 'select', 'option', 'button', 'label', 'fieldset', 'legend',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'a', 'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'small', 'sub', 'sup',
    'abbr', 'acronym', 'address', 'cite', 'code', 'kbd', 'samp', 'var', 'pre',
    'blockquote', 'q', 'figure', 'figcaption', 'img', 'picture',
    'script', 'style', 'noscript'
  ],
  attributes: {
    '*': [
      'id', 'class', 'style', 'title', 'lang', 'dir', 'hidden',
      'data*', 'aria*', 'role', 'tabindex', 'contenteditable'
    ],
    iframe: [
      'src', 'srcdoc', 'width', 'height', 'sandbox', 'allow', 'allowfullscreen',
      'frameborder', 'scrolling', 'name', 'loading'
    ],
    video: [
      'src', 'poster', 'width', 'height', 'controls', 'autoplay', 'loop', 'muted',
      'preload', 'crossorigin'
    ],
    audio: [
      'src', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'crossorigin'
    ],
    source: ['src', 'type', 'media', 'sizes', 'srcset'],
    img: [
      'src', 'alt', 'width', 'height', 'loading', 'decoding', 'sizes', 'srcset',
      'crossorigin', 'usemap', 'ismap'
    ],
    a: ['href', 'target', 'rel', 'download', 'hreflang', 'type'],
    form: ['action', 'method', 'enctype', 'autocomplete', 'novalidate', 'target'],
    input: [
      'type', 'name', 'value', 'placeholder', 'required', 'readonly', 'disabled',
      'checked', 'selected', 'multiple', 'min', 'max', 'step', 'pattern',
      'autocomplete', 'autofocus'
    ],
    textarea: [
      'name', 'placeholder', 'required', 'readonly', 'disabled', 'rows', 'cols',
      'wrap', 'autocomplete', 'autofocus'
    ],
    select: ['name', 'required', 'disabled', 'multiple', 'size', 'autocomplete'],
    option: ['value', 'selected', 'disabled', 'label'],
    button: ['type', 'name', 'value', 'disabled', 'autofocus'],
    script: ['src', 'type', 'async', 'defer', 'crossorigin', 'integrity', 'nonce'],
    style: ['type', 'media', 'nonce'],
    canvas: ['width', 'height'],
    svg: ['width', 'height', 'viewBox', 'xmlns', 'preserveAspectRatio'],
    path: ['d', 'fill', 'stroke', 'stroke-width'],
    circle: ['cx', 'cy', 'r', 'fill', 'stroke', 'stroke-width'],
    rect: ['x', 'y', 'width', 'height', 'fill', 'stroke', 'stroke-width'],
    table: ['border', 'cellpadding', 'cellspacing'],
    th: ['scope', 'colspan', 'rowspan', 'headers'],
    td: ['colspan', 'rowspan', 'headers']
  },
  protocols: {
    href: ['http', 'https', 'mailto', 'tel', 'ftp'],
    src: ['http', 'https', 'data'],
    action: ['http', 'https']
  }
})

// CodeBlock component for syntax highlighting
const CodeBlock = ({ className, children }: { className?: string; children: React.ReactNode }) => {
  const language = className?.replace('language-', '') || 'text'
  
  return (
    <div className="relative group">
      <div className="bg-gray-900 text-gray-100 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-sm text-gray-400">{language}</span>
          <button 
            onClick={() => navigator.clipboard.writeText(String(children))}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Copy
          </button>
        </div>
        <pre className="p-4 overflow-x-auto">
          <code className={className}>{children}</code>
        </pre>
      </div>
    </div>
  )
}

// Table component
const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="overflow-x-auto my-6">
    <table className="min-w-full border-collapse border border-gray-300">
      {children}
    </table>
  </div>
)

// Interactive component wrapper for form elements
const InteractiveWrapper = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    // Execute any scripts within the content
    const scripts = document.querySelectorAll('.markdown-content script')
    scripts.forEach((script) => {
      if (script.textContent) {
        try {
          // Create a new script element and execute it
          const newScript = document.createElement('script')
          newScript.textContent = script.textContent
          if (script.getAttribute('src')) {
            newScript.src = script.getAttribute('src') || ''
          }
          document.body.appendChild(newScript)
          
          // Clean up
          setTimeout(() => {
            document.body.removeChild(newScript)
          }, 100)
        } catch (error) {
          console.warn('Script execution failed:', error)
        }
      }
    })
  }, [children])

  return <div className="interactive-content">{children}</div>
}

export default function StaffDiaryDetailPage() {
  const params = useParams()
  const slug = params.slug as string
  const diaryId = params.id as string
  const { user } = useAuth()
  
  const [group, setGroup] = useState<Group | null>(null)
  const [diary, setDiary] = useState<StaffDiaryWithMembers | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [diaryNumber, setDiaryNumber] = useState<number>(1)

  // 開発環境チェック
  const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_ENV === 'development'

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        
        // 記事データを取得
        const diaryData = await getStaffDiary(diaryId)
        if (!diaryData) {
          setError('記事が見つかりません')
          return
        }
        
        setDiary(diaryData)
        
        // グループ情報を取得
        const groupData = await getGroup(diaryData.groupId)
        if (!groupData) {
          setError('グループが見つかりません')
          return
        }
        
        setGroup(groupData)

        // グループの全スタッフダイアリーを取得して順番を計算
        try {
          const allDiaries = await getGroupStaffDiaries(diaryData.groupId)
          // 公開日で昇順ソート
          allDiaries.sort((a, b) => a.publishDate.toDate().getTime() - b.publishDate.toDate().getTime())
          // 現在の記事の順番を見つける（diaryIdと一致するインデックスを探す）
          const currentIndex = allDiaries.findIndex((d, index) => {
            // 同じ公開日時の記事の中で現在の記事を特定
            const currentPublishTime = diaryData.publishDate.toDate().getTime()
            const itemPublishTime = d.publishDate.toDate().getTime()
            return itemPublishTime === currentPublishTime && d.title === diaryData.title
          })
          if (currentIndex !== -1) {
            setDiaryNumber(currentIndex + 1)
          }
        } catch (err) {
          console.error('Error fetching group diaries:', err)
          // エラーの場合はデフォルト値を使用
        }
        
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('データの取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [diaryId])

  // Load external stylesheets for enhanced rendering
  useEffect(() => {
    // Load KaTeX CSS for math rendering
    const katexCSS = document.createElement('link')
    katexCSS.rel = 'stylesheet'
    katexCSS.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css'
    document.head.appendChild(katexCSS)

    // Load highlight.js CSS for code syntax highlighting
    const hlCSS = document.createElement('link')
    hlCSS.rel = 'stylesheet'
    hlCSS.href = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/github-dark.min.css'
    document.head.appendChild(hlCSS)

    return () => {
      document.head.removeChild(katexCSS)
      document.head.removeChild(hlCSS)
    }
  }, [])

  // サブスクリプション状態をチェック（開発環境では常にtrue）
  const isSubscribed = isDevelopment || (group?.id && user?.subscriptions?.[group.id] 
    ? user.subscriptions[group.id].status === "active" 
    : false)

  if (loading) {
    return (
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-4 py-8">
          <div className="animate-pulse max-w-4xl mx-auto">
            <div className="h-6 bg-gray-700 rounded w-1/4 mb-8"></div>
            <div className="aspect-video bg-gray-700 rounded-lg mb-8"></div>
            <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-8"></div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-4 bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !diary || !group) {
    return (
      <div className="min-h-screen bg-black">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <p className="text-red-500 text-lg">{error || '記事が見つかりません'}</p>
            <Link 
              href={`/group/${slug}/staff`} 
              className="text-blue-400 hover:text-blue-300 mt-4 inline-block"
            >
              STAFF DIARY一覧に戻る
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // 開発環境では認証チェックをスキップ
  if (!isDevelopment && !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
        {/* Background Image with Parallax Effect */}
        <div className="absolute inset-0">
          <div className="relative w-full h-full">
            <Image
              src={resolveImageUrl(group.coverImage)}
              alt={group.name}
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
          <p className="text-white/90 mb-6 drop-shadow-lg">この記事を閲覧するにはログインしてください。</p>
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
    )
  }

  // 開発環境ではサブスクリプションチェックもスキップ
  if (!isDevelopment && !isSubscribed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
        {/* Background Image with Parallax Effect */}
        <div className="absolute inset-0">
          <div className="relative w-full h-full">
            <Image
              src={resolveImageUrl(group.coverImage)}
              alt={group.name}
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
          <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">メンバーシップが必要です</h2>
          <p className="text-white/90 mb-6 drop-shadow-lg">この記事を閲覧するには{group.name}のメンバーシップが必要です。</p>
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
    )
  }

  return (
    <div className="min-h-screen bg-black pt-16">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* 開発環境表示 */}
          {isDevelopment && (
            <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
              <strong>開発環境:</strong> 認証チェックがスキップされています
            </div>
          )}

          {/* ナビゲーション */}
          <nav className="mb-8">
            <Link 
              href={`/group/${slug}/staff`} 
              className="inline-flex items-center text-gray-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              STAFF DIARY一覧に戻る
            </Link>
          </nav>

          {/* 記事ヘッダー */}
          <header className="mb-8">
          <div className="relative aspect-video rounded-lg overflow-hidden mb-6">
              <Image
                src={resolveImageUrl(diary.thumbnailPrivate)}
                alt={diary.title}
                fill
                className="object-cover"
                priority
              />
            </div>

            {/* タイトル部分 - 画像のようなデザイン */}
            <div className="flex items-center gap-6 mb-6">
              {/* 大きなナンバリング */}
              <div className="text-4xl md:text-6xl font-bold text-white leading-none">
                #{String(diaryNumber).padStart(3, '0')}
              </div>
              
              {/* 日付とタイトル */}
              <div className="flex-1">
                <div className="text-base md:text-lg text-white mb-1">
                  {format(diary.publishDate.toDate(), "yyyy.MM.dd")}
                </div>
                <h1 className="text-lg md:text-xl font-bold text-white leading-tight">
                  {diary.title}
                </h1>
              </div>
            </div>
            {/* 関連メンバータグ */}
            {diary.relatedMemberDetails && diary.relatedMemberDetails.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                <span className="text-sm text-gray-400 mr-2">関連メンバー:</span>
                {diary.relatedMemberDetails.map((member) => (
                  <span 
                    key={member.id} 
                    className="bg-white/10 text-white px-3 py-1 rounded-full text-sm font-medium"
                  >
                    {member.name}
                  </span>
                ))}
              </div>
            )}
          </header>

          {/* 記事本文 */}
          <article className="rounded-lg shadow-sm text-white">
            <div className="markdown-content py-6">
              <InteractiveWrapper>
                <ReactMarkdown
                  remarkPlugins={[
                    remarkGfm,        // GitHub Flavored Markdown
                    remarkMath,       // Math expressions
                    remarkBreaks,     // Line breaks
                    remarkEmoji       // Emoji support
                  ]}
                  rehypePlugins={[
                    rehypeRaw,        // Allow raw HTML
                    [rehypeSanitize, customSanitizeSchema], // Sanitize with custom schema
                    rehypeKatex,      // Math rendering
                    rehypeHighlight   // Code syntax highlighting
                  ]}
                  components={{
                    // Enhanced styling with interactive support
                    h1: ({ children }) => (
                      <h1 className="text-3xl font-bold mb-6 text-white border-b pb-2">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="text-2xl font-bold mb-4 text-white mt-8">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="text-xl font-bold mb-3 text-white mt-6">
                        {children}
                      </h3>
                    ),
                    h4: ({ children }) => (
                      <h4 className="text-lg font-bold mb-2 text-white mt-4">
                        {children}
                      </h4>
                    ),
                    p: ({ children }) => (
                      <p className="mb-4 text-white leading-relaxed text-base">
                        {children}
                      </p>
                    ),
                    ul: ({ children }) => (
                      <ul className="list-disc list-inside mb-6 text-white space-y-2">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="list-decimal list-inside mb-6 text-white space-y-2">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="leading-relaxed">{children}</li>
                    ),
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-blue-500 pl-6 py-2 italic text-white mb-6 bg-gray-50 rounded-r">
                        {children}
                      </blockquote>
                    ),
                    code: ({ className, children }) => {
                      const isInline = !className
                      if (isInline) {
                        return (
                          <code className="bg-gray-100 px-2 py-1 rounded text-sm font-mono text-white">
                            {children}
                          </code>
                        )
                      }
                      return <CodeBlock className={className}>{children}</CodeBlock>
                    },
                    pre: ({ children }) => (
                      <div className="mb-6">{children}</div>
                    ),
                    table: ({ children }) => <Table>{children}</Table>,
                    thead: ({ children }) => (
                      <thead className="bg-gray-100">{children}</thead>
                    ),
                    tbody: ({ children }) => (
                      <tbody className="divide-y divide-gray-200">{children}</tbody>
                    ),
                    tr: ({ children }) => (
                      <tr className="hover:bg-gray-50">{children}</tr>
                    ),
                    th: ({ children }) => (
                      <th className="px-4 py-3 text-left text-sm font-semibold text-white border border-gray-300">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="px-4 py-3 text-sm text-white border border-gray-300">
                        {children}
                      </td>
                    ),
                    img: ({ src, alt, title }) => (
                      <div className="my-6">
                        <img
                          src={src}
                          alt={alt}
                          title={title}
                          className="max-w-full h-auto rounded-lg shadow-md mx-auto"
                          loading="lazy"
                        />
                        {title && (
                          <p className="text-center text-sm text-white mt-2 italic">
                            {title}
                          </p>
                        )}
                      </div>
                    ),
                    a: ({ href, children }) => (
                      <a
                        href={href}
                        className="text-blue-600 hover:text-blue-800 underline transition-colors"
                        target={href?.startsWith('http') ? '_blank' : undefined}
                        rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                      >
                        {children}
                      </a>
                    ),
                    // Enhanced form elements
                    input: ({ type, ...props }) => (
                      <input
                        type={type}
                        {...props}
                        className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    ),
                    textarea: ({ ...props }) => (
                      <textarea
                        {...props}
                        className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                      />
                    ),
                    select: ({ children, ...props }) => (
                      <select
                        {...props}
                        className="border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      >
                        {children}
                      </select>
                    ),
                    button: ({ children, ...props }) => (
                      <button
                        {...props}
                        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
                      >
                        {children}
                      </button>
                    ),
                    // iframe with responsive wrapper
                    iframe: ({ src, title, ...props }) => (
                      <div className="my-6">
                        <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                            src={src}
                            title={title}
                            {...props}
                            className="absolute top-0 left-0 w-full h-full rounded-lg shadow-md"
                            loading="lazy"
                          />
                        </div>
                      </div>
                    ),
                    // Video with controls
                    video: ({ src, ...props }) => (
                      <div className="my-6">
                        <video
                          src={src}
                          {...props}
                          controls
                          className="max-w-full h-auto rounded-lg shadow-md mx-auto"
                        />
                      </div>
                    ),
                    // Audio with custom styling
                    audio: ({ src, ...props }) => (
                      <div className="my-6">
                        <audio
                          src={src}
                          {...props}
                          controls
                          className="w-full"
                        />
                      </div>
                    ),
                    // Details/Summary for collapsible content
                    details: ({ children }) => (
                      <details className="my-4 border border-gray-200 rounded-lg">
                        {children}
                      </details>
                    ),
                    summary: ({ children }) => (
                      <summary className="px-4 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 font-medium">
                        {children}
                      </summary>
                    ),
                    // Div with custom styling support
                    div: ({ className, children, ...props }) => (
                      <div className={className} {...props}>
                        {children}
                      </div>
                    ),
                    // Span with custom styling support
                    span: ({ className, children, ...props }) => (
                      <span className={className} {...props}>
                        {children}
                      </span>
                    )
                  }}
                >
                  {diary.content}
                </ReactMarkdown>
              </InteractiveWrapper>
            </div>
          </article>

          {/* フッター */}
          <footer className="mt-8 text-center">
            <Link href={`/group/${slug}/staff`}>
              <Button 
                variant="outline" 
                size="default"
                className="w-full md:w-auto bg-white text-black hover:bg-gray-100 text-lg font-bold px-12 py-4 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-xl group"
              >
                他のSTAFF DIARYを見る
                <ArrowRight className="w-5 h-5 ml-2 transition-transform group-hover:translate-x-1" strokeWidth={2} />
              </Button>
            </Link>
          </footer>
        </div>
      </div>
    </div>
  )
}