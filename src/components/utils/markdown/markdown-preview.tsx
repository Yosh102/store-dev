"use client"

import DOMPurify from 'isomorphic-dompurify'

interface MarkdownPreviewProps {
 content: string
}

export function MarkdownPreview({ content }: MarkdownPreviewProps) {
 const processContent = (text: string) => {
   let inTable = false
   let tableData: string[][] = []
   let currentRow: string[] = []

   return text
     .split('\n')
     .map(line => {
       // Handle Table
       if (line.includes('|')) {
         inTable = true
         const cells = line.split('|').slice(1, -1).map(cell => cell.trim())
         
         if (line.includes('---')) {
           return '' // Skip separator line
         }
         
         currentRow = cells
         tableData.push(currentRow)
         
         if (tableData.length > 1) {
           const tableHtml = `
             <table class="min-w-full divide-y divide-gray-200">
               <thead>
                 <tr>
                   ${tableData[0].map(header => `<th class="px-6 py-3 bg-gray-50">${header}</th>`).join('')}
                 </tr>
               </thead>
               <tbody>
                 ${tableData.slice(1).map(row => `
                   <tr>
                     ${row.map(cell => `<td class="px-6 py-4">${cell}</td>`).join('')}
                   </tr>
                 `).join('')}
               </tbody>
             </table>
           `
           tableData = []
           return tableHtml
         }
         return ''
       } else {
         inTable = false
       }

       // Headers
       if (line.startsWith('###### ')) return `<h6>${line.slice(7)}</h6>`
       if (line.startsWith('##### ')) return `<h5>${line.slice(6)}</h5>`
       if (line.startsWith('#### ')) return `<h4>${line.slice(5)}</h4>`
       if (line.startsWith('### ')) return `<h3>${line.slice(4)}</h3>`
       if (line.startsWith('## ')) return `<h2>${line.slice(3)}</h2>`
       if (line.startsWith('# ')) return `<h1>${line.slice(2)}</h1>`

       // Images
       if (line.match(/!\[([^\]]*)\]\(([^)]+)\)/)) {
         return line.replace(/!\[([^\]]*)\]\(([^)]+)\)/, '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg">')
       }

       // Code blocks
       if (line.startsWith('```')) return '<pre><code>'
       if (line.endsWith('```')) return '</code></pre>'

       // Lists
       if (line.match(/^\d+\. /)) return `<ol><li>${line.replace(/^\d+\. /, '')}</li></ol>`
       if (line.startsWith('- ')) return `<ul><li>${line.slice(2)}</li></ul>`

       // Links
       line = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

       // Emphasis
       line = line.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
       line = line.replace(/\*([^*]+)\*/g, '<em>$1</em>')

       // Paragraphs
       if (line.trim() && !line.startsWith('<')) return `<p>${line}</p>`

       return line
     })
     .join('\n')
 }

 return (
   <div 
     className="markdown-content space-y-4"
     dangerouslySetInnerHTML={{
       __html: DOMPurify.sanitize(processContent(content), {
         ADD_TAGS: [
           'iframe', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
           'p', 'a', 'strong', 'em', 'code', 'pre',
           'ul', 'ol', 'li', 'blockquote', 'hr',
           'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img'
         ],
         ADD_ATTR: [
           'href', 'target', 'rel',
           'allow', 'allowfullscreen', 'frameborder', 
           'src', 'title', 'referrerpolicy', 
           'width', 'height', 'class', 'alt'
         ]
       })
     }}
   />
 )
}