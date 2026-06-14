'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

import { motion, AnimatePresence } from 'framer-motion'
import {
  Send,
  Loader2,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  Folder,
  Settings,
  Check,
  ChevronDown,
  ChevronUp,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Eye,
  FolderTree,
  FileText,
  FolderOpen,
  Zap,
  Maximize2,
  Minimize2,
  ExternalLink,
  RotateCw,
  X,
  Paperclip,
  ImageIcon,
  Terminal,
  ChevronRight,
  Download,
  Github,
  Rocket,
  Globe,
  CheckCircle2,
  ArrowUpRight,
  MailCheck,
  Package,
  Copy,
  Link2,
  Pencil,
  History,
  RotateCcw,
  BarChart3,
  TrendingUp,
  Globe2,
  Smartphone,
  Tablet,
  Monitor,
  Server,
  Plug,
  GitPullRequest,
  ScanSearch,
  CircleDot,
  GitBranch,
  GitMerge,
  Train,
  Wrench,
  Search,
} from 'lucide-react'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { TURBO_MODELS } from '@/lib/turbo-config'
import { CODE_TEMPLATES } from '@/lib/claude-code-templates'
import { useI18n } from '@/lib/i18n-context'
import { buildFrameworkPreview, classifyFileChanges, type FrameworkPreviewResult } from '@/lib/framework-preview'

// Editor Monaco (Fase 3) — carga diferida, solo cliente.
const CodeEditorModal = nextDynamic(() => import('@/components/code-editor-modal'), { ssr: false })

// ----------------------------------------------------------------------------
// CODE ENGINE — "Invisible IDE" (white minimalist UI)
// ----------------------------------------------------------------------------
// Aesthetic: pure white background, soft gray accents, capsule input,
// Activity Feed instead of chat bubbles, dual-pane layout (chat | preview).
// Code blocks and JSON envelopes are hidden by default.
// ----------------------------------------------------------------------------

const CODE_MODELS = TURBO_MODELS.filter((m) =>
  m.id.startsWith('anthropic/') ||
  m.id.startsWith('openai/') ||
  m.id.startsWith('deepseek/') ||
  m.id === 'google/gemini-3.1-pro-preview',
)

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4.6'

interface CodeMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  status: 'pending' | 'streaming' | 'completed' | 'failed'
  error?: string | null
  createdAt: string
}

interface BridgeCommand {
  id: string
  sessionId: string
  messageId: string | null
  type: string
  payload: string
  status: 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed' | 'generating'
  result?: string | null
  error?: string | null
  streamOutput?: string | null
  requiresConfirmation: boolean
  createdAt: string
  completedAt?: string | null
}

interface CodeSession {
  id: string
  model: string
  title: string
  updatedAt: string
  _count?: { messages: number; commands: number }
}

interface BridgeStatus {
  online: boolean
  lastSeen?: string | null
}

/** Safely parse a payload/result that may be a JSON string or already an object */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safeJsonParse<T = Record<string, any>>(val: unknown, fallback?: T): T {
  if (!val) return (fallback ?? {}) as T
  if (typeof val === 'object') return val as T
  try { return JSON.parse(val as string) } catch { return (fallback ?? {}) as T }
}

interface WorkspaceFile {
  path: string
  isDir: boolean
  size: number
}

interface WorkspaceData {
  indexed: boolean
  fileCount?: number
  totalSize?: number
  rootPath?: string
  lastScanAt?: string
  tree?: WorkspaceFile[]
}

interface FileChangeItem {
  id: string
  eventType: string
  filePath: string
  fileSize?: number
  isDir: boolean
  detectedAt: string
}

// ----------------------------------------------------------------------------
// Action metadata: human-friendly labels + soft icons
// ----------------------------------------------------------------------------
function getActionMeta(type: string, t: (key: string) => string) {
  switch (type) {
    case 'write_file':
      return { label: t('ce.action_write'), labelDone: t('ce.action_write_done'), emoji: '📄' }
    case 'read_file':
      return { label: t('ce.action_read'), labelDone: t('ce.action_read_done'), emoji: '📖' }
    case 'create_dir':
      return { label: t('ce.action_mkdir'), labelDone: t('ce.action_mkdir_done'), emoji: '📁' }
    case 'read_dir':
      return { label: t('ce.action_ls'), labelDone: t('ce.action_ls_done'), emoji: '🗂' }
    case 'open_path':
      return { label: t('ce.action_open'), labelDone: t('ce.action_open_done'), emoji: '↗' }
    case 'delete_file':
      return { label: t('ce.action_delete'), labelDone: t('ce.action_delete_done'), emoji: '🗑' }
    case 'execute_cmd':
      return { label: t('ce.action_exec'), labelDone: t('ce.action_exec_done'), emoji: '⚡' }
    case 'save_image':
      return { label: t('ce.action_save_image'), labelDone: t('ce.action_save_image_done'), emoji: '🎨' }
    default:
      return { label: type, labelDone: type, emoji: '•' }
  }
}

// StageMark replaced by numbered step indicators in ActivityRow

// ----------------------------------------------------------------------------
// Determine parent folder of a path (for "Abrir carpeta" button)
// ----------------------------------------------------------------------------
function parentDir(p: string | undefined): string {
  if (!p) return ''
  const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
  if (parts.length <= 1) return ''
  return parts.slice(0, -1).join('/')
}

function isHtmlPath(p: string | undefined): boolean {
  return !!p && /\.html?$/i.test(p)
}

// ----------------------------------------------------------------------------
// Single activity row — humanized command summary, no JSON, no terminal
// ----------------------------------------------------------------------------
function ActivityRow({
  command,
  index,
  total,
  onConfirm,
  onReject,
  onSelect,
  selected,
  onOpenPath,
  onPreviewHtml,
  onEditFile,
  t,
}: {
  command: BridgeCommand
  index: number
  total: number
  onConfirm: (id: string) => void
  onReject: (id: string) => void
  onSelect: (id: string) => void
  selected: boolean
  onOpenPath: (path: string) => void
  onPreviewHtml: (cmdId: string) => void
  onEditFile?: (path: string, content: string) => void
  t: (key: string) => string
}) {
  const meta = getActionMeta(command.type, t)
  let payload: { path?: string; command?: string } = {}
  payload = safeJsonParse(command.payload)

  const target = payload.path
    ? payload.path
    : payload.command
      ? payload.command.length > 48 ? payload.command.slice(0, 48) + '…' : payload.command
      : ''

  // save_image commands are managed by the image-gen pipeline — never show as "failed" red
  const isImageCmd = command.type === 'save_image'
  const effectiveStatus = isImageCmd && command.status === 'failed' ? 'approved' : command.status

  const isFinal = effectiveStatus === 'completed' || effectiveStatus === 'failed' || effectiveStatus === 'rejected'
  const label = effectiveStatus === 'completed' ? meta.labelDone
    : effectiveStatus === 'failed' ? meta.label
    : isFinal ? meta.labelDone : meta.label

  const isPending = effectiveStatus === 'pending'

  // Show "Abrir" chips for completed file/folder operations
  const showOpenChips =
    effectiveStatus === 'completed' &&
    payload.path &&
    (command.type === 'write_file' ||
      command.type === 'create_dir' ||
      command.type === 'read_dir' ||
      command.type === 'read_file' ||
      command.type === 'delete_file' ||
      command.type === 'open_path' ||
      command.type === 'save_image')

  return (
    <div
      onClick={() => onSelect(command.id)}
      className={`group rounded-xl px-3 py-2.5 transition cursor-pointer ${
        selected ? 'bg-zinc-100' : 'hover:bg-zinc-50'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Step number + status indicator */}
        <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 border" style={{
          background: effectiveStatus === 'completed' ? '#ecfdf5' : effectiveStatus === 'executing' ? '#18181b' : effectiveStatus === 'failed' ? '#fef2f2' : '#fafafa',
          borderColor: effectiveStatus === 'completed' ? '#86efac' : effectiveStatus === 'executing' ? '#3f3f46' : effectiveStatus === 'failed' ? '#fca5a5' : '#e4e4e7',
          color: effectiveStatus === 'completed' ? '#059669' : effectiveStatus === 'executing' ? '#fbbf24' : effectiveStatus === 'failed' ? '#dc2626' : '#a1a1aa',
        }}>
          {effectiveStatus === 'completed' ? '✓' : effectiveStatus === 'failed' ? '✕' : effectiveStatus === 'executing' ? (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          ) : (index + 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] text-zinc-900">{label}</span>
            {target && (
              <span className="text-[13px] text-zinc-400 truncate">
                {target}
              </span>
            )}
          </div>
          {effectiveStatus === 'failed' && command.error && (
            <div className="text-xs text-rose-600 mt-1 line-clamp-2">
              {sanitizeError(command.error)}
            </div>
          )}
        </div>
      </div>

      {/* Smart action chips on completion */}
      {showOpenChips && (
        <div
          className="mt-2 ml-7 flex flex-wrap items-center gap-1.5"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Open file (for write_file, read_file) */}
          {(command.type === 'write_file' || command.type === 'read_file' || command.type === 'save_image') && payload.path && (
            <button
              onClick={() => onOpenPath(payload.path!)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition flex items-center gap-1"
              title={t('ce.chip_open_file')}
            >
              ↗ {t('ce.chip_open_file')}
            </button>
          )}
          {/* Open parent folder for files, or self for folders */}
          {command.type !== 'delete_file' && (
            <button
              onClick={() =>
                onOpenPath(
                  command.type === 'write_file' || command.type === 'read_file' || command.type === 'save_image'
                    ? parentDir(payload.path)
                    : payload.path || '',
                )
              }
              className="text-[11px] px-2.5 py-1 rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition flex items-center gap-1"
              title={t('ce.chip_open_folder')}
            >
              📁 {t('ce.chip_open_folder')}
            </button>
          )}
          {/* Preview HTML in right pane */}
          {command.type === 'write_file' && isHtmlPath(payload.path) && (
            <button
              onClick={() => onPreviewHtml(command.id)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition flex items-center gap-1"
              title={t('ce.chip_preview')}
            >
              ◉ {t('ce.chip_preview')}
            </button>
          )}
          {/* Edit file in Monaco editor */}
          {command.type === 'write_file' && payload.path && onEditFile && (
            <button
              onClick={() => onEditFile(payload.path!, (payload as Record<string, unknown>).content as string ?? '')}
              className="text-[11px] px-2.5 py-1 rounded-full border border-violet-200 text-violet-600 hover:bg-violet-600 hover:text-white hover:border-violet-600 transition flex items-center gap-1"
              title={t('ce.chip_edit')}
            >
              ✎ {t('ce.chip_edit')}
            </button>
          )}
        </div>
      )}

      {/* Inline image thumbnail for completed save_image commands */}
      {command.type === 'save_image' && (effectiveStatus === 'completed' || effectiveStatus === 'approved') && (() => {
        const imgUrl = (payload as Record<string, unknown>).url as string || ''
        const imgPrompt = (payload as Record<string, unknown>).prompt as string || ''
        return imgUrl ? (
          <div className="mt-2 ml-7" onClick={(e) => e.stopPropagation()}>
            <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-md transition-all max-w-[240px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt={imgPrompt || payload.path || 'Imagen generada'} className="w-full h-auto object-cover" loading="lazy" />
            </a>
            {imgPrompt && (
              <div className="text-[10px] text-zinc-400 mt-1.5 italic line-clamp-2 max-w-[240px]">{imgPrompt}</div>
            )}
          </div>
        ) : null
      })()}

      {/* Live terminal output for execute_cmd — Apple-style log viewer */}
      {command.type === 'execute_cmd' && command.streamOutput && (
        <div className="mt-2 ml-7 rounded-xl bg-zinc-50 border border-zinc-200/80 text-[11px] font-mono p-3 max-h-[160px] overflow-y-auto whitespace-pre-wrap break-all scrollbar-thin scrollbar-thumb-zinc-300">
          <div className="flex items-center gap-1.5 text-zinc-400 mb-1.5 text-[10px]">
            {command.status === 'executing' ? (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span className="text-amber-600">{t('ce.terminal_live')}</span>
              </>
            ) : (
              <>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-zinc-300" />
                <span>{t('ce.terminal_output')}</span>
              </>
            )}
          </div>
          <div className="text-zinc-600 leading-relaxed">{command.streamOutput}</div>
        </div>
      )}

      {/* Pending confirmation buttons (delete / execute) */}
      {isPending && (
        <div
          className="mt-2 ml-7 flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-xs text-amber-700 flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {t('ce.needs_approval')}
          </span>
          <button
            onClick={() => onConfirm(command.id)}
            className="text-xs px-3 py-1 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition"
          >
            {t('ce.approve')}
          </button>
          <button
            onClick={() => onReject(command.id)}
            className="text-xs px-3 py-1 rounded-full border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition"
          >
            {t('ce.reject')}
          </button>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Friendly error sanitizer — trims stack traces & raw paths
// ----------------------------------------------------------------------------
function sanitizeError(err: string): string {
  if (!err) return 'Error'
  const firstLine = err.split('\n')[0]
  // Hide raw paths / stack-ish noise
  return firstLine.length > 120 ? firstLine.slice(0, 117) + '…' : firstLine
}

// ----------------------------------------------------------------------------
// Tiny markdown renderer — minimal subset (headings, bold/italic/links/inline)
// ----------------------------------------------------------------------------
function tinyMarkdown(src: string): string {
  const escape = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

  const lines = src.split('\n')
  const out: string[] = []
  let inCode = false
  let inList = false
  let codeLines: string[] = []
  let codeLang = ''

  for (const ln of lines) {
    if (/^```/.test(ln)) {
      if (!inCode) {
        // Opening fence — capture language hint
        inCode = true
        codeLang = ln.replace(/^```/, '').trim()
        codeLines = []
      } else {
        // Closing fence — render collapsible code block
        inCode = false
        const lineCount = codeLines.length
        const langLabel = codeLang || 'code'
        const codeContent = codeLines.join('\n')
        // Collapsible for blocks > 15 lines
        if (lineCount > 15) {
          out.push(
            `<details class="ce-code-details group/code my-2">` +
            `<summary class="flex items-center gap-2 cursor-pointer select-none text-[11px] text-zinc-400 hover:text-zinc-600 transition py-1">` +
            `<span class="font-mono">${escape(langLabel)}</span>` +
            `<span class="text-zinc-300">·</span>` +
            `<span>${lineCount} líneas</span>` +
            `<span class="ml-auto text-[10px] group-open/code:hidden">[expandir ▾]</span>` +
            `<span class="ml-auto text-[10px] hidden group-open/code:inline">[colapsar ▴]</span>` +
            `</summary>` +
            `<pre class="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto max-h-[70vh] font-mono leading-relaxed"><code>${codeContent}</code></pre>` +
            `</details>`
          )
        } else {
          // Short blocks — show directly with reasonable max-height
          out.push(
            `<div class="my-2">` +
            `<div class="text-[10px] text-zinc-400 font-mono mb-1">${escape(langLabel)}</div>` +
            `<pre class="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto max-h-[400px] font-mono leading-relaxed"><code>${codeContent}</code></pre>` +
            `</div>`
          )
        }
      }
      continue
    }
    if (inCode) { codeLines.push(escape(ln)); continue }

    if (/^#{1,6}\s/.test(ln)) {
      const lvl = ln.match(/^#+/)![0].length
      const text = ln.replace(/^#+\s/, '')
      const sizes = ['', 'text-2xl', 'text-xl', 'text-lg', 'text-base', 'text-sm', 'text-xs']
      out.push(`<h${lvl} class="font-semibold ${sizes[lvl] || 'text-base'} mt-3 mb-2 text-zinc-900">${escape(text)}</h${lvl}>`)
      continue
    }

    if (/^\s*[-*]\s/.test(ln)) {
      if (!inList) { out.push('<ul class="list-disc pl-5 space-y-1">'); inList = true }
      out.push(`<li>${inlineMd(escape(ln.replace(/^\s*[-*]\s/, '')))}</li>`)
      continue
    }
    if (inList) { out.push('</ul>'); inList = false }

    if (ln.trim() === '') { out.push('<br/>'); continue }

    out.push(`<p class="text-sm text-zinc-700 leading-relaxed">${inlineMd(escape(ln))}</p>`)
  }
  if (inList) out.push('</ul>')
  if (inCode && codeLines.length > 0) {
    // Unclosed fence — render what we have
    out.push(`<pre class="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto max-h-[400px] font-mono leading-relaxed"><code>${codeLines.join('\n')}</code></pre>`)
  }

  return out.join('\n')
}
function inlineMd(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="px-1 rounded bg-zinc-100 text-zinc-800 text-[12px]">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-amber-600 underline" target="_blank" rel="noopener">$1</a>')
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// Project Preview — combines HTML/CSS/JS from the same folder into one iframe
// ----------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// HMR Preview Engine — Sprint 6
// ---------------------------------------------------------------------------

/** Extract deduplicated file map from commands (includes approved/executing for instant preview) */
function extractProjectFiles(commands: BridgeCommand[]): Map<string, { path: string; content: string }> {
  const fileMap = new Map<string, { path: string; content: string }>()
  // Process in order so later writes win (last-write-wins dedup)
  const writes = commands.filter(
    (c) => c.type === 'write_file' && ['completed', 'approved', 'executing'].includes(c.status),
  )
  for (const w of writes) {
    try {
      const p = safeJsonParse(w.payload)
      if (p.path && p.content) {
        const normalized = p.path.replace(/\\/g, '/')
        fileMap.set(normalized, { path: normalized, content: p.content })
      }
    } catch {}
  }
  return fileMap
}

/** Build combined HTML from file map, with HMR runtime + data-hmr-file attributes */
function buildProjectHtmlFromFiles(fileMap: Map<string, { path: string; content: string }>): string | null {
  const files = Array.from(fileMap.values())
  if (files.length === 0) return null

  // Find the HTML entry — prefer the LATEST project (last in map insertion order)
  // so that when multiple projects exist (e.g. hero-react + octomotion),
  // the most recently written project is previewed.
  const reversed = [...files].reverse()
  const htmlFile =
    reversed.find((f) => /index\.html?$/i.test(f.path)) ||
    reversed.find((f) => /\.html?$/i.test(f.path))
  if (!htmlFile) return null

  const htmlDir = htmlFile.path.split('/').slice(0, -1).join('/')

  const cssFiles = files.filter((f) => /\.css$/i.test(f.path) && (htmlDir === '' || f.path.startsWith(htmlDir + '/')))
  const jsFiles = files.filter((f) => /\.(m?jsx?|tsx?)$/i.test(f.path) && (htmlDir === '' || f.path.startsWith(htmlDir + '/')))

  let html = htmlFile.content

  // Build set of local filenames to strip
  const localFileNames = new Set<string>()
  for (const f of [...cssFiles, ...jsFiles]) {
    const name = f.path.split('/').pop() || ''
    if (name) localFileNames.add(name.toLowerCase())
  }

  // Strip local <link> stylesheet refs
  html = html.replace(
    /<link\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (match, href) => {
      const fileName = href.split('/').pop()?.toLowerCase() || ''
      if (localFileNames.has(fileName) && /rel\s*=\s*["']stylesheet["']/i.test(match)) {
        return `<!-- inlined: ${href} -->`
      }
      return match
    },
  )

  // Strip local <script src> refs
  html = html.replace(
    /<script\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>\s*<\/script>/gi,
    (match, src) => {
      const fileName = src.split('/').pop()?.toLowerCase() || ''
      if (localFileNames.has(fileName)) return `<!-- inlined: ${src} -->`
      return match
    },
  )

  // Inject CSS as <style data-hmr-file="...">
  if (cssFiles.length > 0) {
    const cssBlock = cssFiles
      .map((f) => `<style data-hmr-file="${f.path}">/* ${f.path} */\n${f.content}</style>`)
      .join('\n')
    if (html.includes('</head>')) {
      html = html.replace('</head>', cssBlock + '\n</head>')
    } else {
      html = cssBlock + '\n' + html
    }
  }

  // Detect if Babel standalone is loaded (React UMD + JSX setup)
  const hasBabel = /babel(?:\.min)?\.js/i.test(html) || /unpkg\.com\/@babel\/standalone/i.test(html)

  // Inject JS as <script data-hmr-file="...">
  if (jsFiles.length > 0) {
    const jsBlock = jsFiles
      .map((f) => {
        let code = f.content
        const isJSX = /\.tsx?$/i.test(f.path) || /\.jsx$/i.test(f.path)
        const looksLikeJSX = isJSX || (hasBabel && (/<[A-Z]/.test(code) || /React\.createElement/.test(code) || /className\s*=/.test(code)))
        if (isJSX) {
          code = `try {\n${code}\n} catch(e) { console.warn('Preview JSX error:', e); }`
        }
        // Use type="text/babel" when Babel is present and code contains JSX
        const scriptType = (hasBabel && looksLikeJSX) ? ' type="text/babel"' : ''
        return `<script${scriptType} data-hmr-file="${f.path}">/* ${f.path} */\n${code}</script>`
      })
      .join('\n')
    if (html.includes('</body>')) {
      html = html.replace('</body>', jsBlock + '\n</body>')
    } else {
      html = html + '\n' + jsBlock
    }
  }

  // Inject global error catcher to prevent blank previews on JS errors
  const errorCatcher = `<script data-error-catcher>
window.addEventListener('error', function(e) {
  if (document.body && !document.body.children.length) {
    document.body.innerHTML = '<div style="color:#ff6b6b;background:#1a0a0a;padding:2rem;font-family:monospace;border-radius:12px;margin:2rem">' +
      '<h3 style="margin:0 0 1rem">⚠️ Preview Error</h3>' +
      '<p style="color:#ff9999;font-size:14px">' + (e.message || 'Unknown error') + '</p>' +
      '<p style="color:#666;font-size:12px;margin-top:0.5rem">' + (e.filename || '') + ':' + (e.lineno || '') + '</p></div>';
  }
});
</script>`
  if (html.includes('</head>')) {
    html = html.replace('</head>', errorCatcher + '\n</head>')
  } else if (html.includes('<body')) {
    html = html.replace(/<body[^>]*>/i, (m) => m + '\n' + errorCatcher)
  }

  // Inject HMR runtime before </body> (or at end)
  const hmrRuntime = `<script data-hmr-runtime>
(function(){
  var v=0;
  window.addEventListener('message',function(e){
    var d=e.data;if(!d||!d.type)return;
    if(d.type==='hmr:css'){
      var s=document.querySelector('style[data-hmr-file="'+d.file+'"]');
      if(s){s.textContent=d.content}
      else{s=document.createElement('style');s.setAttribute('data-hmr-file',d.file);s.textContent=d.content;document.head.appendChild(s)}
      v++;window.parent.postMessage({type:'hmr:ack',file:d.file,v:v},'*');
    }
    if(d.type==='hmr:js'){
      var o=document.querySelector('script[data-hmr-file="'+d.file+'"]');if(o)o.remove();
      var ns=document.createElement('script');ns.setAttribute('data-hmr-file',d.file);ns.textContent=d.content;document.body.appendChild(ns);
      v++;window.parent.postMessage({type:'hmr:ack',file:d.file,v:v},'*');
    }
  });
  window.parent.postMessage({type:'hmr:ready'},'*');
})()
</script>`
  if (html.includes('</body>')) {
    html = html.replace('</body>', hmrRuntime + '\n</body>')
  } else {
    html = html + '\n' + hmrRuntime
  }

  return html
}

/** Legacy wrapper for compatibility */
function buildProjectHtml(commands: BridgeCommand[]): string | null {
  return buildProjectHtmlFromFiles(extractProjectFiles(commands))
}

const PREVIEW_CACHE_KEY = 'octopus_preview_cache'

function cachePreview(html: string) {
  try { localStorage.setItem(PREVIEW_CACHE_KEY, html) } catch {}
}

function getCachedPreview(): string | null {
  try { return localStorage.getItem(PREVIEW_CACHE_KEY) } catch { return null }
}

function ProjectPreview({ commands, refreshKey, t, fullscreen, onRuntimeErrors }: { commands: BridgeCommand[]; refreshKey?: number; t: (key: string) => string; fullscreen?: boolean; onRuntimeErrors?: (errors: string[]) => void }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const prevFilesRef = useRef<Map<string, string>>(new Map()) // path → content
  const hmrReadyRef = useRef(false)
  const [liveHtml, setLiveHtml] = useState<string | null>(null)
  const [htmlVersion, setHtmlVersion] = useState(0) // increments on every full rebuild → forces iframe remount
  const [showRaw, setShowRaw] = useState(false)
  const [isCached, setIsCached] = useState(false)
  const [syncPulse, setSyncPulse] = useState(false)
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const ackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Extract current file map
  const currentFiles = useMemo(() => extractProjectFiles(commands), [commands])

  // Helper: full rebuild (sets html + increments version to force iframe remount)
  const doFullRebuild = useCallback((html: string) => {
    setLiveHtml(html)
    setHtmlVersion((v) => v + 1)
    cachePreview(html)
    hmrReadyRef.current = false // new iframe will send hmr:ready
  }, [])

  // HMR diff + update logic
  useEffect(() => {
    const newFileMap = currentFiles
    const prev = prevFilesRef.current

    const fullHtml = buildProjectHtmlFromFiles(newFileMap)
    if (!fullHtml) {
      prevFilesRef.current = new Map(Array.from(newFileMap.entries()).map(([k, v]) => [k, v.content]))
      return
    }

    // If iframe HMR not ready or no previous state → full rebuild
    if (!hmrReadyRef.current || prev.size === 0) {
      doFullRebuild(fullHtml)
      prevFilesRef.current = new Map(Array.from(newFileMap.entries()).map(([k, v]) => [k, v.content]))
      return
    }

    // Diff: find changed files
    const changed: { path: string; content: string; ext: string }[] = []
    for (const [path, file] of newFileMap) {
      const oldContent = prev.get(path)
      if (oldContent !== file.content) {
        const ext = path.split('.').pop()?.toLowerCase() || ''
        changed.push({ path, content: file.content, ext })
      }
    }

    if (changed.length === 0) {
      prevFilesRef.current = new Map(Array.from(newFileMap.entries()).map(([k, v]) => [k, v.content]))
      return
    }

    // Check if ALL changes are CSS-only → try hot swap via postMessage
    const allCss = changed.every((c) => c.ext === 'css')
    const iframe = iframeRef.current

    if (allCss && iframe?.contentWindow && hmrReadyRef.current) {
      // CSS hot swap — send via postMessage
      for (const c of changed) {
        iframe.contentWindow.postMessage({ type: 'hmr:css', file: c.path, content: c.content }, '*')
      }
      // Fallback: if no ack within 600ms, force full rebuild
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current)
      ackTimerRef.current = setTimeout(() => {
        console.log('[HMR] No ack received — falling back to full rebuild')
        doFullRebuild(fullHtml)
      }, 600)
    } else if (iframe?.contentWindow && hmrReadyRef.current && changed.every((c) => ['js', 'mjs', 'jsx', 'ts', 'tsx'].includes(c.ext))) {
      // JS-only changes — hot swap
      for (const c of changed) {
        let code = c.content
        if (['tsx', 'ts', 'jsx'].includes(c.ext)) {
          code = `try {\n${code}\n} catch(e) { console.warn('Preview JSX error:', e); }`
        }
        iframe.contentWindow.postMessage({ type: 'hmr:js', file: c.path, content: code }, '*')
      }
      // Fallback for JS too
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current)
      ackTimerRef.current = setTimeout(() => {
        console.log('[HMR] No JS ack — falling back to full rebuild')
        doFullRebuild(fullHtml)
      }, 600)
    } else {
      // Structural / HTML / mixed changes → full rebuild
      doFullRebuild(fullHtml)
    }

    // Trigger sync pulse
    setSyncPulse(true)
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
    syncTimerRef.current = setTimeout(() => setSyncPulse(false), 1200)

    prevFilesRef.current = new Map(Array.from(newFileMap.entries()).map(([k, v]) => [k, v.content]))
  }, [currentFiles, doFullRebuild])

  // Listen for HMR messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.type === 'hmr:ready') {
        hmrReadyRef.current = true
        console.log('[HMR] iframe ready')
      }
      if (e.data.type === 'hmr:ack') {
        // Cancel fallback timer — hot swap succeeded
        if (ackTimerRef.current) { clearTimeout(ackTimerRef.current); ackTimerRef.current = null }
        console.log('[HMR] ack:', e.data.file)
        setSyncPulse(true)
        if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
        syncTimerRef.current = setTimeout(() => setSyncPulse(false), 800)
      }
    }
    window.addEventListener('message', handler)
    return () => {
      window.removeEventListener('message', handler)
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current)
      if (ackTimerRef.current) clearTimeout(ackTimerRef.current)
    }
  }, [])

  // Display HTML (with cache fallback) — avoid setState during render
  const cachedHtml = useMemo(() => getCachedPreview(), [])
  const displayHtml = liveHtml || cachedHtml || null

  useEffect(() => {
    if (!liveHtml && cachedHtml && !isCached) setIsCached(true)
  }, [liveHtml, cachedHtml, isCached])

  // Sync indicator element
  const syncIndicator = syncPulse ? (
    <span className="inline-flex items-center gap-1 text-[10px] text-emerald-500 font-medium animate-pulse">
      <Zap className="w-3 h-3" />
      <span>HMR</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-300">
      <span className="w-1.5 h-1.5 rounded-full bg-zinc-300 inline-block" />
      <span>{t('ce.hmr_idle')}</span>
    </span>
  )

  // Composite key: forces iframe remount on full rebuilds OR manual refresh
  const iframeKey = `project-${refreshKey || 0}-v${htmlVersion}`

  // ── Smart Framework Detection ──────────────────────────────────────
  // Detect React/Vite/Next.js/Vue projects that can't render in iframe
  const frameworkInfo = useMemo(() => {
    const files = Array.from(currentFiles.values())
    if (files.length === 0) return null

    let framework = ''
    let buildCmd = ''
    let devCmd = ''
    let projectRoot = ''

    // Check package.json
    const pkgFile = files.find((f) => /package\.json$/i.test(f.path))
    if (pkgFile) {
      try {
        const pkg = JSON.parse(pkgFile.content)
        const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
        projectRoot = pkgFile.path.split('/').slice(0, -1).join('/')

        if (allDeps['next']) { framework = 'Next.js'; devCmd = 'npm run dev'; buildCmd = 'npm run build' }
        else if (allDeps['vite'] || allDeps['@vitejs/plugin-react']) { framework = 'Vite + React'; devCmd = 'npm run dev'; buildCmd = 'npm run build' }
        else if (allDeps['react-scripts']) { framework = 'Create React App'; devCmd = 'npm start'; buildCmd = 'npm run build' }
        else if (allDeps['vue']) { framework = 'Vue.js'; devCmd = 'npm run dev'; buildCmd = 'npm run build' }
        else if (allDeps['svelte']) { framework = 'Svelte'; devCmd = 'npm run dev'; buildCmd = 'npm run build' }
        else if (allDeps['@angular/core']) { framework = 'Angular'; devCmd = 'ng serve'; buildCmd = 'ng build' }
        else if (allDeps['react']) { framework = 'React'; devCmd = 'npm start'; buildCmd = 'npm run build' }
      } catch {}
    }

    // Fallback: check for config files
    if (!framework) {
      if (files.some((f) => /vite\.config\.(ts|js|mjs)$/i.test(f.path))) { framework = 'Vite'; devCmd = 'npm run dev'; buildCmd = 'npm run build' }
      else if (files.some((f) => /next\.config\.(ts|js|mjs)$/i.test(f.path))) { framework = 'Next.js'; devCmd = 'npm run dev'; buildCmd = 'npm run build' }
      else if (files.some((f) => /webpack\.config\.(ts|js)$/i.test(f.path))) { framework = 'Webpack'; devCmd = 'npm run dev'; buildCmd = 'npm run build' }
    }

    // Fallback: check for .tsx/.jsx with import statements (not plain script.js)
    if (!framework) {
      const hasTsx = files.some((f) => /\.(tsx|jsx)$/i.test(f.path) && /^import\s/m.test(f.content))
      if (hasTsx) { framework = 'React'; devCmd = 'npm start'; buildCmd = 'npm run build' }
    }

    if (!framework) return null

    if (!projectRoot) {
      // Derive root from config file or first .tsx
      const configFile = files.find((f) => /\.(config|vite|next)\.(ts|js|mjs)$/i.test(f.path))
      if (configFile) projectRoot = configFile.path.split('/').slice(0, -1).join('/')
      else {
        const firstTsx = files.find((f) => /\.(tsx|jsx)$/i.test(f.path))
        if (firstTsx) {
          const parts = firstTsx.path.split('/')
          projectRoot = parts.length > 2 ? parts.slice(0, -2).join('/') : parts[0] || ''
        }
      }
    }

    const fileCount = files.length
    const fileTypes = [...new Set(files.map((f) => f.path.split('.').pop()?.toLowerCase() || ''))].filter(Boolean)

    return { framework, devCmd, buildCmd, projectRoot, fileCount, fileTypes }
  }, [currentFiles])

  // ── Phase 6: Build image asset map from completed save_image commands ──
  const imageAssetMap = useMemo<Map<string, string>>(() => {
    const map = new Map<string, string>()
    const imgCmds = commands.filter(
      (c) => c.type === 'save_image' && (c.status === 'completed' || c.status === 'approved'),
    )
    for (const cmd of imgCmds) {
      try {
        const p = safeJsonParse(cmd.payload) as Record<string, unknown>
        const path = (p.path as string) || ''
        const url = (p.url as string) || ''
        if (path && url) map.set(path, url)
      } catch { /* ignore */ }
    }
    return map
  }, [commands])

  // ── In-browser transpilation: try to render framework projects live ──
  const frameworkPreviewResult = useMemo<FrameworkPreviewResult | null>(() => {
    if (currentFiles.size === 0) return null
    try {
      return buildFrameworkPreview(currentFiles, imageAssetMap.size > 0 ? imageAssetMap : undefined)
    } catch (e) {
      console.warn('[FrameworkPreview] Build failed:', e)
      return null
    }
  }, [currentFiles, imageAssetMap])

  // ── Console capture state (Phase 2) ──
  const [consoleEntries, setConsoleEntries] = useState<Array<{ level: 'log' | 'info' | 'warn' | 'error'; message: string; ts: number }>>([])
  // Bubble up runtime errors to parent for LLM context injection
  useEffect(() => {
    if (onRuntimeErrors) {
      const errors = consoleEntries.filter(e => e.level === 'error').map(e => e.message)
      onRuntimeErrors(errors)
    }
  }, [consoleEntries, onRuntimeErrors])
  // ── Route state (Phase 3) ──
  const [currentRoute, setCurrentRoute] = useState('/')
  const previewIframeRef = useRef<HTMLIFrameElement>(null)

  // ── HMR state (Phase 4) ──
  const fwPrevFilesRef = useRef<Map<string, string> | null>(null)
  const [fwIframeKey, setFwIframeKey] = useState(0)
  const lastHmrKindRef = useRef<'none' | 'css' | 'js' | 'structural'>('none')

  // Listen for postMessage from iframe (console capture + route changes)
  useEffect(() => {
    function handleMessage(ev: MessageEvent) {
      if (!ev.data || typeof ev.data.type !== 'string') return
      if (ev.data.type === '__oc_console') {
        setConsoleEntries(prev => {
          const next = [...prev, { level: ev.data.level, message: ev.data.message, ts: ev.data.ts }]
          return next.length > 200 ? next.slice(-200) : next
        })
      } else if (ev.data.type === '__oc_route') {
        setCurrentRoute(ev.data.path || '/')
      }
    }
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [])

  // ── Phase 4: Hot Reload — classify change and send postMessage or rebuild ──
  useEffect(() => {
    if (!frameworkPreviewResult) {
      fwPrevFilesRef.current = null
      lastHmrKindRef.current = 'none'
      return
    }

    const prev = fwPrevFilesRef.current
    // Build current file map for diff
    const curr = new Map<string, string>()
    for (const [path, file] of currentFiles) {
      curr.set(path, typeof file === 'string' ? file : file.content)
    }
    fwPrevFilesRef.current = curr

    // First load — no previous state, do full build (fwIframeKey already 0)
    if (!prev) {
      lastHmrKindRef.current = 'structural'
      setConsoleEntries([])
      setCurrentRoute('/')
      return
    }

    const changeType = classifyFileChanges(prev, curr)
    lastHmrKindRef.current = changeType

    if (changeType === 'none') return

    // Clear console errors on ANY file change — stale errors from previous
    // iterations are confusing (shows red errors even after code is fixed)
    setConsoleEntries([])

    if (changeType === 'css') {
      // CSS hot swap — send CSS to iframe, no rebuild
      if (previewIframeRef.current?.contentWindow) {
        previewIframeRef.current.contentWindow.postMessage({
          type: '__oc_hot_update',
          kind: 'css',
          css: frameworkPreviewResult.hmr.css
        }, '*')
      }
      return
    }

    if (changeType === 'js') {
      // JS hot update — send code to iframe for Babel transform + re-render
      if (previewIframeRef.current?.contentWindow) {
        previewIframeRef.current.contentWindow.postMessage({
          type: '__oc_hot_update',
          kind: 'js',
          code: frameworkPreviewResult.hmr.code,
          globals: frameworkPreviewResult.hmr.globals,
          rootComponent: frameworkPreviewResult.hmr.rootComponent
        }, '*')
      }
      return
    }

    // Structural change — full rebuild
    setFwIframeKey(k => k + 1)
    setConsoleEntries([])
    setCurrentRoute('/')
  }, [frameworkPreviewResult, currentFiles])

  // Navigate iframe to a route
  const navigatePreview = useCallback((path: string) => {
    if (previewIframeRef.current?.contentWindow) {
      previewIframeRef.current.contentWindow.postMessage({ type: '__oc_navigate', path }, '*')
    }
  }, [])

  // If we have a transpiled preview, render it in an iframe
  if (frameworkPreviewResult) {
    const errorCount = consoleEntries.filter(e => e.level === 'error').length
    return (
      <PreviewShell title={t('ce.project_preview')}>
        <div className="flex flex-col w-full" style={{ minHeight: '500px', height: '70vh' }}>
          {/* Mini URL bar (Phase 3) — only shown when router detected */}
          {frameworkPreviewResult.hasRouter && (
            <MiniUrlBar
              currentRoute={currentRoute}
              onNavigate={navigatePreview}
              framework={frameworkInfo?.framework || frameworkPreviewResult.framework}
            />
          )}
          {/* Preview iframe area */}
          <div className="relative flex-1 min-h-0">
            {/* Framework badge overlay — only when no URL bar */}
            {!frameworkPreviewResult.hasRouter && (
              <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-600/90 text-white text-[10px] font-medium backdrop-blur-sm shadow-sm">
                <span>⚡</span> {
                  frameworkPreviewResult.framework === 'vue' ? 'Vue 3' :
                  frameworkPreviewResult.framework === 'svelte' ? 'Svelte' :
                  frameworkPreviewResult.framework === 'vanilla' ? 'Vanilla JS' :
                  (frameworkInfo?.framework || 'React')
                } — Live Preview
              </div>
            )}
            {/* Error count badge */}
            {errorCount > 0 && (
              <div className="absolute top-2 right-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-600/90 text-white text-[9px] font-semibold backdrop-blur-sm shadow-sm animate-pulse">
                <AlertTriangle className="w-2.5 h-2.5" />
                {errorCount}
              </div>
            )}
            <iframe
              ref={previewIframeRef}
              key={fwIframeKey}
              srcDoc={frameworkPreviewResult.html}
              className="w-full h-full border-0 bg-[#0a0a0f]"
              sandbox="allow-scripts allow-same-origin allow-modals"
              title="Framework Preview"
            />
          </div>
          {/* Console panel */}
          <ConsolePanel
            entries={consoleEntries}
            onClear={() => setConsoleEntries([])}
          />
        </div>
      </PreviewShell>
    )
  }

  // Fallback: smart card with terminal instructions
  if (frameworkInfo) {
    return (
      <PreviewShell title={t('ce.project_preview')}>
        <div className="flex flex-col items-center text-center p-6">
          {/* Framework badge */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center mb-4 shadow-lg">
            <span className="text-2xl">⚡</span>
          </div>
          <div className="text-base font-semibold text-zinc-900 mb-1">
            {t('ce.framework_detected')}
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-700 text-xs font-medium mb-3">
            {frameworkInfo.framework}
          </div>
          <p className="text-xs text-zinc-500 leading-relaxed max-w-[280px] mb-4">
            {t('ce.framework_needs_build')}
          </p>

          {/* Stats */}
          <div className="flex items-center gap-4 mb-4 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <FileText className="w-3 h-3" />
              {frameworkInfo.fileCount} {t('ce.framework_files')}
            </span>
            <span className="flex items-center gap-1">
              <FolderOpen className="w-3 h-3" />
              {frameworkInfo.fileTypes.slice(0, 5).join(', ')}
            </span>
          </div>

          {/* Terminal-style instructions */}
          <div className="w-full rounded-xl bg-zinc-900 border border-zinc-700 overflow-hidden text-left mb-4">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-zinc-700 bg-zinc-800/50">
              <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-[10px] text-zinc-500 ml-1">Terminal</span>
            </div>
            <div className="px-3 py-2.5 space-y-1.5 font-mono text-[11px]">
              {frameworkInfo.projectRoot && (
                <div><span className="text-emerald-400">$</span> <span className="text-zinc-300">cd {frameworkInfo.projectRoot}</span></div>
              )}
              <div><span className="text-emerald-400">$</span> <span className="text-zinc-300">npm install</span></div>
              <div><span className="text-emerald-400">$</span> <span className="text-amber-300">{frameworkInfo.devCmd}</span></div>
            </div>
          </div>

          {/* CTA button */}
          {frameworkInfo.projectRoot && (
            <button
              onClick={() => {
                fetch('/api/arms/claude-code/open', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ sessionId: commands[0]?.sessionId || '', path: frameworkInfo.projectRoot }),
                }).catch(() => {})
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 transition-colors shadow-sm"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {t('ce.framework_open_project')}
            </button>
          )}
        </div>
      </PreviewShell>
    )
  }

  if (!displayHtml) {
    return (
      <PreviewShell title={t('ce.project_preview')}>
        <div className="flex flex-col items-center text-center py-12">
          <Eye className="w-7 h-7 text-zinc-300 mb-2" />
          <div className="text-sm text-zinc-500">{t('ce.project_no_html')}</div>
        </div>
      </PreviewShell>
    )
  }

  if (fullscreen) {
    return (
      <div className="relative w-full h-full">
        <div className="absolute top-2 right-3 z-10">{syncIndicator}</div>
        <iframe
          ref={iframeRef}
          key={`fs-${iframeKey}`}
          sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"
          srcDoc={displayHtml}
          className="w-full h-full border-0"
          title="project-preview-fullscreen"
        />
      </div>
    )
  }

  return (
    <PreviewShell title={t('ce.project_preview')}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-zinc-500 flex items-center gap-2">
          {t('ce.project_combined')}
          {isCached && !liveHtml && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{t('ce.cached')}</span>
          )}
          {syncIndicator}
        </div>
        <button
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-zinc-500 hover:text-zinc-900 underline-offset-2 hover:underline"
        >
          {showRaw ? t('ce.view_render') : t('ce.view_code')}
        </button>
      </div>
      {showRaw ? (
        <pre className="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all text-zinc-700 font-mono max-h-[60vh]">
          {displayHtml}
        </pre>
      ) : (
        <iframe
          ref={iframeRef}
          key={iframeKey}
          sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"
          srcDoc={displayHtml}
          className="w-full rounded-lg border border-zinc-200 bg-white" style={{ height: "calc(100% - 2rem)", minHeight: "500px" }}
          title="project-preview"
        />
      )}
    </PreviewShell>
  )
}

// ----------------------------------------------------------------------------
// Smart preview — renders artifact based on type
// ----------------------------------------------------------------------------
function PreviewPanel({ command, commands, projectMode, refreshKey, t, onRuntimeErrors }: { command: BridgeCommand | null; commands?: BridgeCommand[]; projectMode?: boolean; refreshKey?: number; t: (key: string) => string; onRuntimeErrors?: (errors: string[]) => void }) {
  // Project preview mode: combine all files
  if (projectMode && commands && commands.length > 0) {
    return <ProjectPreview commands={commands} refreshKey={refreshKey} t={t} onRuntimeErrors={onRuntimeErrors} />
  }

  if (!command) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-6 select-none">
        <div className="w-12 h-12 rounded-xl bg-zinc-100 flex items-center justify-center mb-3">
          <Sparkles className="w-5 h-5 text-zinc-400" />
        </div>
        <div className="text-[13px] text-zinc-400 max-w-[220px]">
          {t('ce.preview_empty')}
        </div>
      </div>
    )
  }

  let payload: { path?: string; command?: string; content?: string } = {}
  let result: { content?: string; entries?: { name: string; isDir: boolean }[]; stdout?: string; stderr?: string; written?: string; created?: string; deleted?: string; bytes?: number; path?: string } = {}
  try {
    // payload may be a string (from DB) or already an object (from SSE)
    payload = safeJsonParse(command.payload)
  } catch {}
  if (command.result) result = safeJsonParse(command.result)

  const isExecuting = command.status === 'executing' || command.status === 'approved'
  const isFailed = command.status === 'failed'
  const isPending = command.status === 'pending'
  const isRejected = command.status === 'rejected'

  // Loading / waiting states
  if (isPending) {
    return (
      <PreviewShell title={getActionMeta(command.type, t).label}>
        <div className="flex flex-col items-center text-center py-12">
          <Shield className="w-8 h-8 text-amber-500 mb-2" />
          <div className="text-sm text-zinc-700">{t('ce.pending_approval')}</div>
        </div>
      </PreviewShell>
    )
  }
  if (isExecuting) {
    return (
      <PreviewShell title={getActionMeta(command.type, t).label}>
        <div className="flex flex-col items-center text-center py-12">
          <Loader2 className="w-7 h-7 text-zinc-500 animate-spin mb-2" />
          <div className="text-sm text-zinc-500">{t('ce.executing')}</div>
        </div>
      </PreviewShell>
    )
  }
  if (isRejected) {
    return (
      <PreviewShell title={t('ce.preview_cancelled')}>
        <div className="text-sm text-zinc-500 py-8 text-center">
          {t('ce.preview_cancelled')}
        </div>
      </PreviewShell>
    )
  }
  if (isFailed) {
    return (
      <PreviewShell title={t('ce.preview_failed')}>
        <div className="flex flex-col items-center text-center py-8">
          <AlertTriangle className="w-8 h-8 text-rose-500 mb-2" />
          <div className="text-sm text-zinc-700 max-w-[280px]">
            {sanitizeError(command.error || '')}
          </div>
        </div>
      </PreviewShell>
    )
  }

  // Completed — dispatch by type / extension
  const path = (payload.path || result.path || result.written || result.created || '').toLowerCase()
  const ext = path.split('.').pop() || ''

  // write_file: render content based on extension
  if (command.type === 'write_file') {
    const content = payload.content ?? ''
    console.log('[Preview] write_file preview:', { path: payload.path, ext, contentLength: content.length, hasContent: !!content, contentPreview: content.substring(0, 100) })
    return <WrittenPreview path={payload.path || ''} ext={ext} content={content} refreshKey={refreshKey} t={t} />
  }

  if (command.type === 'read_file' && result.content) {
    return <WrittenPreview path={payload.path || ''} ext={ext} content={result.content} refreshKey={refreshKey} t={t} />
  }

  if (command.type === 'create_dir') {
    return (
      <PreviewShell title={t('ce.preview_folder_created')}>
        <div className="flex flex-col items-center text-center py-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mb-3">
            <Folder className="w-7 h-7 text-amber-600" />
          </div>
          <div className="text-sm font-medium text-zinc-900">{payload.path}</div>
        </div>
      </PreviewShell>
    )
  }

  if (command.type === 'read_dir' && result.entries) {
    return (
      <PreviewShell title={payload.path || ''}>
        <div className="divide-y divide-zinc-100">
          {result.entries.length === 0 ? (
            <div className="text-sm text-zinc-400 py-6 text-center">—</div>
          ) : (
            result.entries.map((e) => (
              <div key={e.name} className="flex items-center gap-2 py-2 text-sm">
                <span>{e.isDir ? '📁' : '📄'}</span>
                <span className="text-zinc-700">{e.name}</span>
              </div>
            ))
          )}
        </div>
      </PreviewShell>
    )
  }

  if (command.type === 'delete_file') {
    return (
      <PreviewShell title={t('ce.preview_deleted')}>
        <div className="flex flex-col items-center text-center py-10">
          <Trash2 className="w-7 h-7 text-zinc-400 mb-2" />
          <div className="text-sm text-zinc-700">{payload.path}</div>
        </div>
      </PreviewShell>
    )
  }

  if (command.type === 'execute_cmd') {
    // Parse TSC/test output for enhanced display
    const rawCmd = ((payload as Record<string, unknown>).command as string) || ''
    const isTscOrTest = /tsc|typecheck|eslint|jest|vitest|yarn test|npm test/i.test(rawCmd)
    const stdout = result.stdout || ''
    const stderr = result.stderr || ''
    const combined = stdout + '\n' + stderr

    // Count errors/warnings from tsc-style output
    const errorLines = combined.split('\n').filter(l => /error\s+TS|ERROR|\berror\b.*:/i.test(l) && !/0 error/i.test(l))
    const warnLines = combined.split('\n').filter(l => /warning\s+TS|WARN|\bwarning\b.*:/i.test(l) && !/0 warn/i.test(l))
    const isClean = isTscOrTest && errorLines.length === 0 && (/Found 0 errors|0 error/i.test(combined) || (!stderr && /success|passed|completed/i.test(stdout)))

    return (
      <PreviewShell title={isTscOrTest ? t('ce.tsc_panel_title') : t('ce.preview_cmd_result')}>
        {/* TSC/Test summary bar */}
        {isTscOrTest && (
          <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-2 text-[11px] font-semibold ${
            isClean ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
            : errorLines.length > 0 ? 'bg-red-50 border border-red-200 text-red-700'
            : 'bg-amber-50 border border-amber-200 text-amber-700'
          }`}>
            {isClean ? (
              <><CheckCircle2 className="w-3.5 h-3.5" /> {t('ce.tsc_clean')}</>
            ) : (
              <>
                {errorLines.length > 0 && <span className="flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {errorLines.length} {t('ce.tsc_errors')}</span>}
                {warnLines.length > 0 && <span className="flex items-center gap-1 text-amber-600"><AlertTriangle className="w-3 h-3" /> {warnLines.length} {t('ce.tsc_warnings')}</span>}
              </>
            )}
          </div>
        )}

        {/* Error lines highlighted */}
        {isTscOrTest && errorLines.length > 0 && (
          <div className="space-y-1 mb-2">
            {errorLines.slice(0, 12).map((line, i) => {
              const match = line.match(/(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/)
              if (match) {
                return (
                  <div key={i} className="px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-100 text-[10px] font-mono">
                    <span className="text-red-500 font-semibold">{match[4]}</span>
                    <span className="text-zinc-400 ml-1">{match[1]}:{match[2]}</span>
                    <p className="text-red-700 mt-0.5">{match[5]}</p>
                  </div>
                )
              }
              return <p key={i} className="text-[10px] text-red-600 font-mono truncate px-1">{line}</p>
            })}
            {errorLines.length > 12 && <p className="text-[10px] text-zinc-400 px-1">+{errorLines.length - 12} more...</p>}
          </div>
        )}

        {/* Raw output (collapsible for tsc) */}
        {stdout && (
          <details open={!isTscOrTest || (!isClean && errorLines.length === 0)}>
            <summary className="text-[10px] text-zinc-400 cursor-pointer mb-1 select-none">
              {isTscOrTest ? (t('nav.dashboard') === 'Panel' ? 'Ver salida completa' : 'View full output') : 'stdout'}
            </summary>
            <pre className="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all text-zinc-700 font-mono max-h-[300px]">
              {stdout}
            </pre>
          </details>
        )}
        {stderr && (
          <details open={!isTscOrTest}>
            <summary className="text-[10px] text-red-400 cursor-pointer mb-1 mt-2 select-none">stderr</summary>
            <pre className="text-xs bg-rose-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all text-rose-700 font-mono max-h-[200px]">
              {stderr}
            </pre>
          </details>
        )}
        {!stdout && !stderr && (
          <div className="text-sm text-zinc-400 text-center py-6">—</div>
        )}
      </PreviewShell>
    )
  }

  // Sprint 12: save_image preview — show the generated image
  if (command.type === 'save_image' || (command.type === 'write_file' && (payload as Record<string, unknown>).url)) {
    const imgUrl = (payload as Record<string, unknown>).url as string || ''
    const imgPrompt = (payload as Record<string, unknown>).prompt as string || ''
    return (
      <PreviewShell title={`🎨 ${payload.path || 'Generated Image'}`}>
        <div className="flex flex-col items-center gap-3 py-4">
          {imgUrl && (
            <a href={imgUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-md transition-shadow max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imgUrl} alt={imgPrompt || payload.path || 'Generated image'} className="max-w-full max-h-[400px] object-contain" />
            </a>
          )}
          {imgPrompt && (
            <div className="text-[11px] text-zinc-500 px-4 text-center italic max-w-[300px]">{imgPrompt}</div>
          )}
          <div className="text-[10px] text-zinc-400 font-mono">{payload.path}</div>
        </div>
      </PreviewShell>
    )
  }

  return (
    <PreviewShell title={t('ce.preview_ready')}>
      <div className="text-sm text-zinc-500 py-6 text-center">✓</div>
    </PreviewShell>
  )
}

function PreviewShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-1 pb-2 text-[11px] uppercase tracking-[0.18em] text-zinc-400">{title}</div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  )
}

// ── Console Panel (Phase 2) ──────────────────────────────────────────────
interface ConsoleEntry {
  level: 'log' | 'info' | 'warn' | 'error'
  message: string
  ts: number
}

function ConsolePanel({ entries, onClear }: { entries: ConsoleEntry[]; onClear: () => void }) {
  const [open, setOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const errorCount = entries.filter(e => e.level === 'error').length
  const warnCount = entries.filter(e => e.level === 'warn').length

  // Auto-open on first error
  useEffect(() => {
    if (errorCount > 0 && !open) setOpen(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorCount])

  // Auto-scroll to bottom
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries.length, open])

  const levelConfig: Record<string, { color: string; bg: string; icon: string }> = {
    log:   { color: 'text-zinc-300',  bg: 'border-transparent',        icon: '›' },
    info:  { color: 'text-blue-300',  bg: 'border-blue-500/20',        icon: 'ℹ' },
    warn:  { color: 'text-amber-300', bg: 'border-amber-500/20',       icon: '⚠' },
    error: { color: 'text-red-400',   bg: 'border-red-500/30',         icon: '✕' },
  }

  return (
    <div className="border-t border-zinc-800 bg-[#0c0c12] flex flex-col" style={{ minHeight: open ? '160px' : undefined }}>
      {/* Header bar — always visible */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 text-[10px] font-medium tracking-wide text-zinc-400 hover:text-zinc-200 transition-colors select-none w-full"
      >
        <Terminal className="w-3 h-3" />
        <span>Console</span>
        {entries.length > 0 && (
          <span className="text-zinc-500 font-mono">{entries.length}</span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[9px] font-semibold tabular-nums">
            {errorCount} {errorCount === 1 ? 'error' : 'errors'}
          </span>
        )}
        {warnCount > 0 && (
          <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[9px] font-semibold tabular-nums">
            {warnCount} {warnCount === 1 ? 'warn' : 'warns'}
          </span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {open && entries.length > 0 && (
            <span
              onClick={(e) => { e.stopPropagation(); onClear() }}
              className="px-1.5 py-0.5 rounded text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Clear
            </span>
          )}
          <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
        </span>
      </button>

      {/* Console entries */}
      {open && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto max-h-[280px] font-mono text-[11px] leading-[1.7]">
          {entries.length === 0 ? (
            <div className="px-3 py-4 text-center text-zinc-600 text-[10px] italic">No console output yet</div>
          ) : (
            entries.map((entry, i) => {
              const cfg = levelConfig[entry.level] || levelConfig.log
              return (
                <div
                  key={`${entry.ts}-${i}`}
                  className={`flex items-start gap-2 px-3 py-[3px] border-l-2 ${cfg.bg} hover:bg-white/[0.02] transition-colors`}
                >
                  <span className={`shrink-0 w-3 text-center ${cfg.color} opacity-60`}>{cfg.icon}</span>
                  <span className={`${cfg.color} whitespace-pre-wrap break-all flex-1`}>{entry.message}</span>
                  {entry.level === 'error' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        window.dispatchEvent(new CustomEvent('__oc_fix_error', { detail: entry.message }))
                      }}
                      className="shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 hover:text-blue-300 transition-colors"
                      title="Ask Octopus to fix this error"
                    >
                      🐙 Fix
                    </button>
                  )}
                  <span className="text-zinc-600 text-[9px] shrink-0 tabular-nums pt-[1px]">
                    {new Date(entry.ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}



// ── Mini URL Bar (Phase 3) ──────────────────────────────────────────────
function MiniUrlBar({
  currentRoute,
  onNavigate,
  framework,
}: {
  currentRoute: string
  onNavigate: (path: string) => void
  framework: string
}) {
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState(currentRoute)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input when route changes externally (click inside iframe)
  useEffect(() => {
    if (!editing) setInputValue(currentRoute)
  }, [currentRoute, editing])

  // Focus input on edit start
  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus()
  }, [editing])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const path = inputValue.startsWith('/') ? inputValue : '/' + inputValue
    onNavigate(path)
    setEditing(false)
  }

  function handleBack() {
    // Simple back: go to parent route
    const parts = currentRoute.split('/').filter(Boolean)
    if (parts.length > 1) {
      parts.pop()
      onNavigate('/' + parts.join('/'))
    } else {
      onNavigate('/')
    }
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 bg-[#111118] border-b border-zinc-800/60 shrink-0">
      {/* Framework badge */}
      <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-violet-600/80 text-white text-[9px] font-medium shrink-0">
        <span>⚡</span> {framework}
      </div>

      {/* Back button */}
      <button
        onClick={handleBack}
        className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        title="Back"
      >
        <ChevronDown className="w-3 h-3 rotate-90" />
      </button>

      {/* Home button */}
      <button
        onClick={() => onNavigate('/')}
        className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        title="Home"
      >
        <FolderOpen className="w-3 h-3" />
      </button>

      {/* URL display / input */}
      {editing ? (
        <form onSubmit={handleSubmit} className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={() => { setEditing(false); setInputValue(currentRoute) }}
            onKeyDown={(e) => { if (e.key === 'Escape') { setEditing(false); setInputValue(currentRoute) } }}
            className="w-full px-2 py-0.5 bg-zinc-900 border border-violet-500/50 rounded text-[11px] font-mono text-zinc-200 outline-none focus:border-violet-400 placeholder-zinc-600"
            placeholder="/"
            spellCheck={false}
          />
        </form>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-0.5 bg-zinc-900/60 rounded text-[11px] font-mono text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors truncate text-left"
          title="Click to edit route"
        >
          <span className="text-zinc-600 shrink-0">localhost</span>
          <span className="text-zinc-300 truncate">{currentRoute}</span>
        </button>
      )}

      {/* Refresh */}
      <button
        onClick={() => onNavigate(currentRoute)}
        className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
        title="Reload route"
      >
        <RotateCw className="w-3 h-3" />
      </button>
    </div>
  )
}

// Render the contents of a written/read file based on extension
function WrittenPreview({ path: filePath, ext, content, refreshKey, t }: { path: string; ext: string; content: string; refreshKey?: number; t: (key: string) => string }) {
  const [showRaw, setShowRaw] = useState(false)

  // Cache HTML previews for offline access
  useEffect(() => {
    if ((ext === 'html' || ext === 'htm') && content) {
      cachePreview(content)
    }
  }, [ext, content])

  if (ext === 'html' || ext === 'htm') {
    console.log('[WrittenPreview] Rendering HTML iframe, content length:', content.length, 'showRaw:', showRaw)
    return (
      <PreviewShell title={t('ce.preview_title')}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs text-zinc-500 truncate">{filePath}</div>
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline-offset-2 hover:underline"
          >
            {showRaw ? t('ce.view_render') : t('ce.view_code')}
          </button>
        </div>
        {showRaw ? (
          <pre className="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all text-zinc-700 font-mono max-h-[60vh]">
            {content}
          </pre>
        ) : (
          <iframe
            key={`preview-${refreshKey || 0}`}
            sandbox="allow-scripts allow-same-origin allow-modals allow-forms allow-popups"
            srcDoc={content}
            className="w-full rounded-lg border border-zinc-200 bg-white" style={{ height: "calc(100% - 2rem)", minHeight: "500px" }}
            title="preview"
            onLoad={() => console.log('[WrittenPreview] iframe loaded!')}
          />
        )}
      </PreviewShell>
    )
  }

  if (ext === 'md' || ext === 'markdown') {
    return (
      <PreviewShell title={t('ce.preview_title')}>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-xs text-zinc-500 truncate">{filePath}</div>
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-900 underline-offset-2 hover:underline"
          >
            {showRaw ? t('ce.view_render') : t('ce.view_code')}
          </button>
        </div>
        {showRaw ? (
          <pre className="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all text-zinc-700 font-mono max-h-[60vh]">
            {content}
          </pre>
        ) : (
          <div
            className="prose-sm max-w-none text-zinc-800"
            dangerouslySetInnerHTML={{ __html: tinyMarkdown(content) }}
          />
        )}
      </PreviewShell>
    )
  }

  if (ext === 'json') {
    let pretty = content
    try { pretty = JSON.stringify(JSON.parse(content), null, 2) } catch {}
    return (
      <PreviewShell title={t('ce.preview_title')}>
        <div className="mb-2 text-xs text-zinc-500 truncate">{filePath}</div>
        <pre className="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto whitespace-pre break-all text-zinc-700 font-mono max-h-[60vh]">
          {pretty}
        </pre>
      </PreviewShell>
    )
  }

  // Generic text preview
  return (
    <PreviewShell title={t('ce.preview_title')}>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-xs text-zinc-500 truncate">{filePath}</div>
      </div>
      {content.length === 0 ? (
        <div className="text-sm text-zinc-400 text-center py-8">—</div>
      ) : (
        <pre className="text-xs bg-zinc-50 rounded-lg p-3 overflow-auto whitespace-pre-wrap break-all text-zinc-700 font-mono max-h-[60vh]">
          {content.length > 5000 ? content.slice(0, 5000) + '\n…' : content}
        </pre>
      )}
    </PreviewShell>
  )
}

// ============================================================================
// EXECUTION BANNER — phase indicator + progress bar + current step
// ============================================================================
function ExecutionBanner({
  commands,
  isThinking,
  streamingText,
  t,
}: {
  commands: BridgeCommand[]
  isThinking: boolean
  streamingText: string
  t: (key: string) => string
}) {
  // Exclude save_image commands — they're handled by the image-gen pipeline banner,
  // not the execution banner. Counting them here causes false "failed" phases.
  const nonImageCommands = commands.filter((c) => c.type !== 'save_image')
  const totalCommands = nonImageCommands.length
  const completedCount = nonImageCommands.filter((c) =>
    ['completed', 'failed', 'rejected'].includes(c.status),
  ).length
  const executingCmd = nonImageCommands.find((c) => c.status === 'executing')
  const pendingCmds = nonImageCommands.filter((c) => c.status === 'approved' || c.status === 'pending')
  const hasFailure = nonImageCommands.some((c) => c.status === 'failed')
  const allDone = totalCommands > 0 && completedCount === totalCommands

  // Derive phase — ALWAYS show when commands exist or thinking
  type Phase = 'idle' | 'thinking' | 'executing' | 'completed' | 'failed'
  let phase: Phase = 'idle'
  if (isThinking && totalCommands === 0) phase = 'thinking'
  else if (executingCmd || pendingCmds.length > 0) phase = 'executing'
  else if (isThinking && totalCommands > 0) phase = 'executing'
  else if (hasFailure && allDone) phase = 'failed'
  else if (allDone && totalCommands > 0) phase = 'completed'
  else if (totalCommands > 0) phase = 'completed'

  // Debug logging — helps trace banner visibility issues
  useEffect(() => {
    console.log('[ExecBanner]', { phase, isThinking, totalCommands, completedCount, pendingCount: pendingCmds.length, hasExecuting: !!executingCmd })
  }, [phase, isThinking, totalCommands, completedCount, pendingCmds.length, executingCmd])

  // Auto-dismiss completed/failed banner after 15 seconds
  const [dismissed, setDismissed] = useState(false)
  const [stuckWarning, setStuckWarning] = useState(false)
  const prevPhaseRef = useRef(phase)
  useEffect(() => {
    if (phase !== prevPhaseRef.current) {
      setDismissed(false)
      setStuckWarning(false)
      prevPhaseRef.current = phase
    }
    if (phase === 'completed' || phase === 'failed') {
      const timer = setTimeout(() => setDismissed(true), 15000)
      return () => clearTimeout(timer)
    }
    // Stuck detection: if executing for >45s, show warning
    if (phase === 'executing') {
      const stuckTimer = setTimeout(() => setStuckWarning(true), 45000)
      return () => clearTimeout(stuckTimer)
    }
  }, [phase])

  if (phase === 'idle' || dismissed) return null

  const progress = totalCommands > 0 ? Math.round((completedCount / totalCommands) * 100) : 0

  // Current step description
  let currentStep = ''
  if (executingCmd) {
    const meta = getActionMeta(executingCmd.type, t)
    let payload: { path?: string; command?: string } = {}
    payload = safeJsonParse(executingCmd.payload)
    const target = payload.path || (payload.command ? payload.command.slice(0, 40) : '')
    currentStep = target ? `${meta.label} · ${target}` : meta.label
  }

  const isDark = phase === 'thinking' || phase === 'executing'

  return (
    <div
      className="rounded-2xl border overflow-hidden mb-3 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300"
      style={{
        background: isDark ? '#18181b' : phase === 'completed' ? '#f0fdf4' : '#fef2f2',
        borderColor: isDark ? '#27272a' : phase === 'completed' ? '#bbf7d0' : '#fecaca',
      }}
    >
      {/* Top bar: Progress X/Y ████████ XX% */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-3">
          <span className={`text-xs font-semibold uppercase tracking-wider ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
            {t('ce.phase_progress')}
          </span>
          <span className={`text-xs font-bold tabular-nums ${isDark ? 'text-white' : 'text-zinc-900'}`}>
            {completedCount}/{totalCommands}
          </span>
          {/* Progress bar */}
          <div className={`flex-1 h-2.5 rounded-full overflow-hidden ${isDark ? 'bg-zinc-700' : phase === 'completed' ? 'bg-emerald-200' : 'bg-rose-200'}`}>
            {phase === 'thinking' && totalCommands === 0 ? (
              <div className="h-full w-full relative">
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-400/60 to-transparent animate-[shimmer_1.5s_infinite]" />
              </div>
            ) : (
              <div
                className={`h-full rounded-full transition-all duration-500 ease-out ${
                  phase === 'completed' ? 'bg-emerald-500' : phase === 'failed' ? 'bg-rose-500' : 'bg-amber-400'
                }`}
                style={{ width: `${Math.max(progress, totalCommands > 0 ? 5 : 0)}%` }}
              />
            )}
          </div>
          <span className={`text-xs font-bold tabular-nums min-w-[36px] text-right ${isDark ? 'text-zinc-300' : 'text-zinc-700'}`}>
            {progress}%
          </span>
        </div>
      </div>

      {/* Phase status label */}
      <div className="px-4 pb-2 flex items-center gap-2">
        {phase === 'thinking' && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-medium text-amber-400">{t('ce.phase_analyzing')}</span>
            {/* Smart sub-phase detection from streaming content */}
            {streamingText && (() => {
              const lower = streamingText.toLowerCase()
              const lastChunk = lower.slice(-500)
              let subPhase = ''
              if (lastChunk.includes('<html') || lastChunk.includes('<!doctype')) subPhase = t('ce.subphase_html')
              else if (lastChunk.includes('<style') || lastChunk.includes('css')) subPhase = t('ce.subphase_css')
              else if (lastChunk.includes('<script') || lastChunk.includes('function')) subPhase = t('ce.subphase_js')
              else if (lastChunk.includes('generate_image') || lastChunk.includes('save_image')) subPhase = t('ce.subphase_images')
              else if (lastChunk.includes('write_file')) subPhase = t('ce.subphase_files')
              if (subPhase) return <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{subPhase}</span>
              return null
            })()}
            <span className="inline-flex gap-[3px]">
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </span>
          </div>
        )}
        {phase === 'executing' && (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-medium text-amber-400">⚡ {t('ce.phase_executing')}</span>
            {currentStep && <span className="text-[11px] text-zinc-500 truncate">— {currentStep}</span>}
          </div>
        )}
        {phase === 'completed' && (
          <span className="text-xs font-medium text-emerald-600">✅ {t('ce.phase_completed')}</span>
        )}
        {phase === 'failed' && (
          <span className="text-xs font-medium text-rose-600">❌ {t('ce.phase_failed')}</span>
        )}
      </div>

      {/* Live streaming code preview — shows what the LLM is writing in real time */}
      {phase === 'thinking' && streamingText && (
        <div className="px-4 pb-2">
          <details open className="group/code">
            <summary className="flex items-center gap-2 cursor-pointer list-none text-[11px] text-zinc-500 mb-1.5 select-none">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-medium text-zinc-400">{t('ce.live_code')}</span>
              </span>
              <span className="text-zinc-600 font-mono">{streamingText.length.toLocaleString()} chars</span>
              <span className="ml-auto text-[10px] text-zinc-600 group-open/code:hidden">▶ {t('ce.show')}</span>
              <span className="ml-auto text-[10px] text-zinc-600 hidden group-open/code:inline">▼ {t('ce.hide')}</span>
            </summary>
            <div className="relative rounded-lg overflow-hidden bg-[#0d1117] border border-zinc-800">
              <div className="max-h-[120px] overflow-y-auto p-3 font-mono text-[11px] text-emerald-400/80 leading-relaxed whitespace-pre-wrap break-all scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent" style={{ scrollbarWidth: 'thin' }}>
                {streamingText.slice(-600)}
                <span className="inline-block w-1.5 h-4 bg-emerald-400 animate-pulse ml-0.5 align-text-bottom" />
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-[#0d1117] to-transparent pointer-events-none" />
            </div>
          </details>
        </div>
      )}

      {/* Stuck warning */}
      {stuckWarning && phase === 'executing' && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 text-[11px] bg-amber-900/40 rounded-lg px-3 py-2 border border-amber-700/50">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span className="text-amber-300">Bridge may be taking longer than expected. Check your local Bridge connection.</span>
          </div>
        </div>
      )}

      {/* Numbered steps list */}
      {totalCommands > 0 && (
        <div className="px-4 pb-3 space-y-1">
          {commands.slice(-5).map((cmd) => {
            const meta = getActionMeta(cmd.type, t)
            let p: { path?: string; command?: string } = {}
            p = safeJsonParse(cmd.payload)
            const label = p.path || (p.command ? p.command.slice(0, 40) : meta.label)
            const isDone = cmd.status === 'completed'
            const isFail = cmd.status === 'failed'
            const isExec = cmd.status === 'executing'
            return (
              <div key={cmd.id} className="flex items-center gap-2 text-[11px]">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] font-bold ${
                  isDone ? 'bg-emerald-500/20 text-emerald-400' :
                  isFail ? 'bg-rose-500/20 text-rose-400' :
                  isExec ? 'bg-amber-500/20 text-amber-400' :
                  'bg-zinc-600 text-zinc-400'
                }`}>
                  {isDone ? '✓' : isFail ? '✗' : isExec ? '⚡' : (commands.indexOf(cmd) + 1)}
                </span>
                <span className={`truncate ${isDone ? 'text-zinc-500 line-through' : isFail ? 'text-rose-400' : isExec ? 'text-amber-300' : isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {meta.emoji} {label}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MAIN PAGE
// ============================================================================
function CodeEnginePageInner() {
  const { t, locale } = useI18n()
  const { data: session, status: sessionStatus } = useSession() || {}
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const scrollTriggerRef = useRef(0)
  const [scrollTick, setScrollTick] = useState(0)
  const scrollRafRef = useRef<number | null>(null)

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  // Runtime errors from preview iframe — captured via callback from ProjectPreview
  const runtimeErrorsRef = useRef<string[]>([])
  const handleRuntimeErrors = useCallback((errors: string[]) => {
    runtimeErrorsRef.current = errors
  }, [])

  const [sessions, setSessions] = useState<CodeSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [showRuntimePanel, setShowRuntimePanel] = useState(false)
  const [editorTarget, setEditorTarget] = useState<{ path: string; content: string } | null>(null)
  const [diffNotice, setDiffNotice] = useState<{ skipped: number; written: number } | null>(null)
  const diffNoticeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Fase 4: lentes especializadas activas + uso de tokens del turno actual
  const [activeLenses, setActiveLenses] = useState<Array<{ id: string; name: string; emoji: string }>>([])
  const [tokenUsage, setTokenUsage] = useState<{ totalTokens: number; costUsd: number; model: string; estimated: boolean } | null>(null)
  const [messages, setMessages] = useState<CodeMessage[]>([])
  const [commands, setCommands] = useState<BridgeCommand[]>([])

  const [selectedModel, setSelectedModelRaw] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('octopus_ce_model') || DEFAULT_MODEL
    }
    return DEFAULT_MODEL
  })
  // Wrap setter to persist to localStorage
  const setSelectedModel = useCallback((model: string) => {
    setSelectedModelRaw(model)
    try { localStorage.setItem('octopus_ce_model', model) } catch {}
  }, [])
  const [showModelSelect, setShowModelSelect] = useState(false)
  const [premiumMode, setPremiumModeRaw] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('octopus_ce_premium')
      return stored === null ? true : stored === 'true'
    }
    return true
  })
  const setPremiumMode = useCallback((v: boolean) => {
    setPremiumModeRaw(v)
    try { localStorage.setItem('octopus_ce_premium', String(v)) } catch {}
  }, [])
  const [showSessions, setShowSessions] = useState(false)
  const [previewCmdId, setPreviewCmdId] = useState<string | null>(null)
  const [projectPreview, setProjectPreview] = useState(false)

  const [input, setInput] = useState('')
  const [tplFilter, setTplFilter] = useState<'all' | 'frontend' | 'fullstack'>('all')
  const [sending, setSending] = useState(false)
  const [lastUserMessage, setLastUserMessage] = useState<string>('')
  
  // Showcase replicate flow — auto-fill prompt from query params
  const searchParams = useSearchParams()
  const showcaseHandled = useRef(false)
  useEffect(() => {
    if (showcaseHandled.current) return
    const showcasePrompt = searchParams?.get('prompt')
    if (showcasePrompt) {
      showcaseHandled.current = true
      setInput(decodeURIComponent(showcasePrompt))
    }
  }, [searchParams])

  // Console Fix button listener — receives error from ConsolePanel via custom event
  // Uses a pending fix ref so sendMessage can pick it up after state update
  const pendingFixRef = useRef<string | null>(null)
  useEffect(() => {
    function handleFixError(ev: Event) {
      const msg = (ev as CustomEvent).detail as string
      if (msg) {
        // Keep the fix prompt simple — runtime errors are now auto-injected via [PREVIEW_RUNTIME_ERRORS]
        const shortError = msg.length > 120 ? msg.slice(0, 120) + '…' : msg
        const fixPrompt = `Fix this preview error: ${shortError}`
        pendingFixRef.current = fixPrompt
        setInput(fixPrompt)
      }
    }
    window.addEventListener('__oc_fix_error', handleFixError)
    return () => window.removeEventListener('__oc_fix_error', handleFixError)
  }, [])
  const [showDetails, setShowDetails] = useState(false)
  const [memoryLoaded, setMemoryLoaded] = useState(false)
  const memoryFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [depGraph, setDepGraph] = useState<{ fileCount: number; totalLines: number; missingImports: number; npmPackages: string[] } | null>(null)
  const [codeWarnings, setCodeWarnings] = useState<{ file: string; missingLocal: string[]; missingPkgs: string[]; syntaxErrors: string[] }[]>([])

  // Sprint 8: Transaction status
  const [txStatus, setTxStatus] = useState<null | 'started' | 'validating' | 'repairing' | 'committed' | 'rolled_back'>(null)
  const [txDetails, setTxDetails] = useState<{ txId?: string; actionCount?: number; commandCount?: number; reason?: string; criticalErrors?: string[]; affectedFiles?: string[] } | null>(null)
  const txFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sprint 9: Dependency resolution status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [depStatus, setDepStatus] = useState<null | 'scanning' | 'resolved' | 'ready'>(null)
  const [depDetails, setDepDetails] = useState<{ totalResolved?: number; resolved?: { name: string; version: string; cdn: string; category: string }[]; injectedFiles?: string[]; needsInstall?: string[] } | null>(null)
  const depFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sprint 10: Telemetry pipeline state
  type TelemetryStageUI = { name: string; status: string; durationMs?: number; detail?: string }
  const [telemetryStages, setTelemetryStages] = useState<TelemetryStageUI[]>([])
  const [telemetryTotal, setTelemetryTotal] = useState(0)
  const [showTelemetry, setShowTelemetry] = useState(false)
  const [feedbackInjected, setFeedbackInjected] = useState(false)
  const feedbackFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sprint 11: Phoenix Protocol state
  const [phoenixEvent, setPhoenixEvent] = useState<{ type: string; detail: string } | null>(null)
  const phoenixFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sprint 12: Image Generation Engine state
  const [imageGenStatus, setImageGenStatus] = useState<null | 'generating' | 'ready' | 'failed'>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [imageGenDetails, setImageGenDetails] = useState<{ count?: number; current?: number; total?: number; model?: string; results?: any[]; error?: string } | null>(null)
  const imageGenFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // BUG 3 fix: Safety timeout — unlock input if no events for 90s
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // BUG 1 fix: Track SSE reconnections during image generation
  const sseReconnectCountRef = useRef(0)
  // Sprint 12 Decoupled: Pending image jobs for async processing
  const pendingImageJobsRef = useRef<{
    sessionId: string; messageId: string;
    jobs: Array<{ index: number; prompt: string; model: string; path: string; aspect_ratio: string }>;
  } | null>(null)

  // Web Vision Viewer state
  type VisionData = {
    url: string
    screenshots: { above: string; full: string }
    analysis: {
      aesthetic: string; mood: string; quality: string
      colors: { background: string; foreground: string; primary: string; secondary: string; palette: string[] }
      typography: { headingFont: string; bodyFont: string; headingStyle: string }
      layout: { structure: string; heroStyle: string; sections: string[] }
      components: { effects: string; animations: string }
    }
  }
  const [visionData, setVisionData] = useState<VisionData | null>(null)
  const [visionExpanded, setVisionExpanded] = useState(true)
  const visionFadeRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Self-Review Visual Reflexion Loop state
  type SelfReviewIssue = { severity: 'critical' | 'major' | 'minor' | 'suggestion'; area: string; description: string; fix: string }
  type SelfReviewData = { score: number; passed: boolean; issues: SelfReviewIssue[]; praise: string[]; summary: string }
  const [selfReviewData, setSelfReviewData] = useState<SelfReviewData | null>(null)
  const [selfReviewStatus, setSelfReviewStatus] = useState<'capturing' | 'complete' | null>(null)
  const [selfReviewExpanded, setSelfReviewExpanded] = useState(true)

  // Image attachment state
  type PendingImage = { id: string; base64: string; preview: string; name: string }
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const MAX_IMAGES = 5
  const MAX_IMAGE_SIZE = 4 * 1024 * 1024 // 4MB per image

  const processImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    if (file.size > MAX_IMAGE_SIZE) return
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = reader.result as string
      setPendingImages(prev => {
        if (prev.length >= MAX_IMAGES) return prev
        return [...prev, { id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`, base64, preview: base64, name: file.name }]
      })
    }
    reader.readAsDataURL(file)
  }, [])

  const removeImage = useCallback((id: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== id))
  }, [])

  // Workspace intelligence state
  const [rightTab, setRightTab] = useState<'preview' | 'workspace'>('preview')
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null)
  const [recentChanges, setRecentChanges] = useState<FileChangeItem[]>([])

  // Preview panel state
  const [previewExpanded, setPreviewExpanded] = useState(false)
  const [previewRefreshKey, setPreviewRefreshKey] = useState(0)
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')
  const [previewWidth, setPreviewWidth] = useState(380)
  const isResizingRef = useRef(false)

  // Sprint S2/S3: Unified Publish Panel state
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishBusy, setPublishBusy] = useState<string | null>(null) // 'octopus' | 'production' | 'github' | 'hostinger' | 'zip' | 'vercel' | null
  const [publishProjectType, setPublishProjectType] = useState<'frontend' | 'fullstack' | null>(null)
  const [armStatus, setArmStatus] = useState<Record<string, { connected: boolean; detail?: string }>>({})
  const armStatusFetched = useRef(false)
  const [showGitHub, setShowGitHub] = useState(false)
  const [githubPushBusy, setGithubPushBusy] = useState(false)
  const [githubPushResult, setGithubPushResult] = useState<{ ok: boolean; message: string } | null>(null)
  // GitHub Pull state
  const [githubTab, setGithubTab] = useState<'push' | 'pull' | 'review' | 'branches' | 'commits'>('push')
  const [githubRepos, setGithubRepos] = useState<{ name: string; full_name: string; description: string | null; html_url: string; updated_at: string; language: string | null; default_branch: string }[]>([])
  const [githubReposLoading, setGithubReposLoading] = useState(false)
  const [githubPullBusy, setGithubPullBusy] = useState(false)
  const [githubPullResult, setGithubPullResult] = useState<{ ok: boolean; message: string } | null>(null)
  // AI Code Review state
  const [githubReviewBusy, setGithubReviewBusy] = useState(false)
  const [githubReview, setGithubReview] = useState<{ score: number; summary: string; issues: { severity: string; file: string; line: string; message: string }[]; highlights: string[]; suggestion: string } | null>(null)
  // Phase 2: Branches
  const [branchSelectedRepo, setBranchSelectedRepo] = useState<string | null>(null)
  const [branchList, setBranchList] = useState<{ name: string; sha: string; protected: boolean; isDefault: boolean }[]>([])
  const [branchDefaultBranch, setBranchDefaultBranch] = useState('main')
  const [branchLoading, setBranchLoading] = useState(false)
  const [branchCreateName, setBranchCreateName] = useState('')
  const [branchCreateFrom, setBranchCreateFrom] = useState('main')
  const [branchCreateBusy, setBranchCreateBusy] = useState(false)
  const [branchMergeBusy, setBranchMergeBusy] = useState<string | null>(null)
  const [branchMsg, setBranchMsg] = useState<{ ok: boolean; text: string } | null>(null)
  // Phase 3: Commits
  const [commitsRepo, setCommitsRepo] = useState<string | null>(null)
  const [commitsBranch, setCommitsBranch] = useState('main')
  const [commitsList, setCommitsList] = useState<{ sha: string; message: string; author: string; date: string; url: string }[]>([])
  const [commitsLoading, setCommitsLoading] = useState(false)
  // Phase 3: Dev Tools
  const [showDevTools, setShowDevTools] = useState(false)
  const [devToolsTab, setDevToolsTab] = useState<'packages' | 'commands' | 'files'>('packages')
  const [npmSearch, setNpmSearch] = useState('')
  const [npmResults, setNpmResults] = useState<{ name: string; version: string; description: string; downloads: number }[]>([])
  const [npmSearching, setNpmSearching] = useState(false)
  const [workspaceData, setWorkspaceData] = useState<{ fileTree: { path: string; type: string; size: number }[]; fileCount: number; totalSize: number; rootPath: string } | null>(null)
  const [workspaceLoading, setWorkspaceLoading] = useState(false)
  // Deployed URLs — persisted per session in localStorage
  const [deployedUrls, setDeployedUrls] = useState<{ github?: string; hostinger?: string; pages?: string; octopus?: string; updatedAt?: string; version?: number; siteId?: string }>({})
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null)
  // Rollback state
  const [rollbackSnapshots, setRollbackSnapshots] = useState<{ version: number; fileCount: number; totalSize: number; createdAt: string }[]>([])
  const [rollbackOpen, setRollbackOpen] = useState(false)
  const [rollbackLoading, setRollbackLoading] = useState(false)
  const [rollbackRestoring, setRollbackRestoring] = useState<number | null>(null)
  // Analytics state
  const [analyticsData, setAnalyticsData] = useState<{
    totalViews: number; totalViewsAllTime: number; viewsByDay: { date: string; count: number }[];
    topPages: { path: string; count: number }[]; topReferrers: { referrer: string; count: number }[];
    topCountries: { country: string; count: number }[];
  } | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d'>('7d')
  // Custom domain state
  const [domainOpen, setDomainOpen] = useState(false)
  const [domainInput, setDomainInput] = useState('')
  const [domainData, setDomainData] = useState<{ domain: string | null; status: string | null; dnsVerified?: boolean; dnsError?: string | null } | null>(null)
  const [domainLoading, setDomainLoading] = useState<'save' | 'verify' | 'remove' | null>(null)
  const mainContainerRef = useRef<HTMLDivElement>(null)
  const prevCompletedRef = useRef(0)

  const sseRef = useRef<EventSource | null>(null)

  // ── Auto-scroll helper ─────────────────────────────────────────────
  // Debounced scroll-to-bottom using rAF to avoid thrashing during streaming
  const scrollToBottom = useCallback(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      const el = feedRef.current
      if (!el) return
      // Only auto-scroll if user is near the bottom (within 800px)
      // This prevents hijacking scroll if user scrolled up to read
      // 800px is generous enough to keep scrolling during long executions
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
      if (distFromBottom < 800) {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
      }
    })
  }, [])

  // Force scroll (ignores position — used for new messages & done events)
  const forceScrollToBottom = useCallback(() => {
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current)
    scrollRafRef.current = requestAnimationFrame(() => {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  // ESC key to close fullscreen preview
  useEffect(() => {
    if (!previewExpanded) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (publishOpen) { setPublishOpen(false); return }
        setPreviewExpanded(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [previewExpanded, publishOpen])

  // Fetch arm connection status eagerly on mount + detect project type when publish panel opens
  useEffect(() => {
    if (armStatusFetched.current) return
    armStatusFetched.current = true
    fetch('/api/brazos')
      .then(r => r.json())
      .then((conns: { armType: string; status: string; credentials?: string }[]) => {
        const status: Record<string, { connected: boolean; detail?: string }> = {}
        for (const c of conns) {
          if (['github', 'hostinger', 'web3forms'].includes(c.armType)) {
            const connected = c.status === 'connected'
            let detail = ''
            if (connected && c.credentials) {
              try {
                const creds = JSON.parse(c.credentials)
                if (c.armType === 'github') detail = creds.username || ''
                if (c.armType === 'hostinger') detail = creds.domain || ''
                if (c.armType === 'web3forms') detail = '✓ Configurado'
              } catch { /* ignore */ }
            }
            status[c.armType] = { connected, detail }
          }
        }
        setArmStatus(status)
      })
      .catch(() => { /* non-critical */ })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Detect project type from session files when publish panel opens
  useEffect(() => {
    if (!publishOpen || !activeSessionId) return
    const sessionCommands = commands.filter(c => c.type === 'write_file' && c.status === 'completed')
    const filePaths = sessionCommands.map(c => {
      try { const p = JSON.parse(c.payload); return p.path || p.filePath || '' } catch { return '' }
    }).filter(Boolean)
    const fileContents = sessionCommands.map(c => {
      try { const p = JSON.parse(c.payload); return p.content || '' } catch { return '' }
    }).join('\n')
    const hasApiRoutes = filePaths.some((f: string) => /\/api\//.test(f) || /route\.(ts|js)/.test(f))
    const hasPrisma = filePaths.some((f: string) => /schema\.prisma/.test(f)) || fileContents.includes('prisma')
    const hasNextConfig = filePaths.some((f: string) => /next\.config/.test(f))
    const hasServerCode = fileContents.includes('getServerSession') || fileContents.includes('NextResponse') || fileContents.includes('PrismaClient')
    const isFullStack = hasApiRoutes || hasPrisma || hasNextConfig || hasServerCode
    setPublishProjectType(isFullStack ? 'fullstack' : 'frontend')
  }, [publishOpen, activeSessionId, commands])

  // Load deployed URLs from localStorage when active session changes
  useEffect(() => {
    if (!activeSessionId) return
    try {
      const stored = localStorage.getItem(`ce_deployed_urls_${activeSessionId}`)
      if (stored) setDeployedUrls(JSON.parse(stored))
      else setDeployedUrls({})
    } catch { setDeployedUrls({}) }
  }, [activeSessionId])

  const saveDeployedUrl = useCallback((type: 'github' | 'hostinger' | 'pages' | 'octopus', url: string, extra?: { siteId?: string; serverVersion?: number }) => {
    setDeployedUrls(prev => {
      const newVersion = extra?.serverVersion ?? ((prev.version || 0) + 1)
      const next = { ...prev, [type]: url, updatedAt: new Date().toISOString(), version: newVersion, ...(extra?.siteId ? { siteId: extra.siteId } : {}) }
      if (activeSessionId) {
        try { localStorage.setItem(`ce_deployed_urls_${activeSessionId}`, JSON.stringify(next)) } catch { /* ignore */ }
      }
      return next
    })
  }, [activeSessionId])

  const copyUrl = useCallback((url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedUrl(url)
      setTimeout(() => setCopiedUrl(null), 2000)
    }).catch(() => { /* ignore */ })
  }, [])

  const fetchRollbackSnapshots = useCallback(async (siteId: string) => {
    setRollbackLoading(true)
    try {
      const res = await fetch(`/api/hosted-sites/rollback?siteId=${siteId}`)
      const data = await res.json()
      if (data.success) setRollbackSnapshots(data.snapshots || [])
    } catch { /* ignore */ }
    setRollbackLoading(false)
  }, [])

  const performRollback = useCallback(async (siteId: string, targetVersion: number) => {
    setRollbackRestoring(targetVersion)
    try {
      const res = await fetch('/api/hosted-sites/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, targetVersion }),
      })
      const data = await res.json()
      if (data.success) {
        // Update version in state
        setDeployedUrls(prev => {
          const next = { ...prev, version: data.restoredVersion, updatedAt: new Date().toISOString() }
          if (activeSessionId) {
            try { localStorage.setItem(`ce_deployed_urls_${activeSessionId}`, JSON.stringify(next)) } catch { /* ignore */ }
          }
          return next
        })
        // Refresh snapshots
        await fetchRollbackSnapshots(siteId)
        alert(t('ce.rollback_restored').replace('{n}', String(data.restoredVersion)))
      } else {
        alert(data.error || 'Rollback failed')
      }
    } catch { alert(t('ce.publish_conn_error')) }
    setRollbackRestoring(null)
  }, [activeSessionId, fetchRollbackSnapshots, t])

  const fetchAnalytics = useCallback(async (siteId: string, period: '7d' | '30d' = '7d') => {
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`/api/hosted-sites/analytics?siteId=${siteId}&period=${period}`)
      const data = await res.json()
      if (data.success) {
        setAnalyticsData({
          totalViews: data.totalViews,
          totalViewsAllTime: data.totalViewsAllTime,
          viewsByDay: data.viewsByDay || [],
          topPages: data.topPages || [],
          topReferrers: data.topReferrers || [],
          topCountries: data.topCountries || [],
        })
      }
    } catch { /* ignore */ }
    setAnalyticsLoading(false)
  }, [])

  const fetchDomainStatus = useCallback(async (siteId: string) => {
    try {
      const res = await fetch(`/api/hosted-sites/domain?siteId=${siteId}`)
      const data = await res.json()
      if (data.success) {
        setDomainData({ domain: data.domain, status: data.status, dnsVerified: data.dnsVerified, dnsError: data.dnsError })
        if (data.domain) setDomainInput(data.domain)
      }
    } catch { /* ignore */ }
  }, [])

  const saveDomain = useCallback(async (siteId: string, domain: string) => {
    setDomainLoading('save')
    try {
      const res = await fetch('/api/hosted-sites/domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId, domain }),
      })
      const data = await res.json()
      if (data.success) {
        setDomainData({ domain: data.domain, status: data.status, dnsVerified: false })
      } else {
        alert(data.error || 'Error')
      }
    } catch { alert(t('ce.publish_conn_error')) }
    setDomainLoading(null)
  }, [t])

  const verifyDomain = useCallback(async (siteId: string) => {
    setDomainLoading('verify')
    try {
      const res = await fetch(`/api/hosted-sites/domain?siteId=${siteId}`)
      const data = await res.json()
      if (data.success) {
        setDomainData({ domain: data.domain, status: data.status, dnsVerified: data.dnsVerified, dnsError: data.dnsError })
      }
    } catch { /* ignore */ }
    setDomainLoading(null)
  }, [])

  const removeDomain = useCallback(async (siteId: string) => {
    setDomainLoading('remove')
    try {
      const res = await fetch('/api/hosted-sites/domain', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      })
      const data = await res.json()
      if (data.success) {
        setDomainData(null)
        setDomainInput('')
      }
    } catch { /* ignore */ }
    setDomainLoading(null)
  }, [])

  // ---- Drag resizer between chat and preview panels ----
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingRef.current || !mainContainerRef.current) return
      const rect = mainContainerRef.current.getBoundingClientRect()
      let newWidth = rect.right - e.clientX
      newWidth = Math.max(280, Math.min(newWidth, rect.width - 200))
      setPreviewWidth(newWidth)
    }
    const onMouseUp = () => {
      if (!isResizingRef.current) return
      isResizingRef.current = false
      document.body.style.cursor = ''
      document.body.classList.remove('ce-dragging')
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  const onResizerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isResizingRef.current = true
    document.body.style.cursor = 'col-resize'
    document.body.classList.add('ce-dragging')
  }, [])

  // ---- Status / sessions ----
  const fetchStatus = useCallback(async () => {
    try {
      const r = await fetch('/api/arms/ollama/status')
      if (r.ok) {
        const data = await r.json()
        const st = data.status || data
        const lastSeen = st.lastSeenAt ? new Date(st.lastSeenAt).getTime() : 0
        const online = !!st.bridgePresent && Date.now() - lastSeen < 3 * 60 * 1000
        setBridgeStatus({ online, lastSeen: st.lastSeenAt })
      } else {
        setBridgeStatus({ online: false })
      }
    } catch {
      setBridgeStatus({ online: false })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  const fetchSessions = useCallback(async () => {
    try {
      const r = await fetch('/api/arms/claude-code/chat?action=sessions')
      if (r.ok) {
        const data = await r.json()
        setSessions(data.sessions || [])
      }
    } catch {}
  }, [])

  const fetchSession = useCallback(async (sessionId: string, restoreModel = true) => {
    try {
      const r = await fetch(`/api/arms/claude-code/chat?action=messages&sessionId=${sessionId}`)
      if (r.ok) {
        const data = await r.json()
        setMessages(data.messages || [])
        // Merge commands from DB with existing state — prefer DB status (more recent)
        // but don't clobber optimistic SSE updates that may be more up-to-date
        const dbCommands: BridgeCommand[] = data.commands || []
        setCommands((prev) => {
          if (prev.length === 0) return dbCommands
          const map = new Map(prev.map((c) => [c.id, c]))
          for (const dc of dbCommands) {
            const existing = map.get(dc.id)
            if (!existing) {
              map.set(dc.id, dc)
            } else {
              // DB is source of truth — update status, result, error
              map.set(dc.id, { ...existing, status: dc.status, result: dc.result, error: dc.error })
            }
          }
          return Array.from(map.values())
        })
        // Only restore the session's model when switching sessions, not after sending a message
        if (restoreModel && data.session?.model) setSelectedModel(data.session.model)
      }
    } catch (err) {
      console.error('[fetchSession] Error:', err)
    }
  }, [setSelectedModel])

  // Fallback: fetch all commands from REST (used on session load & after confirm/reject)
  const fetchCommands = useCallback(async () => {
    if (!activeSessionId) return
    try {
      const r = await fetch(`/api/arms/claude-code/chat?action=commands&sessionId=${activeSessionId}`)
      if (r.ok) {
        const data = await r.json()
        setCommands(data.commands || [])
      }
    } catch {}
  }, [activeSessionId])

  // Workspace intelligence fetchers
  const fetchWorkspace = useCallback(async () => {
    try {
      const r = await fetch('/api/arms/claude-code/workspace?action=index')
      if (r.ok) {
        const data = await r.json()
        setWorkspace(data)
      }
    } catch {}
  }, [])

  const fetchRecentChanges = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
      const r = await fetch(`/api/arms/claude-code/workspace?action=changes&since=${since}`)
      if (r.ok) {
        const data = await r.json()
        setRecentChanges(data.changes || [])
      }
    } catch {}
  }, [])

  useEffect(() => {
    fetchStatus()
    fetchSessions()
    fetchWorkspace()
    fetchRecentChanges()
    const interval = setInterval(fetchStatus, 30000)
    const wsInterval = setInterval(() => { fetchWorkspace(); fetchRecentChanges() }, 30000)
    return () => { clearInterval(interval); clearInterval(wsInterval) }
  }, [fetchStatus, fetchSessions, fetchWorkspace, fetchRecentChanges])

  useEffect(() => {
    if (activeSessionId) {
      fetchSession(activeSessionId)
    } else {
      setMessages([])
      setCommands([])
      setPreviewCmdId(null)
      setProjectPreview(false)
    }
  }, [activeSessionId, fetchSession])

  // ── SSE Real-Time Stream ─────────────────────────────────────────────
  // Subscribes to /api/arms/claude-code/stream for real-time command updates.
  useEffect(() => {
    // Close previous SSE connection
    if (sseRef.current) {
      sseRef.current.close()
      sseRef.current = null
    }
    if (!activeSessionId) return

    const es = new EventSource(`/api/arms/claude-code/stream?sessionId=${activeSessionId}`)
    sseRef.current = es

    es.onopen = () => {
      console.log('[SSE] Connected to stream for session', activeSessionId)
    }

    es.addEventListener('command_new', (e) => {
      try {
        const cmd = JSON.parse(e.data) as {
          id: string; type: string; payload: Record<string, unknown>
          status: string; requiresConfirmation: boolean; createdAt: string
        }
        console.log('[SSE] command_new:', cmd.id, cmd.type, cmd.status)
        setCommands((prev) => {
          if (prev.some((c) => c.id === cmd.id)) return prev
          return [...prev, {
            id: cmd.id,
            sessionId: activeSessionId,
            messageId: null,
            type: cmd.type,
            payload: JSON.stringify(cmd.payload),
            status: cmd.status as BridgeCommand['status'],
            result: null,
            error: null,
            streamOutput: null,
            requiresConfirmation: cmd.requiresConfirmation,
            createdAt: cmd.createdAt,
          }]
        })
      } catch (err) {
        console.error('[SSE] Failed to parse command_new:', err, e.data)
      }
    })

    es.addEventListener('command_update', (e) => {
      try {
        const upd = JSON.parse(e.data) as { id: string; status: string; result?: unknown; error?: string | null }
        console.log('[SSE] command_update:', upd.id, upd.status)
        setCommands((prev) =>
          prev.map((c) => {
            if (c.id !== upd.id) return c
            // CRITICAL: Do NOT let SSE override save_image commands to 'failed'
            // The image-gen poll loop is the ONLY authority for save_image status.
            // SSE reads DB status which can be stale or written by the Bridge before
            // the image-gen system marks it as approved. Only accept 'executing' and
            // 'completed' from SSE for save_image (those come from the Bridge AFTER
            // the image was successfully downloaded).
            if (c.type === 'save_image' && upd.status === 'failed') {
              console.log(`[SSE] ⚠ Ignoring 'failed' for save_image ${upd.id.slice(0, 8)} — image-gen poll is authority`)
              return c
            }
            return {
              ...c,
              status: upd.status as BridgeCommand['status'],
              result: upd.result !== undefined ? JSON.stringify(upd.result) : c.result,
              error: upd.error ?? c.error,
            }
          }),
        )
      } catch (err) {
        console.error('[SSE] Failed to parse command_update:', err, e.data)
      }
    })

    es.addEventListener('stream_output', (e) => {
      try {
        const so = JSON.parse(e.data) as { id: string; delta: string; total: number }
        setCommands((prev) =>
          prev.map((c) =>
            c.id === so.id
              ? { ...c, streamOutput: (c.streamOutput || '') + so.delta }
              : c,
          ),
        )
      } catch (err) {
        console.error('[SSE] Failed to parse stream_output:', err)
      }
    })

    es.onerror = (err) => {
      console.warn('[SSE] Connection error, will auto-reconnect', err)
      // BUG 1 fix: Track reconnections during image generation
      if (imageGenStatus === 'generating') {
        sseReconnectCountRef.current++
        const count = sseReconnectCountRef.current
        console.warn(`[SSE] Reconnect #${count} during image generation`)
        if (count >= 3) {
          setImageGenStatus('failed')
          setImageGenDetails(prev => ({ ...prev, error: 'Conexión interrumpida — escribe "reintentar"' }))
          setSending(false)
          sseReconnectCountRef.current = 0
        }
      }
    }

    return () => {
      es.close()
      sseRef.current = null
    }
  }, [activeSessionId])

  // ── Adaptive Polling for Command Status ──────────────────────────────
  // Polls faster when commands are actively executing (1.5s), slower when
  // just sending/waiting (4s), and stops entirely when idle.
  useEffect(() => {
    if (!activeSessionId) return
    const hasExecuting = commands.some((c) => c.status === 'executing')
    const hasActive = commands.some((c) =>
      c.status === 'approved' || c.status === 'executing' || c.status === 'pending',
    )
    if (!hasActive && !sending) return

    // Adaptive interval: fast during execution, relaxed otherwise
    const pollMs = hasExecuting ? 1500 : 4000
    let cancelled = false

    const poll = async () => {
      if (cancelled) return
      try {
        const r = await fetch(`/api/arms/claude-code/chat?action=commands&sessionId=${activeSessionId}`)
        if (!r.ok) return
        const data = await r.json()
        const fresh: BridgeCommand[] = data.commands || []
        if (fresh.length === 0) return
        setCommands((prev) => {
          const map = new Map(prev.map((c) => [c.id, c]))
          let changed = false
          for (const fc of fresh) {
            const existing = map.get(fc.id)
            if (!existing) {
              map.set(fc.id, fc)
              changed = true
            } else if (existing.status !== fc.status || existing.result !== fc.result) {
              map.set(fc.id, { ...existing, status: fc.status, result: fc.result, error: fc.error })
              changed = true
            }
          }
          return changed ? Array.from(map.values()) : prev
        })
      } catch {}
    }

    const interval = setInterval(poll, pollMs)
    return () => { cancelled = true; clearInterval(interval) }
  }, [activeSessionId, commands, sending])

  // Scroll on messages/commands array changes + scrollTick (streaming)
  useEffect(() => {
    scrollToBottom()
  }, [messages, commands, scrollTick, scrollToBottom])

  // ── Stuck Command Recovery ────────────────────────────────────────────
  // If commands stay in 'executing' for >90s with no progress, force them
  // to 'completed' client-side so the UI doesn't stay stuck forever.
  const stuckTimerRef = useRef<NodeJS.Timeout | null>(null)
  useEffect(() => {
    const executingCmds = commands.filter((c) => c.status === 'executing')
    if (executingCmds.length === 0 || sending) {
      if (stuckTimerRef.current) { clearTimeout(stuckTimerRef.current); stuckTimerRef.current = null }
      return
    }
    // Start a 90s timer — if executing commands don't resolve, force-complete them
    if (!stuckTimerRef.current) {
      stuckTimerRef.current = setTimeout(() => {
        console.warn('[StuckRecovery] Force-completing stuck commands after 90s')
        setCommands((prev) =>
          prev.map((c) =>
            c.status === 'executing'
              ? { ...c, status: 'completed' as const, result: '(completed — Bridge response delayed)' }
              : c,
          ),
        )
        stuckTimerRef.current = null
      }, 90000)
    }
    return () => {
      if (stuckTimerRef.current) { clearTimeout(stuckTimerRef.current); stuckTimerRef.current = null }
    }
  }, [commands, sending])

  // Sprint 10: Detect when all commands complete → show feedback injected indicator
  useEffect(() => {
    if (commands.length === 0) return
    // Exclude save_image from completion check — image pipeline handles those
    const nonImgCmds = commands.filter(c => c.type !== 'save_image')
    if (nonImgCmds.length === 0) return
    const allDone = nonImgCmds.every(c => c.status === 'completed' || c.status === 'failed')
    const hasActive = nonImgCmds.some(c => c.status === 'approved' || c.status === 'executing')
    if (allDone && !hasActive && !feedbackInjected && !sending) {
      setFeedbackInjected(true)
      if (feedbackFadeRef.current) clearTimeout(feedbackFadeRef.current)
      feedbackFadeRef.current = setTimeout(() => setFeedbackInjected(false), 8000)
      // Force scroll to bottom when all commands finish — user should see the result
      setTimeout(() => forceScrollToBottom(), 200)
    }
  }, [commands, feedbackInjected, sending, forceScrollToBottom])

  // Auto-select latest command for preview + auto-switch to project mode + auto-refresh
  useEffect(() => {
    if (commands.length === 0) {
      setPreviewCmdId(null)
      setProjectPreview(false)
      prevCompletedRef.current = 0
      return
    }
    const completedCount = commands.filter((c) => c.status === 'completed').length

    // Detect newly completed commands → force iframe re-render
    if (completedCount > prevCompletedRef.current) {
      setPreviewRefreshKey((k) => k + 1)
      // Auto-select latest completed command (prefer: image > HTML > any write_file)
      const completedImages = commands.filter((c) => c.type === 'save_image' && (c.status === 'completed' || c.status === 'approved'))
      const completedWrites = commands.filter((c) => c.type === 'write_file' && c.status === 'completed')
      if (completedImages.length > 0) {
        // Prefer latest image for preview
        setPreviewCmdId(completedImages[completedImages.length - 1].id)
        setRightTab('preview')
      } else if (completedWrites.length > 0) {
        const htmlWrite = [...completedWrites].reverse().find((c) => {
          try { return isHtmlPath(safeJsonParse(c.payload).path) } catch { return false }
        })
        const pick = htmlWrite || completedWrites[completedWrites.length - 1]
        setPreviewCmdId(pick.id)
        setRightTab('preview')
      }
    }
    prevCompletedRef.current = completedCount

    // Prefer the latest non-rejected command if nothing selected
    const current = commands.find((c) => c.id === previewCmdId)
    if (!current) {
      const latest = [...commands].reverse().find((c) => c.status !== 'rejected') || commands[commands.length - 1]
      setPreviewCmdId(latest.id)
    }
    // Auto-switch to project preview if there's an HTML write_file + any other commands
    // (project mode combines CSS/JS into the HTML preview — strictly better than single-file mode)
    const allWrites = commands.filter((c) => c.type === 'write_file' && ['completed', 'approved', 'executing'].includes(c.status))
    if (allWrites.length >= 1) {
      const hasHtml = allWrites.some((c) => {
        try { const p = safeJsonParse(c.payload); return isHtmlPath(p.path) } catch { return false }
      })
      // Activate project mode if HTML + at least 1 more command of any type
      const hasOtherCommands = commands.length > 1 || allWrites.length >= 2
      if (hasHtml && hasOtherCommands && !projectPreview) setProjectPreview(true)
    }
  }, [commands, previewCmdId, projectPreview])

  // Latest user question (shown in title area)
  const currentTitle = useMemo(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user')
    if (lastUser) return lastUser.content
    if (lastUserMessage) return lastUserMessage
    return t('ce.title_empty')
  }, [messages, lastUserMessage, t])

  const isThinking = sending || messages.some((m) => m.role === 'assistant' && m.status === 'streaming')
  const isExecutingAny = commands.some((c) => c.status === 'executing' || c.status === 'approved')

  // Debug: trace thinking/sending state changes
  useEffect(() => {
    if (isThinking || commands.length > 0) {
      console.log('[CodeEngine] isThinking=', isThinking, 'sending=', sending, 'commands=', commands.length, 'cmdStatuses=', commands.map(c => c.status))
    }
  }, [isThinking, sending, commands])

  // Compute live preview URL from Bridge local server — use LATEST html (reverse order)
  const livePreviewUrl = useMemo(() => {
    const completedWrites = commands.filter((c) => c.type === 'write_file' && c.status === 'completed')
    if (completedWrites.length === 0) return null
    // Find LATEST HTML file to preview (reverse so most recent project wins)
    const reversed = [...completedWrites].reverse()
    const htmlWrite = reversed.find((c) => {
      try { return isHtmlPath(safeJsonParse(c.payload).path) } catch { return false }
    })
    if (!htmlWrite) return null
    try {
      const p = safeJsonParse(htmlWrite.payload).path as string
      return `http://localhost:9753/${p.replace(/\\/g, '/')}`
    } catch { return null }
  }, [commands])

  const previewCmd = useMemo(
    () => commands.find((c) => c.id === previewCmdId) || null,
    [commands, previewCmdId],
  )

  // ---- Send ----
  const sendMessage = async () => {
    const trimmed = input.trim()
    if ((!trimmed && pendingImages.length === 0) || sending) return
    if (!bridgeStatus?.online) return

    // Sprint 11: Natural language rollback detection
    const rollbackPatterns = /\b(deshaz|deshacer|rollback|vuelve al estado anterior|undo|revert|restaura|restore)\b/i
    if (rollbackPatterns.test(trimmed)) {
      try {
        await fetch('/api/arms/claude-code/snapshots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'rollback', sessionId: activeSessionId }),
        })
        setPhoenixEvent({ type: 'rollback_executed', detail: t('ce.phoenix_rollback_triggered') })
        if (phoenixFadeRef.current) clearTimeout(phoenixFadeRef.current)
        phoenixFadeRef.current = setTimeout(() => setPhoenixEvent(null), 8000)
      } catch { /* rollback is best-effort, LLM will also see the intent */ }
    }

    // Capture images before clearing
    const imagesToSend = [...pendingImages]

    setSending(true)
    setInput('')
    setPendingImages([])
    setLastUserMessage(trimmed)
    setTxStatus(null)
    setTxDetails(null)
    setDepStatus(null)
    setDepDetails(null)
    setPhoenixEvent(null)
    setImageGenStatus(null)
    setImageGenDetails(null)
    setTelemetryStages([])
    setTelemetryTotal(0)
    setFeedbackInjected(false)
    sseReconnectCountRef.current = 0
    pendingImageJobsRef.current = null
    // BUG 3 fix: Start 90s safety timeout to auto-unlock input
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current)
    safetyTimeoutRef.current = setTimeout(() => {
      console.error('[SafetyTimeout] 90s without SSE events — force-unlocking input')
      setSending(false)
      setImageGenStatus(prev => prev === 'generating' ? 'failed' : prev)
      setImageGenDetails(prev => prev ? { ...prev, error: 'Timeout — sin respuesta del servidor' } : prev)
    }, 90_000)
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
      inputRef.current.style.overflowY = 'hidden'
    }

    // Optimistic — include image markers for display
    const imageMarkers = imagesToSend.length > 0
      ? '\n' + imagesToSend.map(img => `[IMG:${img.name}:${img.preview.slice(0, 100)}]`).join('\n')
      : ''
    const tempUserMsg: CodeMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: trimmed + imageMarkers,
      status: 'completed',
      createdAt: new Date().toISOString(),
    }
    const tempAssistantMsg: CodeMessage = {
      id: `temp-asst-${Date.now()}`,
      role: 'assistant',
      content: '',
      status: 'streaming',
      createdAt: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, tempUserMsg, tempAssistantMsg])
    // Reset scroll trigger counter and force scroll to show new user message
    scrollTriggerRef.current = 0
    setTimeout(() => forceScrollToBottom(), 50)

    try {
      const res = await fetch('/api/arms/claude-code/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: activeSessionId,
          model: selectedModel,
          message: trimmed || (imagesToSend.length > 0 ? t('ce.image_attached') : ''),
          images: imagesToSend.length > 0 ? imagesToSend.map(img => img.base64) : undefined,
          premiumMode,
          runtimeErrors: runtimeErrorsRef.current.length > 0
            ? [...new Set(runtimeErrorsRef.current)].slice(-10)
            : undefined,
        }),
      })
      if (!res.ok || !res.body) {
        const err = await res.text().catch(() => 'unknown error')
        setMessages((prev) =>
          prev.map((m) =>
            m.id === tempAssistantMsg.id
              ? { ...m, status: 'failed' as const, error: err.slice(0, 200) }
              : m,
          ),
        )
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let realSessionId: string | null = activeSessionId
      let realMessageId: string | null = null
      let accumulated = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''
        for (const ev of events) {
          const lines = ev.split('\n')
          let eventName = 'message'
          let dataStr = ''
          for (const ln of lines) {
            if (ln.startsWith('event:')) eventName = ln.slice(6).trim()
            else if (ln.startsWith('data:')) dataStr += ln.slice(5).trim()
          }
          if (!dataStr) continue
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let data: { sessionId?: string; messageId?: string; content?: string; commands?: BridgeCommand[]; error?: string; detail?: string; txId?: string; actionCount?: number; commandCount?: number; reason?: string; criticalErrors?: string[]; affectedFiles?: string[]; [k: string]: any } = {}
          try { data = JSON.parse(dataStr) } catch { continue }

          // BUG 3 fix: Reset safety timeout on every received event
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current)
            safetyTimeoutRef.current = setTimeout(() => {
              console.error('[SafetyTimeout] 90s without events — force-unlocking input')
              setSending(false)
              setImageGenStatus(prev => prev === 'generating' ? 'failed' : prev)
              setImageGenDetails(prev => prev ? { ...prev, error: 'Timeout — sin respuesta del servidor' } : prev)
            }, 90_000)
          }

          if (eventName === 'session') {
            realSessionId = data.sessionId || realSessionId
            realMessageId = data.messageId || null
            setActiveLenses([]) // limpia lentes del turno anterior
            if (!activeSessionId && realSessionId) setActiveSessionId(realSessionId)
            if (realMessageId) {
              setMessages((prev) =>
                prev.map((m) => (m.id === tempAssistantMsg.id ? { ...m, id: realMessageId! } : m)),
              )
            }
          } else if (eventName === 'session_memory_loaded') {
            // Show memory loaded indicator
            setMemoryLoaded(true)
            if (memoryFadeRef.current) clearTimeout(memoryFadeRef.current)
            memoryFadeRef.current = setTimeout(() => setMemoryLoaded(false), 6000)
            console.log('[SessionMemory] Memory context loaded into session')
          } else if (eventName === 'transaction_started') {
            setTxStatus('started')
            setTxDetails({ txId: data.txId, actionCount: data.actionCount })
            if (txFadeRef.current) clearTimeout(txFadeRef.current)
            console.log('[Transaction] Started:', data.txId, data.actionCount, 'actions')
          } else if (eventName === 'transaction_validating') {
            setTxStatus('validating')
            console.log('[Transaction] Validating:', data.txId)
          } else if (eventName === 'auto_repair_started') {
            setTxStatus('repairing')
            console.log('[CodeValidator] Auto-repair started:', data.errors)
          } else if (eventName === 'auto_repair_attempt') {
            console.log(`[CodeValidator] Attempt ${data.attempt} on ${data.file}: ${data.fixed ? '✅ fixed' : '❌ still broken'}`)
          } else if (eventName === 'auto_repair_success') {
            setTxStatus('validating')
            console.log(`[CodeValidator] ✅ All files repaired in ${data.attempts} attempt(s)`)
          } else if (eventName === 'auto_repair_failed') {
            console.log(`[CodeValidator] ❌ Repair failed after ${data.attempts} attempts`)
          } else if (eventName === 'transaction_committed') {
            setTxStatus('committed')
            setTxDetails(prev => ({ ...prev, commandCount: data.commandCount }))
            if (txFadeRef.current) clearTimeout(txFadeRef.current)
            txFadeRef.current = setTimeout(() => { setTxStatus(null); setTxDetails(null) }, 8000)
            console.log('[Transaction] Committed:', data.txId, data.commandCount, 'commands')
          } else if (eventName === 'transaction_rolled_back') {
            setTxStatus('rolled_back')
            setTxDetails({ txId: data.txId, reason: data.reason, criticalErrors: data.criticalErrors, affectedFiles: data.affectedFiles })
            console.log('[Transaction] Rolled back:', data.txId, data.reason)
          } else if (eventName === 'dependency_scanning') {
            setDepStatus('scanning')
            if (depFadeRef.current) clearTimeout(depFadeRef.current)
            console.log('[DependencyResolver] Scanning:', data.txId)
          } else if (eventName === 'dependency_resolved') {
            setDepStatus('resolved')
            setDepDetails({ totalResolved: data.totalDetected, resolved: data.resolved, injectedFiles: data.injectedFiles, needsInstall: data.needsInstall })
            console.log('[DependencyResolver] Resolved:', data.totalDetected, 'packages')
          } else if (eventName === 'dependency_ready') {
            setDepStatus('ready')
            setDepDetails(prev => ({ ...prev, totalResolved: data.totalResolved }))
            if (depFadeRef.current) clearTimeout(depFadeRef.current)
            depFadeRef.current = setTimeout(() => { setDepStatus(null); setDepDetails(null) }, 10000)
            console.log('[DependencyResolver] Ready:', data.totalResolved, 'resolved')
          } else if (eventName === 'visual_enhanced') {
            // Sprint 13: Visual Enhancer notification
            const vFiles = (data as { files?: string[]; count?: number }).files || []
            console.log(`[VisualEnhancer] Scroll animations injected into ${vFiles.length} files:`, vFiles)
          } else if (eventName === 'incremental_diff') {
            // Fase 3: diff incremental — archivos sin cambios omitidos
            const d = data as { skipped?: number; written?: number }
            if (d.skipped) {
              setDiffNotice({ skipped: d.skipped || 0, written: d.written || 0 })
              if (diffNoticeRef.current) clearTimeout(diffNoticeRef.current)
              diffNoticeRef.current = setTimeout(() => setDiffNotice(null), 8000)
              console.log(`[IncrementalDiff] Skipped ${d.skipped} unchanged, wrote ${d.written}`)
            }
          } else if (eventName === 'specialists_active') {
            // Fase 4: lentes especializadas activadas para este turno
            const sl = data as { lenses?: Array<{ id: string; name: string; emoji: string }> }
            if (sl.lenses && sl.lenses.length > 0) {
              setActiveLenses(sl.lenses)
              console.log('[SpecialistLenses] Active:', sl.lenses.map(l => l.id).join(', '))
            }
          } else if (eventName === 'token_usage') {
            // Fase 4: uso de tokens + costo estimado del turno
            const tu = (data as { turn?: { totalTokens: number; costUsd: number; model: string; estimated: boolean } }).turn
            if (tu) {
              setTokenUsage({ totalTokens: tu.totalTokens, costUsd: tu.costUsd, model: tu.model, estimated: tu.estimated })
              console.log(`[TokenTracking] ${tu.totalTokens} tokens (~$${tu.costUsd}) ${tu.estimated ? 'est.' : ''}`)
            }
          } else if (eventName === 'vision_analyzing') {
            // Web Vision: show screenshots + analysis viewer
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vd = data as any
            setVisionData({
              url: vd.url || '',
              screenshots: vd.screenshots || { above: '', full: '' },
              analysis: vd.analysis || {},
            })
            setVisionExpanded(true)
            if (visionFadeRef.current) clearTimeout(visionFadeRef.current)
            // Auto-collapse after 30s
            visionFadeRef.current = setTimeout(() => setVisionExpanded(false), 30000)
            console.log('[WebVision] Vision analysis received for:', vd.url)
          } else if (eventName === 'self_review_started') {
            // Self-Review Reflexion Loop: capturing screenshot
            setSelfReviewStatus('capturing')
            setSelfReviewData(null)
            setSelfReviewExpanded(true)
            console.log('[SelfReview] Started — capturing screenshot...')
          } else if (eventName === 'self_review_complete') {
            // Self-Review Reflexion Loop: review complete with score/issues
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const sr = data as any
            setSelfReviewData({
              score: sr.score ?? 0,
              passed: sr.passed ?? false,
              issues: sr.issues || [],
              praise: sr.praise || [],
              summary: sr.summary || '',
            })
            setSelfReviewStatus('complete')
            setSelfReviewExpanded(true)
            console.log(`[SelfReview] Complete — Score: ${sr.score}/100, Issues: ${sr.issues?.length || 0}`)
          } else if (eventName === 'telemetry') {
            // Sprint 10: Telemetry pipeline update
            const stages = (data as { stages?: TelemetryStageUI[]; totalDurationMs?: number }).stages
            const totalMs = (data as { totalDurationMs?: number }).totalDurationMs
            if (stages) setTelemetryStages(stages)
            if (totalMs !== undefined) setTelemetryTotal(totalMs)
          } else if (eventName === 'dependency_graph_ready') {
            setDepGraph(data as { fileCount: number; totalLines: number; missingImports: number; npmPackages: string[] })
            console.log('[CodeIntelligence] Dependency graph:', data)
          } else if (eventName === 'code_warnings') {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const w = (data as any).warnings as { file: string; missingLocal: string[]; missingPkgs: string[]; syntaxErrors: string[] }[]
            setCodeWarnings(w || [])
            console.log('[CodeIntelligence] Code warnings:', w)
          } else if (eventName === 'image_jobs') {
            // Sprint 12 Decoupled: Store jobs — frontend will process after stream closes
            pendingImageJobsRef.current = {
              sessionId: data.sessionId as string,
              messageId: data.messageId as string,
              jobs: data.jobs as Array<{ index: number; prompt: string; model: string; path: string; aspect_ratio: string }>,
            }
            setImageGenStatus('generating')
            if (imageGenFadeRef.current) clearTimeout(imageGenFadeRef.current)
            setImageGenDetails({ count: data.count as number, current: 0, total: data.count as number, results: [] })
            console.log('[ImageGen] Received', data.count, 'async image jobs — will process after stream closes')
          } else if (eventName === 'delta' && data.content) {
            accumulated += data.content
            const targetId = realMessageId || tempAssistantMsg.id
            setMessages((prev) =>
              prev.map((m) => (m.id === targetId ? { ...m, content: accumulated } : m)),
            )
            // Trigger scroll every ~500 chars of streaming content
            scrollTriggerRef.current++
            if (scrollTriggerRef.current % 10 === 0) {
              setScrollTick(scrollTriggerRef.current)
            }
          } else if (eventName === 'commands' && data.commands) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const incoming = data.commands as any[]
            setCommands((prev) => {
              const ids = new Set(prev.map((c) => c.id))
              const fresh = incoming
                .filter((c) => !ids.has(c.id))
                .map((c) => ({
                  ...c,
                  // Normalize payload to string — SSE sends it as object, but BridgeCommand expects string
                  payload: typeof c.payload === 'string' ? c.payload : JSON.stringify(c.payload || {}),
                  status: c.status || (c.needsConfirm ? 'pending' : 'approved'),
                }))
              console.log('[Chat] commands event:', fresh.length, 'new commands', fresh.map((c: { id: string; status: string }) => `${c.id}:${c.status}`))
              return [...prev, ...fresh]
            })
          } else if (eventName === 'done') {
            const targetId = realMessageId || tempAssistantMsg.id
            setMessages((prev) =>
              prev.map((m) => (m.id === targetId ? { ...m, status: 'completed' as const } : m)),
            )
            // Force scroll to bottom when response is complete
            setTimeout(() => forceScrollToBottom(), 150)
          } else if (eventName === 'error') {
            const targetId = realMessageId || tempAssistantMsg.id
            setMessages((prev) =>
              prev.map((m) =>
                m.id === targetId
                  ? { ...m, status: 'failed' as const, error: data.detail || data.error || 'Error' }
                  : m,
              ),
            )
          }
        }
      }
      if (realSessionId) {
        await fetchSession(realSessionId, false)
        // Burst-poll command statuses for 20s to catch rapid Bridge execution
        // Bridge polls every 2s, so we poll every 1.5s to stay ahead
        let burstCount = 0
        const burstMax = 13 // ~20 seconds
        const burstInterval = setInterval(async () => {
          burstCount++
          try {
            const r = await fetch(`/api/arms/claude-code/chat?action=commands&sessionId=${realSessionId}`)
            if (!r.ok) return
            const d = await r.json()
            const fresh: BridgeCommand[] = d.commands || []
            if (fresh.length === 0) return
            setCommands((prev) => {
              const map = new Map(prev.map((c) => [c.id, c]))
              let changed = false
              for (const fc of fresh) {
                const existing = map.get(fc.id)
                if (!existing) {
                  map.set(fc.id, fc)
                  changed = true
                } else if (existing.status !== fc.status || existing.result !== fc.result) {
                  map.set(fc.id, { ...existing, status: fc.status, result: fc.result, error: fc.error })
                  changed = true
                }
              }
              return changed ? Array.from(map.values()) : prev
            })
            // Scroll to show updated command statuses
            scrollToBottom()
            // Stop early if all NON-image commands are terminal
            // save_image commands are handled by processImageJobs — exclude from burst
            const nonImageCmds = fresh.filter((c) => c.type !== 'save_image')
            const allTerminal = nonImageCmds.length === 0 || nonImageCmds.every((c) =>
              c.status === 'completed' || c.status === 'failed' || c.status === 'rejected' || c.status === 'approved',
            )
            if (allTerminal || burstCount >= burstMax) {
              console.log(`[Burst] Stopping after ${burstCount} polls — allTerminal=${allTerminal} (non-image: ${nonImageCmds.map(c => c.status).join(',')}, image: ${fresh.filter(c => c.type === 'save_image').map(c => c.status).join(',') || 'none'})`)
              clearInterval(burstInterval)
            }
          } catch {
            // Silently continue
          }
        }, 1500)
      }
      fetchSessions()
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('ce.error_network')
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempAssistantMsg.id ? { ...m, status: 'failed' as const, error: msg } : m,
        ),
      )
    } finally {
      setSending(false)
      // BUG 3 fix: Clear safety timeout — response completed
      if (safetyTimeoutRef.current) { clearTimeout(safetyTimeoutRef.current); safetyTimeoutRef.current = null }
      // Sprint 12 Decoupled: Process pending image jobs AFTER stream closes
      if (pendingImageJobsRef.current) {
        console.log(`[ImageGen] 🚀 Stream closed — launching processImageJobs with ${pendingImageJobsRef.current.jobs?.length} jobs`)
        processImageJobs(pendingImageJobsRef.current)
        pendingImageJobsRef.current = null
      } else {
        console.log('[ImageGen] Stream closed — no pending image jobs')
      }
    }
  }

  // ── Sprint 12 v4: Async Image Job Processor with Polling ──
  // Phase 1: POST to /image-gen for each image — returns jobId instantly (<500ms)
  // Phase 2: Poll GET /image-gen?jobId=xxx every 3s until completed/failed
  // ✅ PARALLEL: All images submit + generate simultaneously, then single unified poll loop
  const processImageJobs = async (jobSet: {
    sessionId: string; messageId: string;
    jobs: Array<{ index: number; prompt: string; model: string; path: string; aspect_ratio: string }>;
  }) => {
    const { sessionId: imgSessionId, messageId: imgMessageId, jobs } = jobSet
    console.log(`[ImageGen] 🚀 PARALLEL processing of ${jobs.length} images`)

    // ── Phase 1: Submit ALL jobs simultaneously ──
    const jobTickets: Array<{ index: number; jobId: string | null; path: string; error?: string }> = []

    const submitPromises = jobs.map(async (job, i) => {
      try {
        const submitRes = await fetch('/api/arms/claude-code/image-gen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: job.prompt, model: job.model, path: job.path,
            aspect_ratio: job.aspect_ratio,
            sessionId: imgSessionId, messageId: imgMessageId,
          }),
        })
        if (!submitRes.ok) {
          const errData = await submitRes.json().catch(() => ({ error: 'Submit failed' }))
          return { index: i, jobId: null, path: job.path, error: errData.error }
        }
        const { jobId } = await submitRes.json()
        console.log(`[ImageGen] 📋 Image ${i + 1}/${jobs.length} submitted: ${jobId?.slice(0, 8)}`)
        return { index: i, jobId, path: job.path }
      } catch (err) {
        return { index: i, jobId: null, path: job.path, error: 'Network error' }
      }
    })

    const settled = await Promise.all(submitPromises)
    jobTickets.push(...settled)

    const activeJobs = jobTickets.filter(j => j.jobId)
    const failedSubmits = jobTickets.filter(j => !j.jobId)
    console.log(`[ImageGen] Submitted: ${activeJobs.length} active, ${failedSubmits.length} failed`)

    setImageGenDetails(prev => ({
      ...prev, total: jobs.length,
      current: 0, // will update as they complete
    }))

    // ── Phase 2: Unified poll loop — poll ALL active jobs simultaneously ──
    const POLL_INTERVAL = 2500 // 2.5s between polls (faster since parallel)
    const MAX_POLLS = 180 // 7.5 minutes max — GPT-5.4 takes 200-230s per image
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const results: any[] = [...failedSubmits.map(j => ({ error: j.error, path: j.path }))]
    let successCount = 0
    let pollCount = 0
    const pendingJobIds = new Set(activeJobs.map(j => j.jobId!))
    const startTime = Date.now()

    console.log(`[ImageGen] 🔄 Unified poll loop — ${pendingJobIds.size} jobs, max ${MAX_POLLS} polls`)

    while (pendingJobIds.size > 0 && pollCount < MAX_POLLS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL))
      pollCount++

      const elapsed = Math.round((Date.now() - startTime) / 1000)

      // Poll all pending jobs in parallel
      const pollPromises = Array.from(pendingJobIds).map(async (jobId) => {
        try {
          const pollRes = await fetch(`/api/arms/claude-code/image-gen?jobId=${jobId}`)
          if (!pollRes.ok) return { jobId, status: 'poll_error' }
          return await pollRes.json()
        } catch {
          return { jobId, status: 'poll_error' }
        }
      })

      const pollResults = await Promise.all(pollPromises)

      for (const pollData of pollResults) {
        if (!pollData.jobId) continue

        if (pollData.status === 'approved' || pollData.status === 'completed') {
          // ✅ Image done!
          pendingJobIds.delete(pollData.jobId)
          results.push(pollData)
          successCount++
          setImageGenDetails(prev => ({
            ...prev,
            current: successCount,
            results: [...(prev?.results || []), pollData],
          }))
          console.log(`[ImageGen] ✅ ${pollData.modelUsed} → ${pollData.path} (${elapsed}s) [${pendingJobIds.size} remaining]`)
        } else if (pollData.status === 'failed') {
          // ❌ Image failed
          pendingJobIds.delete(pollData.jobId)
          results.push({ error: pollData.error || 'Generation failed', path: pollData.path })
          console.error(`[ImageGen] ❌ ${pollData.path}: ${pollData.error}`)
        }
        // 'generating' or 'executing' — keep polling
      }

      // Log progress periodically
      if (pollCount <= 3 || pollCount % 8 === 0) {
        console.log(`[ImageGen] Poll #${pollCount} (${elapsed}s) — ${pendingJobIds.size} pending, ${successCount} done`)
      }

      // Update UI with elapsed time
      setImageGenDetails(prev => ({
        ...prev,
        current: successCount + failedSubmits.length + (jobs.length - pendingJobIds.size - successCount - failedSubmits.length),
        elapsed,
      }))
    }

    // Handle any jobs that timed out
    if (pendingJobIds.size > 0) {
      console.error(`[ImageGen] ❌ ${pendingJobIds.size} images timed out after ${Math.round((Date.now() - startTime) / 1000)}s`)
      for (const jobId of pendingJobIds) {
        const ticket = activeJobs.find(j => j.jobId === jobId)
        results.push({ error: 'Generation timed out', path: ticket?.path || '' })
      }
    }

    // All done
    const totalElapsed = Math.round((Date.now() - startTime) / 1000)
    if (successCount > 0) {
      setImageGenStatus('ready')
      setImageGenDetails(prev => ({ ...prev, count: jobs.length, results, elapsed: totalElapsed }))
      imageGenFadeRef.current = setTimeout(() => { setImageGenStatus(null); setImageGenDetails(null) }, 12000)
    } else {
      setImageGenStatus('failed')
      setImageGenDetails(prev => ({ ...prev, error: 'No se pudo generar — intenta con otro prompt' }))
      // Auto-dismiss the warning after 10 seconds
      imageGenFadeRef.current = setTimeout(() => { setImageGenStatus(null); setImageGenDetails(null) }, 10000)
    }
    console.log(`[ImageGen] 🏁 Complete: ${successCount}/${jobs.length} successful in ${totalElapsed}s`)
    if (activeSessionId) fetchCommands()
  }

  const handleConfirm = async (commandId: string) => {
    try {
      await fetch('/api/arms/claude-code/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId, decision: 'approve' }),
      })
      fetchCommands()
    } catch {}
  }
  const handleReject = async (commandId: string) => {
    try {
      await fetch('/api/arms/claude-code/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId, decision: 'reject' }),
      })
      fetchCommands()
    } catch {}
  }

  // Open a file or folder in the user's native explorer (via Bridge)
  const handleOpenPath = async (targetPath: string) => {
    if (!activeSessionId) return
    try {
      const r = await fetch('/api/arms/claude-code/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: activeSessionId, path: targetPath }),
      })
      if (r.ok) {
        // Refresh after a short delay so the new "open_path" command shows up
        setTimeout(() => fetchCommands(), 600)
      } else {
        const data = await r.json().catch(() => ({}))
        console.error('[OPEN_PATH] Error:', data.error || r.statusText)
      }
    } catch (e) {
      console.error('[OPEN_PATH] Fetch error:', e)
    }
  }

  // Select an HTML write_file command for preview in right pane
  const handlePreviewHtml = (cmdId: string) => {
    setPreviewCmdId(cmdId)
    setProjectPreview(false) // single-file preview
  }

  const newSession = () => {
    setActiveSessionId(null)
    setMessages([])
    setCommands([])
    setLastUserMessage('')
    setPreviewCmdId(null)
    setMemoryLoaded(false)
    setProjectPreview(false)
    setVisionData(null)
    setSelfReviewData(null)
    setSelfReviewStatus(null)
    setInput('')
    inputRef.current?.focus()
  }

  const deleteSession = async (sid: string) => {
    if (!confirm(t('ce.confirm_delete'))) return
    try {
      await fetch(`/api/arms/claude-code/chat?sessionId=${sid}`, { method: 'DELETE' })
      if (activeSessionId === sid) newSession()
      fetchSessions()
    } catch {}
  }

  // Auto-resize textarea
  const autoResize = useCallback(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    const maxH = 160 // ~6 lines
    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`
    el.style.overflowY = el.scrollHeight > maxH ? 'auto' : 'hidden'
  }, [])

  // biome-ignore lint: auto-resize on input change
  useEffect(() => { autoResize() }, [input, autoResize])

  // Auto-send when Fix button sets pendingFixRef + input
  useEffect(() => {
    if (pendingFixRef.current && input === pendingFixRef.current && !sending) {
      pendingFixRef.current = null
      const t = setTimeout(() => { sendMessage() }, 80)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, sending])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const retry = () => {
    if (lastUserMessage) {
      setInput(lastUserMessage)
      inputRef.current?.focus()
    }
  }

  const selectedModelMeta = CODE_MODELS.find((m) => m.id === selectedModel) || CODE_MODELS[0]

  // ─── Completion Summary: show a brief recap when all commands finish ───
  // NOTE: This useMemo MUST stay above the offline-bridge early return so that
  // the number of hooks is always the same regardless of branch taken.
  const completionSummary = useMemo(() => {
    const nonImage = commands.filter((c) => c.type !== 'save_image')
    if (nonImage.length === 0) return null
    const allDone = nonImage.every((c) =>
      ['completed', 'failed', 'rejected'].includes(c.status),
    )
    if (!allDone || sending) return null

    const completed = nonImage.filter((c) => c.status === 'completed')
    const failed = nonImage.filter((c) => c.status === 'failed')
    const filesWritten: string[] = []
    const foldersCreated: string[] = []
    const cmdsExecuted: string[] = []

    for (const c of completed) {
      const p = safeJsonParse(c.payload)
      if (c.type === 'write_file' && p.path) filesWritten.push(p.path as string)
      else if (c.type === 'create_dir' && p.path) foldersCreated.push(p.path as string)
      else if (c.type === 'execute_cmd' && p.command) cmdsExecuted.push((p.command as string).slice(0, 60))
      else if (c.type === 'open_path' && p.path) { /* skip open_path from summary */ }
    }

    if (filesWritten.length === 0 && foldersCreated.length === 0 && cmdsExecuted.length === 0 && failed.length === 0) return null

    return { filesWritten, foldersCreated, cmdsExecuted, completed: completed.length, failed: failed.length, total: nonImage.length }
  }, [commands, sending])

  // ============ OFFLINE BRIDGE STATE ============
  if (!statusLoading && !bridgeStatus?.online) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center p-8">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-sm border border-zinc-100 p-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">{t('ce.bridge_offline_title')}</h1>
          <p className="text-sm text-zinc-500 leading-relaxed mb-6">
            {t('ce.bridge_offline_desc')}
          </p>
          <div className="flex gap-2 justify-center">
            <Link href="/dashboard/hogar">
              <button className="px-5 py-2.5 rounded-full bg-zinc-900 text-white text-sm hover:bg-zinc-700 transition">
                {t('ce.install_bridge')}
              </button>
            </Link>
            <button
              onClick={fetchStatus}
              className="px-5 py-2.5 rounded-full border border-zinc-200 text-zinc-700 text-sm hover:bg-zinc-50 transition flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {t('ce.retry')}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============ MAIN ============
  // Activity feed: timeline of user questions + commands inferred from them
  const messagesNoSystem = messages.filter((m) => m.role !== 'system')
  const lastAssistant = [...messagesNoSystem].reverse().find((m) => m.role === 'assistant')
  // Don't show failure banner if commands were already staged and are executing/completed
  // This handles the case where LLM stream terminates after successfully emitting actions
  const failedAssistant = (() => {
    if (lastAssistant?.status !== 'failed') return null
    // If there are commands associated with this message that are progressing, suppress the error
    const msgCmds = commands.filter(c => c.messageId === lastAssistant.id)
    const hasProgressingCmds = msgCmds.some(c =>
      c.status === 'approved' || c.status === 'executing' || c.status === 'completed' || c.status === 'generating'
    )
    if (hasProgressingCmds) return null // Actions succeeded — LLM termination was just a stream hiccup
    return lastAssistant
  })()
  const streamingAssistant = messagesNoSystem.find((m) => m.role === 'assistant' && m.status === 'streaming')
  const streamingText = streamingAssistant?.content ? stripActionAndCodeFences(streamingAssistant.content) : ''

  // ─── Project Summary: detect multi-file creations rooted in the same folder ───
  // If user just created 2+ files under the same top-level folder, show a card
  // with the file tree and an "Abrir proyecto" CTA.
  const projectSummary = (() => {
    const completedWrites = commands.filter(
      (c) => c.status === 'completed' && c.type === 'write_file',
    )
    if (completedWrites.length < 2) return null
    const items: { path: string; root: string }[] = []
    for (const c of completedWrites) {
      try {
        const p = safeJsonParse(c.payload).path as string
        if (!p) continue
        const parts = p.replace(/\\/g, '/').split('/').filter(Boolean)
        if (parts.length < 2) continue
        items.push({ path: p, root: parts[0] })
      } catch {}
    }
    if (items.length < 2) return null
    // group by root
    const groups: Record<string, string[]> = {}
    for (const it of items) {
      if (!groups[it.root]) groups[it.root] = []
      groups[it.root].push(it.path)
    }
    // find largest group
    const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
    const [root, files] = sorted[0]
    if (files.length < 2) return null
    const hasHtml = files.some((f) => /\.html?$/i.test(f))
    const htmlFile = files.find((f) => /index\.html?$/i.test(f)) || files.find((f) => /\.html?$/i.test(f))
    return { root, files, hasHtml, htmlFile }
  })()

  // ─── Code Engine is now public (ALFA badge visible in sidebar) ────

  return (
    <div className="h-[calc(100vh-5rem)] flex items-stretch justify-center px-4 py-4">
      <div ref={mainContainerRef} className="w-full max-w-[1200px] flex bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">

        {/* ===== LEFT NAV RAIL ===== */}
        <div className="w-[60px] flex-shrink-0 bg-white border-r border-zinc-100 flex flex-col items-center py-5 gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-sm">
            <span className="text-sm font-semibold">○</span>
          </div>
          <button
            onClick={() => setShowSessions((v) => !v)}
            title={t('ce.sessions')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
              showSessions ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700'
            }`}
          >
            <Folder className="w-4 h-4" />
          </button>
          <button
            onClick={newSession}
            title={t('ce.new_session')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition"
          >
            <Plus className="w-4 h-4" />
          </button>
          <div className="flex-1" />
          {/* GitHub connection button — prominent */}
          <button
            onClick={() => { setShowGitHub((v) => !v); if (showDevTools) setShowDevTools(false) }}
            title={locale === 'es' ? 'GitHub: Push, Pull & AI Review' : 'GitHub: Push, Pull & AI Review'}
            className={`relative w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition ${
              showGitHub
                ? 'bg-zinc-900 text-white shadow-sm'
                : armStatus.github?.connected
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
                  : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            <Github className="w-4 h-4" />
            <span className="text-[7px] font-bold leading-none">GIT</span>
            {armStatus.github?.connected && !showGitHub && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-white" />
            )}
          </button>
          {/* Dev Tools button */}
          <button
            onClick={() => { setShowDevTools(v => !v); if (showGitHub) setShowGitHub(false) }}
            title={t('ce.devtools_title')}
            className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center gap-0.5 transition ${
              showDevTools
                ? 'bg-zinc-900 text-white shadow-sm'
                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
            }`}
          >
            <Wrench className="w-4 h-4" />
            <span className="text-[7px] font-bold leading-none">DEV</span>
          </button>
          <button
            onClick={() => setShowModelSelect((v) => !v)}
            title={t('ce.model')}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700 transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* ===== SESSIONS DRAWER ===== */}
        <AnimatePresence initial={false}>
          {showSessions && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 240, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 border-r border-zinc-100 overflow-hidden"
            >
              <div className="w-[240px] h-full p-3 flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{t('ce.sessions')}</span>
                  <button
                    onClick={newSession}
                    className="text-zinc-400 hover:text-zinc-700"
                    title={t('ce.new')}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-0.5">
                  {sessions.length === 0 && (
                    <div className="text-xs text-zinc-400 text-center py-6">{t('ce.no_sessions')}</div>
                  )}
                  {sessions.map((s) => {
                    // Check if session has published URLs + version + time
                    let hasPublished = false
                    let publishVersion = 0
                    let publishTimeAgo = ''
                    try {
                      const stored = typeof window !== 'undefined' ? localStorage.getItem(`ce_deployed_urls_${s.id}`) : null
                      if (stored) {
                        const urls = JSON.parse(stored)
                        hasPublished = !!(urls.octopus || urls.pages)
                        publishVersion = urls.version || 0
                        if (urls.updatedAt) {
                          const diff = Date.now() - new Date(urls.updatedAt).getTime()
                          const mins = Math.floor(diff / 60000)
                          if (mins < 1) publishTimeAgo = '<1m'
                          else if (mins < 60) publishTimeAgo = `${mins}m`
                          else if (mins < 1440) publishTimeAgo = `${Math.floor(mins / 60)}h`
                          else publishTimeAgo = `${Math.floor(mins / 1440)}d`
                        }
                      }
                    } catch { /* ignore */ }
                    return (
                    <div
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className={`group flex items-center gap-2 px-2 py-2 rounded-lg cursor-pointer text-sm transition ${
                        activeSessionId === s.id ? 'bg-zinc-100 text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50'
                      }`}
                    >
                      {hasPublished && (
                        <span className="w-4 h-4 flex-shrink-0 rounded-full bg-emerald-50 flex items-center justify-center" title={t('ce.published_badge')}>
                          <span className="text-[8px]">🐙</span>
                        </span>
                      )}
                      <span className="flex-1 truncate">{s.title}</span>
                      {hasPublished && (
                        <span className="flex items-center gap-1 flex-shrink-0">
                          {publishVersion > 0 && (
                            <span className="text-[7px] font-bold tracking-wider px-1 py-0.5 rounded bg-zinc-100 text-zinc-500 leading-none">v{publishVersion}</span>
                          )}
                          <span className="text-[7px] font-bold tracking-wider px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 leading-none opacity-80">LIVE</span>
                          {publishTimeAgo && (
                            <span className="text-[7px] text-zinc-400 leading-none">{publishTimeAgo}</span>
                          )}
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteSession(s.id)
                        }}
                        className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-500 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                    )
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== GITHUB PANEL (Tabbed: Push / Pull / Review) ===== */}
        <AnimatePresence initial={false}>
          {showGitHub && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 border-r border-zinc-100 overflow-hidden"
            >
              <div className="w-[300px] h-full flex flex-col">
                {/* Header */}
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Github className="w-4 h-4 text-zinc-700" />
                    <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">GitHub</span>
                    {armStatus.github?.connected && armStatus.github.detail && (
                      <span className="text-[10px] text-emerald-600 font-medium">@{armStatus.github.detail}</span>
                    )}
                  </div>
                  <button onClick={() => setShowGitHub(false)} className="text-zinc-400 hover:text-zinc-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {armStatus.github?.connected ? (
                  <>
                    {/* Tab bar */}
                    <div className="px-4 flex gap-1 mb-3">
                      {(['push', 'pull', 'review', 'branches', 'commits'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => {
                            setGithubTab(tab)
                            // Auto-load repos when switching to pull, branches or commits tab
                            if ((tab === 'pull' || tab === 'branches' || tab === 'commits') && githubRepos.length === 0 && !githubReposLoading) {
                              setGithubReposLoading(true)
                              fetch('/api/arms/claude-code/github-pull')
                                .then(r => r.json())
                                .then(d => { if (d.repos) setGithubRepos(d.repos) })
                                .catch(() => {})
                                .finally(() => setGithubReposLoading(false))
                            }
                          }}
                          className={`flex-1 flex items-center justify-center gap-0.5 px-1 py-2 rounded-lg text-[9px] font-semibold transition ${
                            githubTab === tab
                              ? 'bg-zinc-900 text-white'
                              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                          }`}
                        >
                          {tab === 'push' && <ArrowUpRight className="w-3 h-3" />}
                          {tab === 'pull' && <GitPullRequest className="w-3 h-3" />}
                          {tab === 'review' && <ScanSearch className="w-3 h-3" />}
                          {tab === 'branches' && <GitBranch className="w-3 h-3" />}
                          {tab === 'commits' && <History className="w-3 h-3" />}
                          {t(`ce.github_tab_${tab}`)}
                        </button>
                      ))}
                    </div>

                    {/* Tab content */}
                    <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">

                      {/* ── PUSH TAB ── */}
                      {githubTab === 'push' && (
                        <>
                          {/* Connected status chip */}
                          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
                            <span className="w-2 h-2 rounded-full bg-emerald-400" />
                            <span className="text-[11px] font-semibold text-emerald-800">{locale === 'es' ? 'Conectado' : 'Connected'}</span>
                          </div>

                          {/* Push button */}
                          {activeSessionId && commands.length > 0 && (
                            <button
                              disabled={githubPushBusy}
                              onClick={async () => {
                                setGithubPushBusy(true)
                                setGithubPushResult(null)
                                try {
                                  const res = await fetch('/api/arms/claude-code/github-push', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ sessionId: activeSessionId }),
                                  })
                                  const data = await res.json()
                                  if (data.success || data.url) {
                                    setGithubPushResult({ ok: true, message: data.repoUrl || data.url || (locale === 'es' ? 'Push exitoso' : 'Push successful') })
                                  } else {
                                    setGithubPushResult({ ok: false, message: data.error || 'Error' })
                                  }
                                } catch {
                                  setGithubPushResult({ ok: false, message: locale === 'es' ? 'Error de conexión' : 'Connection error' })
                                }
                                setGithubPushBusy(false)
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition disabled:opacity-50"
                            >
                              {githubPushBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                              {locale === 'es' ? 'Push a GitHub' : 'Push to GitHub'}
                            </button>
                          )}

                          {/* Push result */}
                          {githubPushResult && (
                            <div className={`px-3 py-2.5 rounded-xl text-[11px] font-medium ${
                              githubPushResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {githubPushResult.ok && githubPushResult.message.startsWith('http') ? (
                                <a href={githubPushResult.message} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 underline">
                                  <CheckCircle2 className="w-3 h-3" /> {locale === 'es' ? 'Ver en GitHub' : 'View on GitHub'} <ArrowUpRight className="w-3 h-3" />
                                </a>
                              ) : <span>{githubPushResult.message}</span>}
                            </div>
                          )}

                          {/* No session hint */}
                          {(!activeSessionId || commands.length === 0) && (
                            <div className="px-3 py-3 rounded-xl bg-zinc-50 border border-zinc-200">
                              <p className="text-[11px] text-zinc-500">
                                {locale === 'es' ? 'Genera código primero para hacer push' : 'Generate code first to push'}
                              </p>
                            </div>
                          )}

                          {/* Tip */}
                          <div className="px-3 py-3 rounded-xl bg-violet-50/50 border border-violet-100">
                            <p className="text-[10px] text-violet-600 font-medium mb-1">💡 Tip</p>
                            <p className="text-[10px] text-violet-500 leading-relaxed">
                              {locale === 'es'
                                ? 'Tu código se almacena en tu repo. Deploy a Vercel, Railway o Netlify desde ahí.'
                                : 'Your code is stored in your repo. Deploy to Vercel, Railway or Netlify from there.'}
                            </p>
                          </div>
                        </>
                      )}

                      {/* ── PULL TAB ── */}
                      {githubTab === 'pull' && (
                        <>
                          <p className="text-[11px] text-zinc-500">{t('ce.github_pull_desc')}</p>

                          {githubReposLoading ? (
                            <div className="flex items-center gap-2 py-6 justify-center text-zinc-400">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-[11px]">{t('ce.github_repos_loading')}</span>
                            </div>
                          ) : githubRepos.length === 0 ? (
                            <div className="text-center py-6">
                              <p className="text-[11px] text-zinc-400">{t('ce.github_repos_empty')}</p>
                            </div>
                          ) : (
                            <div className="space-y-1.5 max-h-[320px] overflow-y-auto">
                              {githubRepos.map((repo) => (
                                <button
                                  key={repo.name}
                                  disabled={githubPullBusy}
                                  onClick={async () => {
                                    setGithubPullBusy(true)
                                    setGithubPullResult(null)
                                    try {
                                      const res = await fetch('/api/arms/claude-code/github-pull', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          repoName: repo.name,
                                          branch: repo.default_branch,
                                          sessionId: activeSessionId || undefined,
                                        }),
                                      })
                                      const data = await res.json()
                                      if (data.success) {
                                        setGithubPullResult({ ok: true, message: `${data.filesCount} ${t('ce.github_pull_done')}` })
                                      } else {
                                        setGithubPullResult({ ok: false, message: data.error || 'Error' })
                                      }
                                    } catch {
                                      setGithubPullResult({ ok: false, message: 'Error' })
                                    }
                                    setGithubPullBusy(false)
                                  }}
                                  className="w-full flex items-start gap-2.5 px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 hover:bg-zinc-100 transition text-left disabled:opacity-50"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-semibold text-zinc-800 truncate">{repo.name}</p>
                                    {repo.description && <p className="text-[10px] text-zinc-400 truncate mt-0.5">{repo.description}</p>}
                                    <div className="flex items-center gap-2 mt-1">
                                      {repo.language && (
                                        <span className="flex items-center gap-1 text-[9px] text-zinc-400">
                                          <CircleDot className="w-2.5 h-2.5" />{repo.language}
                                        </span>
                                      )}
                                      <span className="text-[9px] text-zinc-300">{new Date(repo.updated_at).toLocaleDateString()}</span>
                                    </div>
                                  </div>
                                  <GitPullRequest className="w-3.5 h-3.5 text-zinc-300 mt-1 flex-shrink-0" />
                                </button>
                              ))}
                            </div>
                          )}

                          {/* Pull result */}
                          {githubPullResult && (
                            <div className={`px-3 py-2.5 rounded-xl text-[11px] font-medium ${
                              githubPullResult.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                              {githubPullResult.ok ? (
                                <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> {githubPullResult.message}</span>
                              ) : <span>{githubPullResult.message}</span>}
                            </div>
                          )}
                        </>
                      )}

                      {/* ── REVIEW TAB ── */}
                      {githubTab === 'review' && (
                        <>
                          <p className="text-[11px] text-zinc-500">{t('ce.github_review_desc')}</p>

                          {/* Run review button */}
                          {activeSessionId && commands.length > 0 && (
                            <button
                              disabled={githubReviewBusy}
                              onClick={async () => {
                                setGithubReviewBusy(true)
                                setGithubReview(null)
                                try {
                                  const res = await fetch('/api/arms/claude-code/code-review', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ sessionId: activeSessionId }),
                                  })
                                  const data = await res.json()
                                  if (data.success && data.review) {
                                    setGithubReview(data.review)
                                  } else {
                                    setGithubReview({ score: 0, summary: data.error || 'Error', issues: [], highlights: [], suggestion: '' })
                                  }
                                } catch {
                                  setGithubReview({ score: 0, summary: 'Error de conexión', issues: [], highlights: [], suggestion: '' })
                                }
                                setGithubReviewBusy(false)
                              }}
                              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold hover:from-violet-700 hover:to-purple-700 transition disabled:opacity-50"
                            >
                              {githubReviewBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                              {githubReviewBusy ? t('ce.github_reviewing') : t('ce.github_review')}
                            </button>
                          )}

                          {/* No session hint */}
                          {(!activeSessionId || commands.length === 0) && (
                            <div className="px-3 py-3 rounded-xl bg-zinc-50 border border-zinc-200">
                              <p className="text-[11px] text-zinc-500">
                                {locale === 'es' ? 'Genera código primero para revisar' : 'Generate code first to review'}
                              </p>
                            </div>
                          )}

                          {/* Review results */}
                          {githubReview && (
                            <div className="space-y-2.5">
                              {/* Score badge */}
                              <div className={`flex items-center justify-between px-3 py-3 rounded-xl border ${
                                githubReview.score >= 80 ? 'bg-emerald-50 border-emerald-200' :
                                githubReview.score >= 60 ? 'bg-amber-50 border-amber-200' :
                                'bg-red-50 border-red-200'
                              }`}>
                                <span className="text-[11px] font-semibold text-zinc-700">{t('ce.github_review_score')}</span>
                                <span className={`text-lg font-bold ${
                                  githubReview.score >= 80 ? 'text-emerald-600' :
                                  githubReview.score >= 60 ? 'text-amber-600' : 'text-red-600'
                                }`}>{githubReview.score}/100</span>
                              </div>

                              {/* Summary */}
                              <p className="text-[11px] text-zinc-600 leading-relaxed px-1">{githubReview.summary}</p>

                              {/* Issues */}
                              {githubReview.issues.length > 0 && (
                                <div className="space-y-1.5">
                                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{t('ce.github_review_issues')}</p>
                                  {githubReview.issues.map((issue, i) => (
                                    <div key={i} className={`px-2.5 py-2 rounded-lg text-[10px] leading-relaxed ${
                                      issue.severity === 'critical' ? 'bg-red-50 border border-red-200 text-red-700' :
                                      issue.severity === 'warning' ? 'bg-amber-50 border border-amber-200 text-amber-700' :
                                      'bg-blue-50 border border-blue-200 text-blue-700'
                                    }`}>
                                      <span className="font-semibold">{issue.severity === 'critical' ? '🚨' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'} {issue.file}</span>
                                      {issue.line && <span className="text-zinc-400 ml-1">:{issue.line}</span>}
                                      <p className="mt-0.5">{issue.message}</p>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Highlights */}
                              {githubReview.highlights.length > 0 && (
                                <div className="space-y-1">
                                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">{t('ce.github_review_highlights')}</p>
                                  {githubReview.highlights.map((h, i) => (
                                    <p key={i} className="text-[10px] text-emerald-600 leading-relaxed">✅ {h}</p>
                                  ))}
                                </div>
                              )}

                              {/* Top suggestion */}
                              {githubReview.suggestion && (
                                <div className="px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-200">
                                  <p className="text-[10px] font-semibold text-violet-600 mb-0.5">💡 {t('ce.github_review_suggestion')}</p>
                                  <p className="text-[10px] text-violet-600 leading-relaxed">{githubReview.suggestion}</p>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {/* ── BRANCHES TAB ── */}
                      {githubTab === 'branches' && (
                        <>
                          <p className="text-[11px] text-zinc-500">{t('ce.github_branches_desc')}</p>

                          {/* Repo selector */}
                          {githubReposLoading ? (
                            <div className="flex items-center gap-2 py-6 justify-center text-zinc-400">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-[11px]">{t('ce.github_branches_loading')}</span>
                            </div>
                          ) : githubRepos.length === 0 ? (
                            <div className="text-center py-6">
                              <p className="text-[11px] text-zinc-400">{t('ce.github_repos_empty')}</p>
                            </div>
                          ) : (
                            <>
                              {/* Repo dropdown */}
                              <select
                                value={branchSelectedRepo || ''}
                                onChange={(e) => {
                                  const repo = e.target.value
                                  setBranchSelectedRepo(repo || null)
                                  setBranchList([])
                                  setBranchMsg(null)
                                  if (repo) {
                                    setBranchLoading(true)
                                    fetch(`/api/arms/claude-code/github-branches?repo=${repo}`)
                                      .then(r => r.json())
                                      .then(d => {
                                        if (d.branches) {
                                          setBranchList(d.branches)
                                          setBranchDefaultBranch(d.defaultBranch || 'main')
                                          setBranchCreateFrom(d.defaultBranch || 'main')
                                        }
                                      })
                                      .catch(() => {})
                                      .finally(() => setBranchLoading(false))
                                  }
                                }}
                                className="w-full px-3 py-2 rounded-xl border border-zinc-200 bg-white text-[11px] text-zinc-700 focus:outline-none focus:border-zinc-400"
                              >
                                <option value="">{t('ce.github_branches_select_repo')}</option>
                                {githubRepos.map(r => (
                                  <option key={r.name} value={r.name}>{r.name}</option>
                                ))}
                              </select>

                              {/* Branch list */}
                              {branchLoading ? (
                                <div className="flex items-center gap-2 py-4 justify-center text-zinc-400">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span className="text-[11px]">{t('ce.github_branches_loading')}</span>
                                </div>
                              ) : branchSelectedRepo && branchList.length > 0 && (
                                <>
                                  {/* Branch cards */}
                                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                                    {branchList.map((b) => (
                                      <div key={b.name} className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px] ${
                                        b.isDefault ? 'bg-emerald-50 border-emerald-200' : 'bg-zinc-50 border-zinc-200'
                                      }`}>
                                        <GitBranch className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                        <span className="font-semibold text-zinc-700 truncate flex-1">{b.name}</span>
                                        {b.isDefault && (
                                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">{t('ce.github_branches_default')}</span>
                                        )}
                                        {b.protected && (
                                          <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{t('ce.github_branches_protected')}</span>
                                        )}
                                        {/* Merge into default */}
                                        {!b.isDefault && (
                                          <button
                                            disabled={!!branchMergeBusy}
                                            onClick={async () => {
                                              setBranchMergeBusy(b.name)
                                              setBranchMsg(null)
                                              try {
                                                const res = await fetch('/api/arms/claude-code/github-branches', {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ repo: branchSelectedRepo, action: 'merge', head: b.name, base: branchDefaultBranch }),
                                                })
                                                const data = await res.json()
                                                if (data.success) {
                                                  setBranchMsg({ ok: true, text: t('ce.github_branches_merged') })
                                                } else {
                                                  setBranchMsg({ ok: false, text: data.error || 'Error' })
                                                }
                                              } catch {
                                                setBranchMsg({ ok: false, text: 'Error' })
                                              }
                                              setBranchMergeBusy(null)
                                            }}
                                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 text-[9px] font-bold transition disabled:opacity-50"
                                            title={`Merge ${b.name} → ${branchDefaultBranch}`}
                                          >
                                            {branchMergeBusy === b.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                                          </button>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  {/* Create branch */}
                                  <div className="px-3 py-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-2">
                                    <p className="text-[10px] font-semibold text-zinc-600">{t('ce.github_branches_create')}</p>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder={t('ce.github_branches_create_placeholder')}
                                        value={branchCreateName}
                                        onChange={(e) => setBranchCreateName(e.target.value)}
                                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white text-[11px] text-zinc-700 focus:outline-none focus:border-zinc-400"
                                      />
                                      <button
                                        disabled={!branchCreateName.trim() || branchCreateBusy}
                                        onClick={async () => {
                                          setBranchCreateBusy(true)
                                          setBranchMsg(null)
                                          try {
                                            const res = await fetch('/api/arms/claude-code/github-branches', {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ repo: branchSelectedRepo, action: 'create', branch: branchCreateName.trim(), fromBranch: branchCreateFrom }),
                                            })
                                            const data = await res.json()
                                            if (data.success) {
                                              setBranchMsg({ ok: true, text: t('ce.github_branches_created') })
                                              setBranchCreateName('')
                                              // Refresh branch list
                                              fetch(`/api/arms/claude-code/github-branches?repo=${branchSelectedRepo}`)
                                                .then(r => r.json())
                                                .then(d => { if (d.branches) setBranchList(d.branches) })
                                                .catch(() => {})
                                            } else {
                                              setBranchMsg({ ok: false, text: data.error || 'Error' })
                                            }
                                          } catch {
                                            setBranchMsg({ ok: false, text: 'Error' })
                                          }
                                          setBranchCreateBusy(false)
                                        }}
                                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-[10px] font-semibold hover:bg-zinc-800 transition disabled:opacity-50"
                                      >
                                        {branchCreateBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[9px] text-zinc-400">{t('ce.github_branches_create_from')}</span>
                                      <select
                                        value={branchCreateFrom}
                                        onChange={(e) => setBranchCreateFrom(e.target.value)}
                                        className="px-2 py-0.5 rounded-md border border-zinc-200 bg-white text-[10px] text-zinc-600"
                                      >
                                        {branchList.map(b => (
                                          <option key={b.name} value={b.name}>{b.name}</option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  {/* Status message */}
                                  {branchMsg && (
                                    <div className={`px-3 py-2 rounded-xl text-[11px] font-medium ${
                                      branchMsg.ok ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                                    }`}>
                                      {branchMsg.text}
                                    </div>
                                  )}
                                </>
                              )}
                            </>
                          )}
                        </>
                      )}

                      {/* ── COMMITS TAB ── */}
                      {githubTab === 'commits' && (
                        <>
                          {/* Repo selector */}
                          {githubReposLoading ? (
                            <div className="flex items-center justify-center py-6">
                              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                            </div>
                          ) : (
                            <>
                              <div className="space-y-2">
                                <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">{locale === 'es' ? 'Repositorio' : 'Repository'}</label>
                                <select
                                  value={commitsRepo || ''}
                                  onChange={(e) => {
                                    const repo = e.target.value
                                    setCommitsRepo(repo)
                                    const repoObj = githubRepos.find(r => r.full_name === repo)
                                    const branch = repoObj?.default_branch || 'main'
                                    setCommitsBranch(branch)
                                    if (repo) {
                                      setCommitsLoading(true)
                                      setCommitsList([])
                                      fetch(`/api/arms/claude-code/github-commits?repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`)
                                        .then(r => r.json())
                                        .then(d => { if (d.commits) setCommitsList(d.commits) })
                                        .catch(() => {})
                                        .finally(() => setCommitsLoading(false))
                                    }
                                  }}
                                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-300"
                                >
                                  <option value="">{locale === 'es' ? 'Seleccionar repo...' : 'Select repo...'}</option>
                                  {githubRepos.map(r => (
                                    <option key={r.full_name} value={r.full_name}>{r.full_name}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Branch selector */}
                              {commitsRepo && (
                                <div className="space-y-1">
                                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide">Branch</label>
                                  <input
                                    value={commitsBranch}
                                    onChange={(e) => setCommitsBranch(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter' && commitsRepo) {
                                        setCommitsLoading(true)
                                        setCommitsList([])
                                        fetch(`/api/arms/claude-code/github-commits?repo=${encodeURIComponent(commitsRepo)}&branch=${encodeURIComponent(commitsBranch)}`)
                                          .then(r => r.json())
                                          .then(d => { if (d.commits) setCommitsList(d.commits) })
                                          .catch(() => {})
                                          .finally(() => setCommitsLoading(false))
                                      }
                                    }}
                                    placeholder="main"
                                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-300"
                                  />
                                </div>
                              )}

                              {/* Loading */}
                              {commitsLoading && (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                  <span className="ml-2 text-xs text-zinc-400">{t('ce.github_commits_loading')}</span>
                                </div>
                              )}

                              {/* Commit list */}
                              {!commitsLoading && commitsList.length > 0 && (
                                <div className="space-y-2">
                                  {commitsList.map((c) => (
                                    <a
                                      key={c.sha}
                                      href={c.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="block px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-300 transition group"
                                    >
                                      <div className="flex items-start gap-2">
                                        <code className="text-[10px] font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded flex-shrink-0">{c.sha.slice(0, 7)}</code>
                                        <p className="text-[11px] text-zinc-700 font-medium leading-snug line-clamp-2 group-hover:text-zinc-900">{c.message}</p>
                                      </div>
                                      <div className="flex items-center gap-3 mt-1.5">
                                        <span className="text-[10px] text-zinc-400">{t('ce.github_commits_by')} {c.author}</span>
                                        <span className="text-[10px] text-zinc-300">{new Date(c.date).toLocaleDateString()}</span>
                                      </div>
                                    </a>
                                  ))}
                                </div>
                              )}

                              {/* Empty */}
                              {!commitsLoading && commitsList.length === 0 && commitsRepo && (
                                <div className="text-center py-8">
                                  <History className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
                                  <p className="text-[11px] text-zinc-400">{t('ce.github_commits_empty')}</p>
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  /* Disconnected state */
                  <div className="px-4 pb-4 space-y-3">
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-50 border border-amber-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                      <p className="text-[11px] font-medium text-amber-800">
                        {locale === 'es' ? 'No conectado' : 'Not connected'}
                      </p>
                    </div>
                    <div className="px-3 py-4 rounded-xl bg-zinc-50 border border-zinc-200 text-center">
                      <Github className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                      <p className="text-[11px] text-zinc-600 mb-3">
                        {locale === 'es' ? 'Conecta GitHub para push, pull y code review' : 'Connect GitHub for push, pull and code review'}
                      </p>
                      <a href="/dashboard/brazos" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 transition">
                        <Plug className="w-3.5 h-3.5" />
                        {locale === 'es' ? 'Conectar en Brazos' : 'Connect in Arms'}
                      </a>
                    </div>
                    <div className="px-3 py-3 rounded-xl bg-zinc-50 border border-zinc-100">
                      <p className="text-[10px] text-zinc-500 font-medium mb-1.5">{locale === 'es' ? '¿Por qué conectar?' : 'Why connect?'}</p>
                      <ul className="space-y-1">
                        {(locale === 'es'
                          ? ['✅ Push & Pull repos', '✅ AI Code Review', '✅ Deploy a Vercel en 1 click', '✅ Control de versiones']
                          : ['✅ Push & Pull repos', '✅ AI Code Review', '✅ Deploy to Vercel in 1 click', '✅ Version control']
                        ).map((item, i) => (
                          <li key={i} className="text-[10px] text-zinc-500">{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== DEV TOOLS DRAWER ===== */}
        <AnimatePresence initial={false}>
          {showDevTools && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 300, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="flex-shrink-0 border-r border-zinc-100 overflow-hidden flex flex-col bg-white"
            >
              <div className="w-[300px] flex flex-col h-full">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5" />
                      {t('ce.devtools_title')}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">{t('ce.devtools_subtitle')}</p>
                  </div>
                  <button onClick={() => setShowDevTools(false)} className="text-zinc-400 hover:text-zinc-700">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Tab bar */}
                <div className="px-4 flex gap-1 mb-3">
                  {(['packages', 'commands', 'files'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => {
                        setDevToolsTab(tab)
                        if (tab === 'files' && !workspaceData && !workspaceLoading) {
                          setWorkspaceLoading(true)
                          fetch(`/api/arms/claude-code/workspace?sessionId=${activeSessionId}`)
                            .then(r => r.json())
                            .then(d => { if (!d.error) setWorkspaceData(d) })
                            .catch(() => {})
                            .finally(() => setWorkspaceLoading(false))
                        }
                      }}
                      className={`flex-1 flex items-center justify-center gap-1 px-2 py-2 rounded-lg text-[10px] font-semibold transition ${
                        devToolsTab === tab
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                      }`}
                    >
                      {tab === 'packages' && <Package className="w-3 h-3" />}
                      {tab === 'commands' && <Terminal className="w-3 h-3" />}
                      {tab === 'files' && <FolderTree className="w-3 h-3" />}
                      {t(`ce.devtools_tab_${tab}`)}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3">

                  {/* ── PACKAGES TAB ── */}
                  {devToolsTab === 'packages' && (
                    <>
                      {/* Search input */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                        <input
                          value={npmSearch}
                          onChange={(e) => setNpmSearch(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && npmSearch.trim()) {
                              setNpmSearching(true)
                              setNpmResults([])
                              try {
                                const res = await fetch(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(npmSearch.trim())}&size=10`)
                                const data = await res.json()
                                setNpmResults((data.objects || []).map((o: { package: { name: string; version: string; description: string }; score: { detail: { popularity: number } } }) => ({
                                  name: o.package.name,
                                  version: o.package.version,
                                  description: o.package.description || '',
                                  downloads: Math.round((o.score?.detail?.popularity || 0) * 100),
                                })))
                              } catch { setNpmResults([]) }
                              setNpmSearching(false)
                            }
                          }}
                          placeholder={t('ce.devtools_pkg_search')}
                          className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-2 focus:ring-zinc-300"
                        />
                      </div>

                      {npmSearching && (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                          <span className="ml-2 text-xs text-zinc-400">{t('ce.devtools_pkg_searching')}</span>
                        </div>
                      )}

                      {!npmSearching && npmResults.length > 0 && (
                        <div className="space-y-2">
                          {npmResults.map((pkg) => (
                            <div key={pkg.name} className="px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-300 transition">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold text-zinc-800 truncate">{pkg.name}</p>
                                  <p className="text-[10px] text-zinc-400 line-clamp-2 mt-0.5">{pkg.description}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-[9px] font-mono text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded">v{pkg.version}</span>
                                    <span className="text-[9px] text-zinc-400">{t('ce.devtools_pkg_weekly')}: {pkg.downloads}%</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => {
                                    setInput(`yarn add ${pkg.name}`)
                                    setTimeout(() => {
                                      const btn = document.querySelector('[data-send-btn]') as HTMLButtonElement
                                      if (btn) btn.click()
                                    }, 100)
                                    setShowDevTools(false)
                                  }}
                                  className="flex-shrink-0 px-2.5 py-1.5 rounded-lg bg-zinc-900 text-white text-[10px] font-semibold hover:bg-zinc-800 transition"
                                >
                                  {t('ce.devtools_pkg_install')}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!npmSearching && npmResults.length === 0 && npmSearch.trim() && (
                        <div className="text-center py-8">
                          <Package className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
                          <p className="text-[11px] text-zinc-400">{t('ce.devtools_pkg_no_results')}</p>
                        </div>
                      )}
                    </>
                  )}

                  {/* ── COMMANDS TAB ── */}
                  {devToolsTab === 'commands' && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-zinc-400 font-medium">{t('ce.devtools_cmd_title')}</p>
                      {[
                        { key: 'audit', icon: <Shield className="w-4 h-4" />, cmd: locale === 'es' ? 'Ejecuta una auditoría de seguridad de dependencias (npm audit)' : 'Run a dependency security audit (npm audit)' },
                        { key: 'env', icon: <Settings className="w-4 h-4" />, cmd: locale === 'es' ? 'Muestra las variables de entorno del proyecto (.env)' : 'Show project environment variables (.env)' },
                        { key: 'db', icon: <Server className="w-4 h-4" />, cmd: locale === 'es' ? 'Visualiza el esquema de la base de datos y sus relaciones' : 'Visualize the database schema and relationships' },
                        { key: 'tree', icon: <FolderTree className="w-4 h-4" />, cmd: locale === 'es' ? 'Muestra el árbol de archivos del workspace' : 'Show the workspace file tree' },
                        { key: 'outdated', icon: <RefreshCw className="w-4 h-4" />, cmd: locale === 'es' ? 'Revisa dependencias desactualizadas (npm outdated)' : 'Check outdated dependencies (npm outdated)' },
                        { key: 'tsc', icon: <AlertTriangle className="w-4 h-4" />, cmd: locale === 'es' ? 'Ejecuta el type checker de TypeScript (tsc --noEmit)' : 'Run TypeScript type checker (tsc --noEmit)' },
                      ].map((item) => (
                        <button
                          key={item.key}
                          onClick={() => {
                            setInput(item.cmd)
                            setTimeout(() => {
                              const btn = document.querySelector('[data-send-btn]') as HTMLButtonElement
                              if (btn) btn.click()
                            }, 100)
                            setShowDevTools(false)
                          }}
                          className="w-full flex items-start gap-3 px-3 py-3 rounded-xl bg-zinc-50 border border-zinc-100 hover:border-zinc-300 hover:bg-zinc-100 transition text-left group"
                        >
                          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-500 group-hover:text-zinc-700 group-hover:border-zinc-300">
                            {item.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-bold text-zinc-700 group-hover:text-zinc-900">{t(`ce.devtools_cmd_${item.key}`)}</p>
                            <p className="text-[10px] text-zinc-400 mt-0.5">{t(`ce.devtools_cmd_${item.key}_desc`)}</p>
                          </div>
                          <ChevronRight className="w-3.5 h-3.5 text-zinc-300 group-hover:text-zinc-500 flex-shrink-0 mt-1" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* ── FILES TAB ── */}
                  {devToolsTab === 'files' && (
                    <>
                      {workspaceLoading ? (
                        <div className="flex items-center justify-center py-6">
                          <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                        </div>
                      ) : workspaceData ? (
                        <>
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-semibold text-zinc-500">
                              {t('ce.devtools_files_count')}: {workspaceData.fileCount}
                            </p>
                            <button
                              onClick={() => {
                                setWorkspaceLoading(true)
                                fetch(`/api/arms/claude-code/workspace?sessionId=${activeSessionId}`)
                                  .then(r => r.json())
                                  .then(d => { if (!d.error) setWorkspaceData(d) })
                                  .catch(() => {})
                                  .finally(() => setWorkspaceLoading(false))
                              }}
                              className="text-[10px] text-zinc-400 hover:text-zinc-700 flex items-center gap-1"
                            >
                              <RefreshCw className="w-3 h-3" />
                              {t('ce.devtools_files_scan')}
                            </button>
                          </div>
                          <div className="space-y-1">
                            {workspaceData.fileTree.map((f, i) => (
                              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-zinc-50 transition">
                                {f.type === 'directory'
                                  ? <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                  : <FileText className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                                }
                                <span className="text-[11px] text-zinc-700 truncate font-mono">{f.path}</span>
                                {f.size > 0 && (
                                  <span className="text-[9px] text-zinc-300 ml-auto flex-shrink-0">
                                    {f.size > 1024 ? `${(f.size / 1024).toFixed(1)}KB` : `${f.size}B`}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-8">
                          <FolderTree className="w-6 h-6 text-zinc-300 mx-auto mb-2" />
                          <p className="text-[11px] text-zinc-400">{t('ce.devtools_files_empty')}</p>
                          <button
                            onClick={() => {
                              setWorkspaceLoading(true)
                              fetch(`/api/arms/claude-code/workspace?sessionId=${activeSessionId}`)
                                .then(r => r.json())
                                .then(d => { if (!d.error) setWorkspaceData(d) })
                                .catch(() => {})
                                .finally(() => setWorkspaceLoading(false))
                            }}
                            className="mt-2 px-4 py-2 rounded-xl bg-zinc-900 text-white text-[10px] font-semibold hover:bg-zinc-800 transition"
                          >
                            {t('ce.devtools_files_scan')}
                          </button>
                        </div>
                      )}
                    </>
                  )}

                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ===== CENTER: ACTIVITY FEED + INPUT ===== */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-zinc-100">
          {/* status row */}
          <div className="px-7 pt-6 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-zinc-500">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  bridgeStatus?.online ? 'bg-emerald-500' : 'bg-zinc-300'
                }`}
              />
              <span>{t('ce.header')}</span>
            </div>
            <div className="flex items-center gap-3">
              {/* Premium Mode Toggle */}
              <button
                onClick={() => setPremiumMode(!premiumMode)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-all ${
                  premiumMode
                    ? 'bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 text-violet-700 ring-1 ring-violet-200'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
                title={premiumMode ? t('ce.premium_on') : t('ce.premium_off')}
              >
                {premiumMode ? '💎' : '⚡'}
                <span>{premiumMode ? 'Premium' : 'Fast'}</span>
              </button>
            <div className="relative">
              <button
                onClick={() => setShowModelSelect((v) => !v)}
                className="text-xs text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
              >
                <span>{selectedModelMeta.providerIcon}</span>
                <span>{selectedModelMeta.name}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {showModelSelect && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute right-0 top-full mt-2 w-72 bg-white border border-zinc-100 rounded-xl shadow-lg z-50 overflow-hidden"
                  >
                    <div className="max-h-80 overflow-y-auto py-1">
                      {CODE_MODELS.map((m) => (
                        <button
                          key={m.id}
                          onClick={() => {
                            setSelectedModel(m.id)
                            setShowModelSelect(false)
                          }}
                          className={`w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-zinc-50 ${
                            selectedModel === m.id ? 'bg-zinc-50' : ''
                          }`}
                        >
                          <span className="text-base">{m.providerIcon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-900 truncate">{m.name}</div>
                            <div className="text-[10px] text-zinc-500 truncate">{m.description}</div>
                          </div>
                          {selectedModel === m.id && (
                            <Check className="w-3.5 h-3.5 text-zinc-700 mt-0.5" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            </div>
          </div>

          {/* title / current question — truncated for long prompts */}
          <div className="px-7 pb-2">
            {currentTitle.length > 160 ? (
              <details className="group">
                <summary className="text-[15px] font-medium text-zinc-900 leading-snug cursor-pointer list-none">
                  <span>{currentTitle.slice(0, 140).trim()}…</span>
                  <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-zinc-100 text-zinc-500 group-open:hidden">
                    +{currentTitle.length - 140} chars
                  </span>
                </summary>
                <p className="text-[13px] text-zinc-600 leading-relaxed mt-1 max-h-[200px] overflow-y-auto pr-2 scrollbar-thin">
                  {currentTitle}
                </p>
              </details>
            ) : (
              <h1 className="text-[15px] font-medium text-zinc-900 leading-snug">
                {currentTitle}
              </h1>
            )}
          </div>

          {/* 👁️ Web Vision Viewer — screenshots + design analysis */}
          {visionData && (
            <div className="px-7 mb-2 animate-fadeIn">
              <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/60 overflow-hidden">
                {/* Header — always visible */}
                <button
                  onClick={() => setVisionExpanded(v => !v)}
                  className="w-full flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-emerald-100/40 transition"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">👁️</span>
                    <span className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Web Vision</span>
                    <span className="text-[10px] text-emerald-600 truncate max-w-[200px]">{visionData.url}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {visionData.analysis?.aesthetic && (
                      <span className="hidden sm:inline text-[10px] px-2 py-0.5 rounded-full bg-emerald-200/60 text-emerald-700 font-medium">
                        {visionData.analysis.aesthetic.slice(0, 30)}
                      </span>
                    )}
                    <span className="text-emerald-500 text-xs">{visionExpanded ? '▼' : '▶'}</span>
                  </div>
                </button>

                {/* Expanded content */}
                {visionExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Screenshots side by side */}
                    <div className="grid grid-cols-2 gap-2">
                      {visionData.screenshots?.above && (
                        <div className="relative group">
                          <div className="aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-emerald-200/50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={visionData.screenshots.above}
                              alt={`Above-fold screenshot of ${visionData.url}`}
                              className="w-full h-full object-cover object-top"
                              loading="lazy"
                            />
                          </div>
                          <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white font-mono">ABOVE FOLD</span>
                        </div>
                      )}
                      {visionData.screenshots?.full && (
                        <div className="relative group">
                          <div className="aspect-video rounded-lg overflow-hidden bg-zinc-900 border border-emerald-200/50">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={visionData.screenshots.full}
                              alt={`Full page screenshot of ${visionData.url}`}
                              className="w-full h-full object-cover object-top"
                              loading="lazy"
                            />
                          </div>
                          <span className="absolute bottom-1.5 left-1.5 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-white font-mono">FULL PAGE</span>
                        </div>
                      )}
                    </div>

                    {/* Design DNA grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Color palette */}
                      {visionData.analysis?.colors?.palette?.length > 0 && (
                        <div className="col-span-2 sm:col-span-4 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mr-1">Palette</span>
                          {visionData.analysis.colors.palette.slice(0, 10).map((c: string, i: number) => (
                            <div
                              key={i}
                              className="w-5 h-5 rounded-full border border-white shadow-sm flex-shrink-0 cursor-help"
                              style={{ backgroundColor: c }}
                              title={c}
                            />
                          ))}
                        </div>
                      )}

                      {/* Typography */}
                      {visionData.analysis?.typography?.headingFont && (
                        <div className="px-2.5 py-2 rounded-lg bg-white/60 border border-emerald-100">
                          <div className="text-[9px] font-semibold text-emerald-600 uppercase mb-0.5">Tipografía</div>
                          <div className="text-[11px] text-zinc-800 font-medium">{visionData.analysis.typography.headingFont}</div>
                          {visionData.analysis.typography.bodyFont && visionData.analysis.typography.bodyFont !== visionData.analysis.typography.headingFont && (
                            <div className="text-[10px] text-zinc-500">{visionData.analysis.typography.bodyFont}</div>
                          )}
                        </div>
                      )}

                      {/* Layout */}
                      {visionData.analysis?.layout?.structure && (
                        <div className="px-2.5 py-2 rounded-lg bg-white/60 border border-emerald-100">
                          <div className="text-[9px] font-semibold text-emerald-600 uppercase mb-0.5">Layout</div>
                          <div className="text-[10px] text-zinc-700 leading-tight">{visionData.analysis.layout.structure.slice(0, 60)}</div>
                        </div>
                      )}

                      {/* Quality */}
                      {visionData.analysis?.quality && (
                        <div className="px-2.5 py-2 rounded-lg bg-white/60 border border-emerald-100">
                          <div className="text-[9px] font-semibold text-emerald-600 uppercase mb-0.5">Calidad</div>
                          <div className="text-[10px] text-zinc-700">{visionData.analysis.quality}</div>
                        </div>
                      )}

                      {/* Mood */}
                      {visionData.analysis?.mood && (
                        <div className="px-2.5 py-2 rounded-lg bg-white/60 border border-emerald-100">
                          <div className="text-[9px] font-semibold text-emerald-600 uppercase mb-0.5">Mood</div>
                          <div className="text-[10px] text-zinc-700">{visionData.analysis.mood.slice(0, 50)}</div>
                        </div>
                      )}
                    </div>

                    {/* Sections detected */}
                    {visionData.analysis?.layout?.sections?.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wider mr-1">Secciones</span>
                        {visionData.analysis.layout.sections.map((s: string, i: number) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                            {s}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Effects & animations */}
                    {(visionData.analysis?.components?.effects || visionData.analysis?.components?.animations) && (
                      <div className="flex items-center gap-2 text-[10px] text-emerald-700">
                        {visionData.analysis.components.effects && (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">✨ {visionData.analysis.components.effects.slice(0, 40)}</span>
                        )}
                        {visionData.analysis.components.animations && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">🎬 {visionData.analysis.components.animations.slice(0, 40)}</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 🔄 Self-Review Visual Reflexion Loop */}
          {(selfReviewStatus === 'capturing' || selfReviewData) && (
            <div className="px-7 mb-2 animate-fadeIn">
              <div className="rounded-2xl border border-amber-200/60 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-yellow-50/60 backdrop-blur overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setSelfReviewExpanded(p => !p)}
                  className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-amber-100/30 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🔄</span>
                    <span className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Self-Review</span>
                    {selfReviewStatus === 'capturing' && (
                      <span className="text-[10px] text-amber-600 animate-pulse">Analizando...</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {selfReviewData && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${
                        selfReviewData.score >= 80 ? 'bg-emerald-200/80 text-emerald-800' :
                        selfReviewData.score >= 60 ? 'bg-amber-200/80 text-amber-800' :
                        'bg-red-200/80 text-red-800'
                      }`}>
                        {selfReviewData.score}/100
                      </span>
                    )}
                    <span className="text-amber-500 text-xs">{selfReviewExpanded ? '▼' : '▶'}</span>
                  </div>
                </button>

                {/* Expanded content */}
                {selfReviewExpanded && selfReviewData && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Summary */}
                    <p className="text-[11px] text-zinc-700 leading-relaxed">{selfReviewData.summary}</p>

                    {/* Score bar */}
                    <div className="relative h-2 rounded-full bg-zinc-200/60 overflow-hidden">
                      <div
                        className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                          selfReviewData.score >= 80 ? 'bg-emerald-500' :
                          selfReviewData.score >= 60 ? 'bg-amber-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${selfReviewData.score}%` }}
                      />
                    </div>

                    {/* Issues */}
                    {selfReviewData.issues.length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[9px] font-semibold text-amber-700 uppercase tracking-wider">Issues ({selfReviewData.issues.length})</div>
                        {selfReviewData.issues.map((issue, i) => (
                          <div key={i} className="flex items-start gap-2 text-[10px] leading-tight">
                            <span className={`shrink-0 mt-0.5 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                              issue.severity === 'critical' ? 'bg-red-200 text-red-800' :
                              issue.severity === 'major' ? 'bg-orange-200 text-orange-800' :
                              issue.severity === 'minor' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-zinc-200 text-zinc-600'
                            }`}>{issue.severity}</span>
                            <div>
                              <span className="font-medium text-zinc-800">{issue.area}:</span>{' '}
                              <span className="text-zinc-600">{issue.description}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Praise */}
                    {selfReviewData.praise.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[9px] font-semibold text-emerald-700 uppercase tracking-wider mr-1">✓ Bueno</span>
                        {selfReviewData.praise.map((p, i) => (
                          <span key={i} className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">{p}</span>
                        ))}
                      </div>
                    )}

                    {/* Pass/Fail badge */}
                    <div className="flex justify-end">
                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-semibold ${
                        selfReviewData.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {selfReviewData.passed ? '✅ Aprobado' : '⚠️ Necesita mejoras'}
                      </span>
                    </div>
                  </div>
                )}

                {/* Loading state */}
                {selfReviewExpanded && selfReviewStatus === 'capturing' && !selfReviewData && (
                  <div className="px-4 pb-4 flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-[11px] text-amber-600">Capturando screenshot y analizando visualmente...</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session Memory Loaded indicator */}
          {memoryLoaded && (
            <div className="px-7 mb-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100 text-[11px] text-violet-600 animate-fadeIn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a7 7 0 0 1 7 7c0 3-2 5.5-4 7v2H9v-2c-2-1.5-4-4-4-7a7 7 0 0 1 7-7z"/><path d="M9 21h6"/><path d="M10 18h4"/></svg>
                {t('ce.memory_loaded')}
              </div>
            </div>
          )}

          {/* Dependency Graph indicator */}
          {depGraph && (
            <div className="px-7 mb-1">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-100 text-[11px] text-sky-600 animate-fadeIn">
                <FolderTree className="w-3.5 h-3.5" />
                <span>{t('ce.dep_graph_ready')}: {depGraph.fileCount} {depGraph.fileCount === 1 ? 'archivo' : 'archivos'}, {depGraph.totalLines} líneas</span>
                {depGraph.missingImports > 0 && (
                  <span className="text-amber-600 font-medium ml-1">⚠ {depGraph.missingImports} import(s) faltantes</span>
                )}
                {depGraph.npmPackages.length > 0 && (
                  <span className="text-zinc-400 ml-1">📦 {depGraph.npmPackages.join(', ')}</span>
                )}
              </div>
            </div>
          )}

          {/* Code Warnings */}
          {codeWarnings.length > 0 && (
            <div className="px-7 mb-1">
              <div className="flex flex-col gap-1 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-100 text-[11px] text-amber-700 animate-fadeIn">
                <div className="flex items-center gap-1.5 font-medium">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {t('ce.code_warnings')}
                </div>
                {codeWarnings.map((w, i) => (
                  <div key={i} className="pl-5 text-[10px]">
                    <span className="font-mono text-amber-800">{w.file}</span>
                    {w.missingLocal.length > 0 && <span className="ml-1">→ imports faltantes: {w.missingLocal.join(', ')}</span>}
                    {w.missingPkgs.length > 0 && <span className="ml-1">→ paquetes: {w.missingPkgs.join(', ')}</span>}
                    {w.syntaxErrors.length > 0 && <span className="ml-1 text-red-600">→ {w.syntaxErrors.join('; ')}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction Status Banner — Sprint 8 */}
          {txStatus && (
            <div className="px-7 mb-1">
              <AnimatePresence mode="wait">
                {txStatus === 'started' && (
                  <motion.div
                    key="tx-started"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-sky-50 border border-sky-100 text-[11px] text-sky-700 animate-fadeIn"
                  >
                    <Shield className="w-3.5 h-3.5" />
                    <span className="font-medium">{t('ce.tx_started')}</span>
                    {txDetails?.actionCount && <span className="text-sky-500">— {txDetails.actionCount} acciones</span>}
                  </motion.div>
                )}
                {txStatus === 'validating' && (
                  <motion.div
                    key="tx-validating"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100 text-[11px] text-violet-700"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="font-medium">{t('ce.tx_validating')}</span>
                  </motion.div>
                )}
                {txStatus === 'repairing' && (
                  <motion.div
                    key="tx-repairing"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-700"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="font-medium">🔧 {t('ce.auto_repairing')}</span>
                  </motion.div>
                )}
                {txStatus === 'committed' && (
                  <motion.div
                    key="tx-committed"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-700"
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span className="font-medium">{t('ce.tx_committed')}</span>
                    {txDetails?.commandCount && <span className="text-emerald-500">— {txDetails.commandCount} comandos</span>}
                  </motion.div>
                )}
                {txStatus === 'rolled_back' && (
                  <motion.div
                    key="tx-rolledback"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-red-50 border border-red-100 text-[11px] text-red-700"
                  >
                    <div className="flex items-center gap-2">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      <span className="font-medium">{t('ce.tx_rolled_back')}</span>
                    </div>
                    {txDetails?.reason && <div className="pl-5 text-[10px] text-red-600">{txDetails.reason}</div>}
                    {txDetails?.criticalErrors && txDetails.criticalErrors.length > 0 && (
                      <div className="pl-5 text-[10px]">
                        <span className="font-medium text-red-800">{t('ce.tx_critical_errors')}:</span>
                        {txDetails.criticalErrors.map((e, i) => (
                          <div key={i} className="font-mono text-red-600 ml-1">{e}</div>
                        ))}
                      </div>
                    )}
                    {txDetails?.affectedFiles && txDetails.affectedFiles.length > 0 && (
                      <div className="pl-5 text-[10px]">
                        <span className="font-medium text-red-800">{t('ce.tx_affected_files')}:</span>
                        <span className="font-mono ml-1">{txDetails.affectedFiles.join(', ')}</span>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Dependency Resolution Banner — Sprint 9 */}
          {depStatus && (
            <div className="px-7 mb-1">
              <AnimatePresence mode="wait">
                {depStatus === 'scanning' && (
                  <motion.div
                    key="dep-scanning"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100 text-[11px] text-blue-700"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="font-medium">{t('ce.dep_scanning')}</span>
                  </motion.div>
                )}
                {depStatus === 'resolved' && depDetails?.resolved && depDetails.resolved.length > 0 && (
                  <motion.div
                    key="dep-resolved"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex flex-col gap-1 px-3 py-2 rounded-xl bg-amber-50 border border-amber-100 text-[11px] text-amber-700"
                  >
                    <div className="flex items-center gap-2 font-medium">
                      <span>📦</span>
                      <span>{t('ce.dep_resolved')} ({depDetails.resolved.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-5">
                      {depDetails.resolved.map((d, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100/60 text-[10px] font-mono">
                          {d.name} <span className="text-amber-500">v{d.version}</span>
                        </span>
                      ))}
                    </div>
                    {depDetails.injectedFiles && depDetails.injectedFiles.length > 0 && (
                      <div className="pl-5 text-[10px] text-amber-600">
                        {t('ce.dep_injected')} {depDetails.injectedFiles.join(', ')}
                      </div>
                    )}
                  </motion.div>
                )}
                {depStatus === 'ready' && (
                  <motion.div
                    key="dep-ready"
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-100 text-[11px] text-emerald-700"
                  >
                    <span>✓</span>
                    <span className="font-medium">{t('ce.dep_ready')}</span>
                    {depDetails?.totalResolved ? <span className="text-emerald-500">— {depDetails.totalResolved} deps</span> : null}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Sprint 11: Phoenix Protocol toast */}
          {phoenixEvent && (
            <div className="px-7">
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] ${
                  phoenixEvent.type === 'rollback_executed'
                    ? 'bg-amber-50 border border-amber-200 text-amber-700'
                    : phoenixEvent.type === 'integrity_mismatch'
                    ? 'bg-rose-50 border border-rose-200 text-rose-700'
                    : 'bg-orange-50 border border-orange-200 text-orange-700'
                }`}
              >
                <span>🔥</span>
                <span className="font-medium">{phoenixEvent.detail}</span>
              </motion.div>
            </div>
          )}

          {/* Sprint 12: Image Generation Engine banner */}
          {imageGenStatus && (
            <div className="px-7">
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[11px] ${
                  imageGenStatus === 'generating'
                    ? 'bg-sky-50 border border-sky-200 text-sky-700'
                    : imageGenStatus === 'ready'
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                }`}
              >
                {imageGenStatus === 'generating' ? (
                  <>
                    <span className="animate-pulse">🎨</span>
                    <span className="font-medium">{t('ce.image_generating')}</span>
                    {imageGenDetails?.total && (
                      <span className="opacity-70">
                        {(imageGenDetails?.current || 0)}/{imageGenDetails.total}
                      </span>
                    )}
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {(imageGenDetails as any)?.elapsed != null && (
                      <span className="px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-600 text-[10px] font-mono">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(imageGenDetails as any).elapsed}s
                      </span>
                    )}
                    {/* Progress bar */}
                    {imageGenDetails?.total && (
                      <div className="flex-1 h-1.5 bg-sky-100 rounded-full overflow-hidden ml-1 max-w-[120px]">
                        <div
                          className="h-full bg-sky-500 rounded-full transition-all duration-500"
                          style={{ width: `${Math.max(5, ((imageGenDetails?.current || 0) / imageGenDetails.total) * 100)}%` }}
                        />
                      </div>
                    )}
                  </>
                ) : imageGenStatus === 'failed' ? (
                  <>
                    <span>⚠️</span>
                    <span className="font-medium">{imageGenDetails?.error || t('ce.image_gen_failed')}</span>
                  </>
                ) : imageGenStatus === 'ready' ? (
                  <>
                    <span>🎨</span>
                    <span className="font-medium">{t('ce.image_ready')}</span>
                    {imageGenDetails?.results && (
                      <div className="flex gap-1.5 ml-1">
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {(imageGenDetails.results as any[]).filter(r => r?.url).slice(0, 4).map((r, idx) => (
                          <a key={idx} href={r.url} target="_blank" rel="noopener noreferrer" className="block w-8 h-8 rounded-md overflow-hidden border border-emerald-200 hover:scale-110 transition-transform">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={r.url} alt={r.path || 'Generated'} className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    )}
                  </>
                ) : null}
              </motion.div>
            </div>
          )}

          {/* Sprint 10: Feedback Injected indicator */}
          {feedbackInjected && (
            <div className="px-7">
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-violet-50 border border-violet-100 text-[11px] text-violet-700"
              >
                <span>🧠</span>
                <span className="font-medium">{t('ce.feedback_injected')}</span>
              </motion.div>
            </div>
          )}

          {/* Sprint 10: Nervous System Monitor — collapsible telemetry pipeline */}
          {telemetryStages.length > 0 && (
            <div className="px-7">
              <button
                onClick={() => setShowTelemetry(!showTelemetry)}
                className="flex items-center gap-2 text-[10px] text-zinc-400 hover:text-zinc-600 transition mb-1"
              >
                <span className="font-mono">⚡ {t('ce.nervous_system')}</span>
                <span className="text-zinc-300">{showTelemetry ? '▼' : '▶'}</span>
                {telemetryTotal > 0 && (
                  <span className="text-zinc-300 font-mono">{(telemetryTotal / 1000).toFixed(1)}s</span>
                )}
              </button>
              {showTelemetry && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-0.5 mb-2"
                >
                  {telemetryStages.map((stage, i) => {
                    const stageLabels: Record<string, string> = {
                      llm: 'LLM', parse: 'PARSE', validate: 'AST',
                      deps: 'DEPS', snapshot: 'SNAP', commit: 'DISK', bridge: 'BRIDGE', verify: 'VERIFY', feedback: 'FB',
                    }
                    const stageColors: Record<string, string> = {
                      pending: 'bg-zinc-100 text-zinc-400',
                      active: 'bg-sky-100 text-sky-600 animate-pulse',
                      completed: 'bg-emerald-100 text-emerald-600',
                      failed: 'bg-rose-100 text-rose-600',
                      skipped: 'bg-zinc-50 text-zinc-300 line-through',
                    }
                    const color = stageColors[stage.status] || stageColors.pending
                    return (
                      <div key={stage.name} className="flex items-center">
                        <div
                          className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-medium ${color} transition-all duration-300`}
                          title={stage.detail || stage.name}
                        >
                          {stageLabels[stage.name] || stage.name}
                          {stage.durationMs !== undefined && stage.status === 'completed' && (
                            <span className="ml-0.5 opacity-60">{stage.durationMs < 1000 ? `${stage.durationMs}ms` : `${(stage.durationMs / 1000).toFixed(1)}s`}</span>
                          )}
                        </div>
                        {i < telemetryStages.length - 1 && (
                          <span className="text-[8px] text-zinc-300 mx-0.5">→</span>
                        )}
                      </div>
                    )
                  })}
                </motion.div>
              )}
            </div>
          )}

          {/* Execution Banner — OUTSIDE feed so it's always visible */}
          <div className="px-7">
            <ExecutionBanner
              commands={commands}
              isThinking={isThinking}
              streamingText={streamingText}
              t={t}
            />
          </div>

          {/* feed */}
          <div ref={feedRef} className="flex-1 overflow-y-auto px-7 pb-6 pt-1">
            {messagesNoSystem.length === 0 && commands.length === 0 ? (
              <div className="py-4 space-y-5">
                {/* Template Starter Library — HERO cards */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                      <span className="text-[11px] uppercase tracking-[0.18em] font-semibold text-zinc-400">{t('ce.templates_title')}</span>
                    </div>
                    {/* Category filter tabs */}
                    <div className="flex items-center gap-1 bg-zinc-100 rounded-lg p-0.5">
                      {(['all', 'frontend', 'fullstack'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setTplFilter(cat)}
                          className={`text-[10px] font-semibold px-2.5 py-1 rounded-md transition-all ${
                            tplFilter === cat
                              ? 'bg-white text-zinc-900 shadow-sm'
                              : 'text-zinc-500 hover:text-zinc-700'
                          }`}
                        >
                          {t(`ce.category_${cat}`)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {CODE_TEMPLATES.filter(tpl => tplFilter === 'all' || tpl.category === tplFilter).map((tpl) => (
                      <button
                        key={tpl.id}
                        onClick={() => setInput(tpl.prompt)}
                        className="relative group text-left rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
                      >
                        {/* Gradient background */}
                        <div className={`absolute inset-0 bg-gradient-to-br ${tpl.gradient} opacity-90 group-hover:opacity-100 transition-opacity`} />
                        {/* Shine overlay */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                        {/* Content */}
                        <div className="relative p-5">
                          {/* Full-stack badge */}
                          {tpl.category === 'fullstack' && (
                            <div className="absolute top-3 right-3 text-[8px] font-bold tracking-wider bg-white/25 backdrop-blur-sm text-white px-2 py-0.5 rounded-full">
                              {t('ce.fullstack_badge')}
                            </div>
                          )}
                          <div className="text-3xl mb-3 drop-shadow-lg" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}>{tpl.icon}</div>
                          <div className="text-base font-bold text-white tracking-tight">{tpl.name}</div>
                          <div className="text-[12px] text-white/70 mt-1.5 leading-relaxed">{locale === 'en' && tpl.descriptionEn ? tpl.descriptionEn : tpl.description}</div>
                          {/* Tech stack badges */}
                          {tpl.techStack && tpl.techStack.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {tpl.techStack.map((tech) => (
                                <span key={tech} className="text-[9px] font-medium text-white/80 bg-white/15 backdrop-blur-sm px-1.5 py-0.5 rounded">
                                  {tech}
                                </span>
                              ))}
                            </div>
                          )}
                          <div className="mt-3 inline-flex items-center gap-1 text-[10px] font-semibold text-white/90 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full">
                            <Zap className="w-3 h-3" />
                            {t('ce.template_use')}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick suggestions — compact pills */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] uppercase tracking-[0.18em] text-zinc-400">{t('ce.quick_start')}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      t('ce.suggestion_1'),
                      t('ce.suggestion_2'),
                      t('ce.suggestion_3'),
                    ].map((s) => (
                      <button
                        key={s}
                        onClick={() => setInput(s)}
                        className="text-[12px] text-zinc-500 px-3.5 py-2 rounded-full bg-zinc-50 hover:bg-zinc-100 hover:text-zinc-700 border border-zinc-100 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-1">

                {/* Current commands rendered as activity rows */}
                {commands.map((c, idx) => (
                  <ActivityRow
                    key={c.id}
                    command={c}
                    index={idx}
                    total={commands.length}
                    onConfirm={handleConfirm}
                    onReject={handleReject}
                    onSelect={setPreviewCmdId}
                    selected={previewCmdId === c.id}
                    onOpenPath={handleOpenPath}
                    onPreviewHtml={handlePreviewHtml}
                    onEditFile={(path, content) => setEditorTarget({ path, content })}
                    t={t}
                  />
                ))}

                {/* Diff incremental (Fase 3) — aviso de archivos sin cambios omitidos */}
                {diffNotice && (
                  <div className="flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] text-emerald-700 w-fit">
                    <span>⚡</span>
                    <span>
                      {t('ce.diff_skipped')}: <b>{diffNotice.skipped}</b> · {t('ce.diff_written')}: <b>{diffNotice.written}</b>
                    </span>
                  </div>
                )}

                {/* Lentes especializadas activas (Fase 4) */}
                {activeLenses.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 w-fit">
                    {activeLenses.map((l) => (
                      <span
                        key={l.id}
                        title={l.name}
                        className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] text-violet-700"
                      >
                        <span>{l.emoji}</span>
                        <span className="font-medium">{l.name}</span>
                      </span>
                    ))}
                  </div>
                )}

                {/* Uso de tokens + costo estimado del turno (Fase 4) */}
                {tokenUsage && (
                  <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-700 w-fit">
                    <span>💰</span>
                    <span>
                      <b>{tokenUsage.totalTokens.toLocaleString()}</b> tokens · ~$
                      {tokenUsage.costUsd < 0.01 ? tokenUsage.costUsd.toFixed(4) : tokenUsage.costUsd.toFixed(2)}
                      {tokenUsage.estimated && <span className="opacity-50"> (est.)</span>}
                    </span>
                  </div>
                )}

                {/* Monaco editor modal (Fase 3) — edición manual de archivos */}
                {editorTarget && activeSessionId && (
                  <CodeEditorModal
                    sessionId={activeSessionId}
                    path={editorTarget.path}
                    initialContent={editorTarget.content}
                    onClose={() => setEditorTarget(null)}
                    onSaved={() => { setEditorTarget(null); fetchCommands() }}
                  />
                )}

                {/* Assistant text response — visible after completion (with or without commands) */}
                {lastAssistant && lastAssistant.content && lastAssistant.status !== 'streaming' && !isThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 mx-1 p-4 rounded-2xl bg-zinc-50/60 border border-zinc-100"
                  >
                    <div
                      className="prose-sm max-w-none text-zinc-700 leading-relaxed text-[14px]"
                      dangerouslySetInnerHTML={{ __html: tinyMarkdown(stripActionAndCodeFences(lastAssistant.content)) }}
                    />
                  </motion.div>
                )}

                {/* Project summary — shown when 2+ files were created in the same root folder */}
                {projectSummary && !isThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="mt-5 mx-1 p-5 rounded-2xl bg-zinc-50/80 border border-zinc-100"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-base leading-none mt-0.5">✅</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900">
                          {t('ce.project_created')}
                        </div>
                        <div className="mt-3 font-mono text-[13px] text-zinc-600 leading-relaxed">
                          <div className="text-zinc-800">📁 {projectSummary.root}/</div>
                          {projectSummary.files.map((f, i) => {
                            const isLast = i === projectSummary.files.length - 1;
                            return (
                              <div key={f} className="pl-2">
                                <span className="text-zinc-400">{isLast ? '└──' : '├──'}</span>{' '}
                                <span>{f}</span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            onClick={() => handleOpenPath(projectSummary.root)}
                            className="text-xs px-3 py-1.5 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition flex items-center gap-1.5"
                          >
                            <span>📁</span> {t('ce.chip_open_folder')}
                          </button>
                          {projectSummary.hasHtml && projectSummary.htmlFile && (
                            <>
                              <button
                                onClick={() => {
                                  const cmd = commands.find((c) => {
                                    if (c.type !== 'write_file' || c.status !== 'completed') return false;
                                    try {
                                      const p = safeJsonParse(c.payload).path as string;
                                      return p === projectSummary.htmlFile;
                                    } catch {
                                      return false;
                                    }
                                  });
                                  if (cmd) handlePreviewHtml(cmd.id);
                                }}
                                className="text-xs px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition flex items-center gap-1.5"
                              >
                                <span>◉</span> {t('ce.chip_preview')}
                              </button>
                              <button
                                onClick={() => projectSummary.htmlFile && handleOpenPath(projectSummary.htmlFile)}
                                className="text-xs px-3 py-1.5 rounded-full bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition flex items-center gap-1.5"
                              >
                                <span>↗</span> {t('ce.chip_open_browser')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Image gallery — shown when save_image commands completed successfully */}
                {!isThinking && (() => {
                  const imgCmds = commands.filter(c => c.type === 'save_image' && (c.status === 'completed' || c.status === 'approved'))
                  if (imgCmds.length === 0) return null
                  const images = imgCmds.map(c => {
                    const p = safeJsonParse(c.payload) as Record<string, unknown>
                    return { url: (p.url as string) || '', path: (p.path as string) || '', prompt: (p.prompt as string) || '', id: c.id }
                  }).filter(img => img.url)
                  if (images.length === 0) return null
                  return (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 }}
                      className="mt-5 mx-1 p-5 rounded-2xl bg-zinc-50/80 border border-zinc-100"
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">🎨</span>
                        <span className="text-sm font-medium text-zinc-900">
                          {images.length === 1 ? t('ce.image_gallery_one') : `${images.length} ${t('ce.image_gallery_many')}`}
                        </span>
                      </div>
                      <div className={`grid gap-3 ${images.length === 1 ? 'grid-cols-1 max-w-[320px]' : 'grid-cols-2'}`}>
                        {images.map((img) => (
                          <div key={img.id} className="group relative">
                            <a
                              href={img.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block rounded-xl overflow-hidden border border-zinc-200 shadow-sm hover:shadow-md transition-all"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={img.url} alt={img.prompt || img.path || 'Imagen generada'} className="w-full h-auto object-cover" loading="lazy" />
                            </a>
                            <div className="mt-1.5 flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400 font-mono truncate flex-1">{img.path}</span>
                              <button
                                onClick={() => handleOpenPath(img.path)}
                                className="text-[10px] px-2 py-0.5 rounded-full border border-zinc-200 text-zinc-500 hover:bg-zinc-900 hover:text-white hover:border-zinc-900 transition flex-shrink-0"
                              >
                                📁 {t('ce.image_open')}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )
                })()}

                {/* Completion Summary — appears when all commands finish */}
                {completionSummary && !isThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="mt-5 mx-1 rounded-2xl overflow-hidden border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-white"
                  >
                    <div className="px-5 py-4">
                      {/* Header */}
                      <div className="flex items-center gap-2.5 mb-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-zinc-900">
                            {completionSummary.failed > 0
                              ? t('ce.summary_partial')
                              : t('ce.summary_success')}
                          </div>
                          <div className="text-[11px] text-zinc-500">
                            {completionSummary.completed}/{completionSummary.total} {t('ce.summary_actions')}
                            {completionSummary.failed > 0 && (
                              <span className="text-rose-500 ml-1.5">· {completionSummary.failed} {t('ce.summary_errors')}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* File list */}
                      <div className="space-y-1.5">
                        {completionSummary.filesWritten.map((f, i) => (
                          <div key={`fw-${i}`} className="flex items-center gap-2 text-[12px]">
                            <span className="text-emerald-500">✓</span>
                            <FileText className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                            <span className="font-mono text-zinc-600 truncate">{f}</span>
                          </div>
                        ))}
                        {completionSummary.foldersCreated.map((f, i) => (
                          <div key={`fc-${i}`} className="flex items-center gap-2 text-[12px]">
                            <span className="text-emerald-500">✓</span>
                            <FolderOpen className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                            <span className="font-mono text-zinc-600 truncate">{f}</span>
                          </div>
                        ))}
                        {completionSummary.cmdsExecuted.map((c, i) => (
                          <div key={`ce-${i}`} className="flex items-center gap-2 text-[12px]">
                            <span className="text-emerald-500">✓</span>
                            <Zap className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                            <span className="font-mono text-zinc-600 truncate">{c}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Bottom hint bar */}
                    <div className="px-5 py-2.5 bg-emerald-500/5 border-t border-emerald-100">
                      <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                        <Sparkles className="w-3 h-3 text-emerald-500" />
                        <span>{t('ce.summary_hint')}</span>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Friendly failure with retry */}
                {failedAssistant && !isThinking && (
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 mx-1 p-4 rounded-2xl bg-rose-50 border border-rose-100"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <div className="text-sm text-zinc-800">
                          {t('ce.error_action')}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {sanitizeError(failedAssistant.error || '')}
                        </div>
                        <button
                          onClick={retry}
                          className="mt-3 text-xs px-3 py-1 rounded-full bg-zinc-900 text-white hover:bg-zinc-700 transition"
                        >
                          {t('ce.retry')}
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Optional details (assistant prose) */}
                {messagesNoSystem.length > 0 && (
                  <div className="mt-4 mx-1">
                    <button
                      onClick={() => setShowDetails((v) => !v)}
                      className="text-xs text-zinc-400 hover:text-zinc-700 flex items-center gap-1"
                    >
                      {showDetails ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {showDetails ? t('ce.hide_details') : t('ce.show_details')}
                    </button>
                    {showDetails && (
                      <div className="mt-2 space-y-3">
                        {messagesNoSystem.map((m) => {
                          // Check for image markers in user messages
                          const hasImages = m.role === 'user' && m.content.includes('[IMG:')
                          const textContent = hasImages ? m.content.replace(/\n?\[IMG:[^\]]*\]/g, '').trim() : m.content
                          const imageCount = hasImages ? (m.content.match(/\[IMG:/g) || []).length : 0
                          return (
                            <div key={m.id} className="text-sm">
                              <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400 mb-1">
                                {m.role === 'user' ? t('ce.role_user') : t('ce.role_assistant')}
                              </div>
                              {hasImages && (
                                <div className="flex items-center gap-1 mb-1 text-[10px] text-violet-500">
                                  <ImageIcon className="w-3 h-3" />
                                  <span>{imageCount} {imageCount === 1 ? 'imagen' : 'imágenes'}</span>
                                </div>
                              )}
                              {(() => {
                                const cleaned = stripActionAndCodeFences(textContent)
                                const isLong = m.role === 'user' && cleaned.length > 300
                                if (!isLong) return (
                                  <div
                                    className="text-zinc-700 leading-relaxed"
                                    dangerouslySetInnerHTML={{ __html: tinyMarkdown(cleaned) }}
                                  />
                                )
                                return (
                                  <details className="group/msg">
                                    <summary className="text-zinc-700 leading-relaxed cursor-pointer list-none">
                                      <span dangerouslySetInnerHTML={{ __html: tinyMarkdown(cleaned.slice(0, 250).trim() + '…') }} />
                                      <span className="ml-1 text-[9px] text-zinc-400 group-open/msg:hidden">[ver todo]</span>
                                    </summary>
                                    <div
                                      className="text-zinc-700 leading-relaxed mt-1 max-h-[60vh] overflow-y-auto text-[12px]"
                                      dangerouslySetInnerHTML={{ __html: tinyMarkdown(cleaned) }}
                                    />
                                  </details>
                                )
                              })()}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Smart Textarea capsule with image support */}
          <div
            className="px-7 pb-6 pt-3"
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true) }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false) }}
            onDrop={(e) => {
              e.preventDefault(); e.stopPropagation(); setIsDragging(false)
              const files = Array.from(e.dataTransfer.files)
              files.forEach(f => processImageFile(f))
            }}
          >
            <div className={`bg-[#F9F9F9] border rounded-2xl px-4 py-3 shadow-sm focus-within:border-zinc-400 focus-within:shadow-md transition-all ${isDragging ? 'border-violet-400 bg-violet-50/30 ring-2 ring-violet-200' : 'border-zinc-200'}`}>
              {/* Image preview strip */}
              {pendingImages.length > 0 && (
                <div className="flex gap-2 mb-2 flex-wrap">
                  {pendingImages.map(img => (
                    <div key={img.id} className="relative group">
                      <img
                        src={img.preview}
                        alt={img.name}
                        className="w-16 h-16 object-cover rounded-lg border border-zinc-200 shadow-sm"
                      />
                      <button
                        onClick={() => removeImage(img.id)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-zinc-900 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[10px]"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[8px] px-1 py-0.5 rounded-b-lg truncate">
                        {img.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Drag overlay hint */}
              {isDragging && (
                <div className="flex items-center justify-center gap-2 py-3 text-violet-600 text-sm font-medium">
                  <ImageIcon className="w-5 h-5" />
                  {t('ce.drop_image')}
                </div>
              )}

              <div className="flex items-end gap-2">
                {/* Image upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || pendingImages.length >= MAX_IMAGES}
                  className="flex-shrink-0 p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 disabled:opacity-30 transition-all mb-0.5"
                  title={t('ce.attach_image')}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    files.forEach(f => processImageFile(f))
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                />

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={(e) => {
                    const items = Array.from(e.clipboardData.items)
                    const imageItems = items.filter(i => i.type.startsWith('image/'))
                    if (imageItems.length > 0) {
                      e.preventDefault()
                      imageItems.forEach(item => {
                        const file = item.getAsFile()
                        if (file) processImageFile(file)
                      })
                    }
                  }}
                  rows={1}
                  placeholder={pendingImages.length > 0 ? t('ce.describe_image') : t('ce.placeholder')}
                  disabled={sending || !bridgeStatus?.online}
                  className="flex-1 resize-none outline-none bg-transparent text-[15px] leading-relaxed text-zinc-900 placeholder:text-zinc-400 py-0.5 scrollbar-thin scrollbar-thumb-zinc-300"
                  style={{ minHeight: '26px' }}
                />
                <button
                  data-send-btn
                  onClick={sendMessage}
                  disabled={sending || (!input.trim() && pendingImages.length === 0) || !bridgeStatus?.online}
                  className="flex-shrink-0 px-4 py-1.5 rounded-full bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-700 disabled:opacity-30 transition-all flex items-center gap-1.5 mb-0.5"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  {t('ce.ask')}
                </button>
              </div>
            </div>
            <div className="text-[10px] text-zinc-400 mt-2 px-2 flex items-center justify-between">
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {t('ce.sandbox_notice')}
              </span>
              <span className="text-zinc-300">
                {t('ce.shift_enter_hint')} · Ctrl+V {t('ce.paste_image')}
              </span>
            </div>
          </div>
        </div>

        {/* ===== DRAG RESIZER ===== */}
        {!previewExpanded && (
          <div
            onMouseDown={onResizerMouseDown}
            className="w-[5px] flex-shrink-0 cursor-col-resize bg-zinc-100 hover:bg-violet-500 active:bg-violet-500 transition-colors duration-150 z-10"
            title="Drag to resize"
          />
        )}

        {/* ===== RIGHT: PREVIEW / WORKSPACE PANE (Zen Mode expandable) ===== */}
        <div
          className={`flex flex-col bg-zinc-50/50 transition-all duration-200 ease-out ${
            previewExpanded
              ? 'fixed inset-0 z-[9999] bg-white'
              : 'flex-shrink-0'
          }`}
          style={previewExpanded ? undefined : { width: previewWidth }}
        >
          {/* Tab switcher + actions */}
          <div className={`px-5 py-3 flex items-center gap-1 border-b ${previewExpanded ? 'border-zinc-200 bg-zinc-50/90' : 'border-zinc-100'}`}>
            {/* In expanded mode, hide tabs — show file info instead */}
            {previewExpanded ? (
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-medium text-zinc-700">
                  {projectPreview ? t('ce.project_preview') : t('ce.preview')}
                </span>
                {previewCmd && (
                  <span className="text-xs text-zinc-400 font-mono">
                    {safeJsonParse(previewCmd.payload).path || ''}
                  </span>
                )}
                {isExecutingAny && (
                  <span className="inline-flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    {t('ce.preview_updating')}
                  </span>
                )}
              </div>
            ) : (
              <>
                <button
                  onClick={() => setRightTab('preview')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-[0.14em] transition ${
                    rightTab === 'preview' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <Eye className="w-3 h-3" /> {t('ce.preview')}
                  {isExecutingAny && rightTab === 'preview' && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                  )}
                </button>
                <button
                  onClick={() => { setRightTab('workspace'); fetchWorkspace(); fetchRecentChanges() }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] uppercase tracking-[0.14em] transition ${
                    rightTab === 'workspace' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-400 hover:text-zinc-600'
                  }`}
                >
                  <FolderTree className="w-3 h-3" /> Workspace
                  {workspace?.indexed && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
                  )}
                </button>
              </>
            )}
            <div className="flex-1" />
            {/* Preview action buttons — visible in both modes */}
            {(rightTab === 'preview' || previewExpanded) && (
              <div className="flex items-center gap-1">
                {/* Project toggle (multi-file) */}
                {previewExpanded && commands.filter((c) => ['completed', 'approved', 'executing'].includes(c.status)).length >= 2 && (
                  <button
                    onClick={() => setProjectPreview((v) => !v)}
                    className={`text-[11px] px-2.5 py-1 rounded-md border transition font-medium ${
                      projectPreview
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
                    }`}
                  >
                    {projectPreview ? t('ce.single_file') : t('ce.project_view')}
                  </button>
                )}
                {/* Responsive device toggle — only in expanded mode */}
                {previewExpanded && (
                  <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 gap-0.5">
                    {([
                      { id: 'desktop' as const, icon: Monitor, label: 'Desktop' },
                      { id: 'tablet' as const, icon: Tablet, label: 'Tablet (768px)' },
                      { id: 'mobile' as const, icon: Smartphone, label: 'Mobile (375px)' },
                    ]).map(({ id, icon: Icon, label }) => (
                      <button
                        key={id}
                        onClick={() => setPreviewDevice(id)}
                        className={`w-7 h-7 rounded-md flex items-center justify-center transition ${
                          previewDevice === id
                            ? 'bg-white text-zinc-900 shadow-sm'
                            : 'text-zinc-400 hover:text-zinc-600'
                        }`}
                        title={label}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    ))}
                  </div>
                )}
                {/* Refresh preview */}
                <button
                  onClick={() => setPreviewRefreshKey((k) => k + 1)}
                  className={`rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-white transition ${previewExpanded ? 'w-8 h-8' : 'w-7 h-7'}`}
                  title={t('ce.preview_refresh')}
                >
                  <RotateCw className={previewExpanded ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
                </button>
                {/* Open in browser */}
                {livePreviewUrl && (
                  <a
                    href={livePreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-white transition ${previewExpanded ? 'w-8 h-8' : 'w-7 h-7'}`}
                    title={t('ce.preview_open_browser')}
                  >
                    <ExternalLink className={previewExpanded ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
                  </a>
                )}
                {/* ⚡ Live Runtime — WebContainers (Node.js real en el navegador) */}
                {activeSessionId && commands.filter(c => c.status === 'completed').length > 0 && (
                  <button
                    onClick={() => setShowRuntimePanel(v => !v)}
                    className={`rounded-lg flex items-center justify-center gap-1.5 transition font-medium ${
                      showRuntimePanel
                        ? previewExpanded
                          ? 'h-8 px-3 text-[11px] bg-violet-700 text-white hover:bg-violet-800 shadow-sm'
                          : 'h-7 px-2.5 text-[10px] bg-violet-700 text-white hover:bg-violet-800 shadow-sm'
                        : previewExpanded
                          ? 'h-8 px-3 text-[11px] bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                          : 'h-7 px-2.5 text-[10px] bg-violet-600 text-white hover:bg-violet-700 shadow-sm'
                    }`}
                    title="Live Runtime — corre el backend real con Node.js en el navegador (WebContainers)"
                  >
                    <span>⚡</span>
                    <span>{showRuntimePanel ? 'Preview' : 'Live Runtime'}</span>
                  </button>
                )}
                {/* 🚀 Unified Publish Button */}
                {activeSessionId && commands.length > 0 && (
                  <button
                    onClick={() => setPublishOpen(true)}
                    className={`rounded-lg flex items-center justify-center gap-1.5 transition font-medium ${
                      previewExpanded
                        ? 'h-8 px-3 text-[11px] bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                        : 'h-7 px-2.5 text-[10px] bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm'
                    }`}
                    title={t('ce.publish_title')}
                  >
                    <Rocket className={previewExpanded ? 'w-3.5 h-3.5' : 'w-3 h-3'} />
                    <span>{t('ce.publish_btn')}</span>
                  </button>
                )}
                {/* Expand / Collapse toggle */}
                <button
                  onClick={() => setPreviewExpanded((v) => !v)}
                  className={`rounded-md flex items-center justify-center gap-1.5 transition text-[10px] font-medium ${
                    previewExpanded
                      ? 'h-8 px-3 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                      : 'h-7 px-2.5 text-zinc-500 hover:text-zinc-900 bg-white hover:bg-zinc-100 border border-zinc-200 hover:border-zinc-300'
                  }`}
                  title={previewExpanded ? 'ESC' : t('ce.preview_expand')}
                >
                  {previewExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{previewExpanded ? 'ESC' : 'Expand'}</span>
                </button>
                {/* Close X — only in expanded */}
                {previewExpanded && (
                  <button
                    onClick={() => setPreviewExpanded(false)}
                    className="ml-0.5 w-8 h-8 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                    title="Close (ESC)"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ═══ LIVE URL BAR — persistent when site is published ═══ */}
          {(deployedUrls.octopus || deployedUrls.pages) && !previewExpanded && (
            <div className="px-4 py-1.5 border-b border-emerald-100 bg-gradient-to-r from-emerald-50/80 via-white to-emerald-50/80 flex items-center gap-2 min-h-[28px]">
              <span className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500 text-white leading-none flex-shrink-0">{t('ce.live_bar_label')}</span>
              {deployedUrls.version && deployedUrls.version > 0 && (
                <span className="text-[8px] font-bold tracking-wider px-1 py-0.5 rounded bg-zinc-200 text-zinc-600 leading-none flex-shrink-0">v{deployedUrls.version}</span>
              )}
              {deployedUrls.octopus && (
                <>
                  <span className="text-[10px] flex-shrink-0">🐙</span>
                  <a href={deployedUrls.octopus} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#C4622D] font-semibold truncate hover:underline">
                    {deployedUrls.octopus.replace(/^https?:\/\//, '')}
                  </a>
                  <button onClick={() => copyUrl(deployedUrls.octopus!)} className="w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100 transition flex-shrink-0" title={t('ce.publish_copy')}>
                    {copiedUrl === deployedUrls.octopus ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                  </button>
                  <a href={deployedUrls.octopus} target="_blank" rel="noopener noreferrer" className="w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100 transition flex-shrink-0" title={t('ce.publish_open')}>
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>
                </>
              )}
              {deployedUrls.pages && deployedUrls.octopus && <span className="w-px h-3 bg-zinc-200 flex-shrink-0" />}
              {deployedUrls.pages && (
                <>
                  <Zap className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <a href={deployedUrls.pages} target="_blank" rel="noopener noreferrer" className="text-[11px] text-emerald-700 font-medium truncate hover:underline">
                    {deployedUrls.pages.replace(/^https?:\/\//, '')}
                  </a>
                  <a href={deployedUrls.pages} target="_blank" rel="noopener noreferrer" className="w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100 transition flex-shrink-0">
                    <ExternalLink className="w-3 h-3 text-zinc-400" />
                  </a>
                </>
              )}
              {/* ✏️ Edit button — scrolls to chat input and focuses for customization */}
              <span className="flex-1" />
              <button
                onClick={() => {
                  if (inputRef.current) {
                    // Scroll the textarea into view first
                    inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    // Focus after scroll completes
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus()
                        inputRef.current.placeholder = t('ce.live_bar_edit_hint')
                        // Add a visual pulse to highlight the input area
                        const parent = inputRef.current.closest('div.flex')
                        if (parent) {
                          parent.classList.add('ring-2', 'ring-[#C4622D]/40', 'rounded-xl')
                          setTimeout(() => parent.classList.remove('ring-2', 'ring-[#C4622D]/40', 'rounded-xl'), 2000)
                        }
                        // Restore placeholder after a few seconds
                        setTimeout(() => { if (inputRef.current) inputRef.current.placeholder = '' }, 5000)
                      }
                    }, 350)
                  }
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium text-zinc-500 hover:text-[#C4622D] hover:bg-orange-50 transition flex-shrink-0"
                title={t('ce.live_bar_edit')}
              >
                <Pencil className="w-3 h-3" />
                <span>{t('ce.live_bar_edit')}</span>
              </button>
            </div>
          )}

          {/* ═══ PUBLISH PANEL — slide-over drawer ═══ */}
          <AnimatePresence>
            {publishOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="absolute inset-0 z-50 flex justify-end"
              >
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px]" onClick={() => !publishBusy && setPublishOpen(false)} />
                {/* Panel */}
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                  className="relative w-[340px] max-w-full h-full bg-white border-l border-zinc-200 shadow-2xl flex flex-col overflow-hidden"
                >
                  {/* Header */}
                  <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
                        <Rocket className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-semibold text-zinc-900">{t('ce.publish_title')}</h3>
                          {publishProjectType && (
                            <span className={`text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-full ${
                              publishProjectType === 'fullstack'
                                ? 'bg-violet-100 text-violet-700'
                                : 'bg-sky-100 text-sky-700'
                            }`}>
                              {t(`ce.publish_type_${publishProjectType}`)}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-zinc-400">{t('ce.publish_subtitle')}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => !publishBusy && setPublishOpen(false)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Options */}
                  <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">

                    {/* Smart recommendation tip */}
                    {publishProjectType && (
                      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-medium ${
                        publishProjectType === 'fullstack'
                          ? 'bg-violet-50 text-violet-700 border border-violet-100'
                          : 'bg-sky-50 text-sky-700 border border-sky-100'
                      }`}>
                        {publishProjectType === 'fullstack' ? <Server className="w-3.5 h-3.5 flex-shrink-0" /> : <Monitor className="w-3.5 h-3.5 flex-shrink-0" />}
                        <span>{t(`ce.publish_smart_tip_${publishProjectType}`)}</span>
                      </div>
                    )}

                    {/* ⚡ VERCEL DEPLOY — Primary for Full-Stack projects */}
                    {publishProjectType === 'fullstack' && (
                      <button
                        disabled={!!publishBusy}
                        onClick={async () => {
                          if (!armStatus.github?.connected) {
                            alert(t('ce.publish_vercel_needs_github'))
                            return
                          }
                          setPublishBusy('vercel')
                          try {
                            // Step 1: Push to GitHub
                            const res = await fetch('/api/arms/claude-code/github-push', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ sessionId: activeSessionId }),
                            })
                            const data = await res.json()
                            if (data.success && data.repoUrl) {
                              saveDeployedUrl('github', data.repoUrl)
                              // Step 2: Open Vercel import with the repo URL
                              const repoPath = data.repoUrl.replace('https://github.com/', '')
                              const vercelUrl = `https://vercel.com/new/import?s=https://github.com/${repoPath}&framework=nextjs`
                              window.open(vercelUrl, '_blank')
                            } else {
                              alert(data.error || t('ce.publish_error'))
                            }
                          } catch { alert(t('ce.publish_conn_error')) }
                          setPublishBusy(null)
                        }}
                        className={`w-full text-left rounded-2xl border p-4 transition-all group relative overflow-hidden ${
                          armStatus.github?.connected
                            ? 'border-violet-300 bg-gradient-to-br from-violet-50 via-white to-indigo-50 hover:border-violet-500 hover:shadow-xl hover:shadow-violet-100/60 ring-1 ring-violet-200/50'
                            : 'border-zinc-100 bg-zinc-50 opacity-60'
                        }`}
                      >
                        <div className="absolute top-2 right-2 text-[8px] px-2 py-0.5 rounded-full bg-violet-600 text-white font-bold tracking-wider">
                          FULL-STACK
                        </div>
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                            armStatus.github?.connected ? 'bg-black' : 'bg-zinc-200'
                          }`}>
                            <svg className={`w-5 h-5 ${armStatus.github?.connected ? 'text-white' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="currentColor">
                              <path d="M24 22.525H0l12-21.05 12 21.05z" />
                            </svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-zinc-900">{t('ce.publish_vercel')}</span>
                            <p className="text-[11px] text-zinc-500 mt-0.5">{t('ce.publish_vercel_desc')}</p>
                            {armStatus.github?.connected ? (
                              <div className="mt-2 space-y-1">
                                {deployedUrls.github ? (
                                  <p className="text-[10px] text-violet-600 font-medium flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> {t('ce.publish_vercel_ready')}
                                  </p>
                                ) : (
                                  <p className="text-[10px] text-violet-600 font-medium flex items-center gap-1">
                                    <Zap className="w-3 h-3" /> {t('ce.publish_vercel_cta')}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <a href="/dashboard/brazos" className="text-[10px] text-violet-500 font-medium mt-1 flex items-center gap-1 hover:underline">
                                <ArrowUpRight className="w-3 h-3" /> {t('ce.publish_vercel_needs_github')}
                              </a>
                            )}
                          </div>
                          {publishBusy === 'vercel' && <Loader2 className="w-4 h-4 animate-spin text-violet-500 flex-shrink-0" />}
                        </div>
                      </button>
                    )}

                    {/* ⚠ Full-stack warning on static options */}
                    {publishProjectType === 'fullstack' && (
                      <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-800">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[11px] font-bold">{t('ce.publish_fs_warning')}</p>
                          <p className="text-[10px] mt-1 text-amber-600">{locale === 'es' ? 'Las opciones de abajo son solo para sitios estáticos (HTML/CSS/JS).' : 'Options below are for static sites only (HTML/CSS/JS).'}</p>
                        </div>
                      </div>
                    )}

                    {/* ★ OCTOPUS HOSTING — Zero Config, Primary Option */}
                    <button
                      disabled={!!publishBusy}
                      onClick={async () => {
                        setPublishBusy('octopus')
                        try {
                          const res = await fetch('/api/hosted-sites', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: activeSessionId }),
                          })
                          const data = await res.json()
                          if (data.success) {
                            // Use path-based URL as primary (always works, no SSL needed)
                            // Subdomain URL requires wildcard SSL cert — use as secondary
                            const primaryUrl = data.url || data.subdomainUrl
                            saveDeployedUrl('octopus', primaryUrl, { siteId: data.siteId, serverVersion: data.version })
                            window.open(primaryUrl, '_blank')
                          } else {
                            alert(data.error || t('ce.publish_error'))
                          }
                        } catch { alert(t('ce.publish_conn_error')) }
                        setPublishBusy(null)
                      }}
                      className={`w-full text-left rounded-2xl border p-4 transition-all group relative overflow-hidden ${publishProjectType === 'fullstack' ? 'border-zinc-200 bg-zinc-50 opacity-60' : 'border-[#C4622D]/30 bg-gradient-to-br from-orange-50 via-white to-amber-50 hover:border-[#C4622D] hover:shadow-xl hover:shadow-orange-100/60 ring-1 ring-[#C4622D]/20'}`}
                    >
                      <div className="absolute top-2 right-2 text-[8px] px-2 py-0.5 rounded-full bg-[#C4622D] text-white font-bold tracking-wider">
                        {t('ce.publish_octopus_badge')}
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#C4622D] flex items-center justify-center flex-shrink-0 text-lg">
                          🐙
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-900">{t('ce.publish_octopus')}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{t('ce.publish_octopus_desc')}</p>
                          <p className="text-[10px] text-[#C4622D] font-medium mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> {t('ce.publish_octopus_cta')}
                          </p>
                        </div>
                        {publishBusy === 'octopus' && <Loader2 className="w-4 h-4 animate-spin text-[#C4622D] flex-shrink-0" />}
                      </div>
                    </button>

                    {/* ⚡ DEPLOY TO PRODUCTION — GitHub Pages */}
                    <button
                      disabled={!!publishBusy || !armStatus.github?.connected}
                      onClick={async () => {
                        setPublishBusy('production')
                        try {
                          const res = await fetch('/api/arms/claude-code/github-push', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: activeSessionId, production: true }),
                          })
                          const data = await res.json()
                          if (data.success) {
                            if (data.repoUrl) saveDeployedUrl('github', data.repoUrl)
                            if (data.pagesUrl) saveDeployedUrl('pages', data.pagesUrl)
                            window.open(data.pagesUrl || data.repoUrl, '_blank')
                            if (data.pagesError) {
                              alert(t('ce.publish_pages_partial').replace('{error}', data.pagesError))
                            }
                          } else {
                            alert(data.error || t('ce.publish_error'))
                          }
                        } catch { alert(t('ce.publish_conn_error')) }
                        setPublishBusy(null)
                      }}
                      className={`w-full text-left rounded-2xl border p-4 transition-all group relative overflow-hidden ${
                        armStatus.github?.connected
                          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 hover:border-emerald-500 hover:shadow-xl hover:shadow-emerald-100/60 ring-1 ring-emerald-200/50'
                          : 'border-zinc-100 bg-zinc-50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${armStatus.github?.connected ? 'bg-emerald-500' : 'bg-zinc-100'}`}>
                          <Zap className={`w-5 h-5 ${armStatus.github?.connected ? 'text-white' : 'text-zinc-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900">{t('ce.publish_pages')}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{t('ce.publish_pages_desc')}</p>
                          {armStatus.github?.connected ? (
                            <p className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {t('ce.publish_pages_connected')}
                            </p>
                          ) : (
                            <a href="/dashboard/brazos" className="text-[10px] text-emerald-500 font-medium mt-1 flex items-center gap-1 hover:underline">
                              <ArrowUpRight className="w-3 h-3" /> {t('ce.publish_pages_connect')}
                            </a>
                          )}
                        </div>
                        {publishBusy === 'production' && <Loader2 className="w-4 h-4 animate-spin text-emerald-500 flex-shrink-0" />}
                      </div>
                    </button>

                    {/* ⚡ NETLIFY DEPLOY — Push to GitHub then import on Netlify */}
                    <button
                      disabled={!!publishBusy}
                      onClick={async () => {
                        if (!armStatus.github?.connected) {
                          alert(t('ce.publish_netlify_needs_github'))
                          return
                        }
                        setPublishBusy('netlify')
                        try {
                          const res = await fetch('/api/arms/claude-code/github-push', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: activeSessionId }),
                          })
                          const data = await res.json()
                          if (data.success && data.repoUrl) {
                            saveDeployedUrl('github', data.repoUrl)
                            const repoPath = data.repoUrl.replace('https://github.com/', '')
                            const netlifyUrl = `https://app.netlify.com/start/deploy?repository=https://github.com/${repoPath}`
                            window.open(netlifyUrl, '_blank')
                          } else {
                            alert(data.error || t('ce.publish_error'))
                          }
                        } catch { alert(t('ce.publish_conn_error')) }
                        setPublishBusy(null)
                      }}
                      className={`w-full text-left rounded-2xl border p-4 transition-all group relative overflow-hidden ${
                        armStatus.github?.connected
                          ? 'border-teal-300 bg-gradient-to-br from-teal-50 via-white to-cyan-50 hover:border-teal-500 hover:shadow-xl hover:shadow-teal-100/60 ring-1 ring-teal-200/50'
                          : 'border-zinc-100 bg-zinc-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          armStatus.github?.connected ? 'bg-teal-500' : 'bg-zinc-200'
                        }`}>
                          <svg className={`w-5 h-5 ${armStatus.github?.connected ? 'text-white' : 'text-zinc-400'}`} viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.3 21.05H6.7L1.6 3.9h20.8l-5.1 17.15zM12 7.3l-2.6 8.7h5.2L12 7.3z" />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-bold text-zinc-900">{t('ce.publish_netlify')}</span>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{t('ce.publish_netlify_desc')}</p>
                          {armStatus.github?.connected ? (
                            <p className="text-[10px] text-teal-600 font-medium mt-1 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> {t('ce.publish_netlify_cta')}
                            </p>
                          ) : (
                            <a href="/dashboard/brazos" className="text-[10px] text-teal-500 font-medium mt-1 flex items-center gap-1 hover:underline">
                              <ArrowUpRight className="w-3 h-3" /> {t('ce.publish_netlify_needs_github')}
                            </a>
                          )}
                        </div>
                        {publishBusy === 'netlify' && <Loader2 className="w-4 h-4 animate-spin text-teal-500 flex-shrink-0" />}
                      </div>
                    </button>

                    {/* 🚂 RAILWAY DEPLOY — Push to GitHub then import on Railway */}
                    <button
                      disabled={!!publishBusy}
                      onClick={async () => {
                        if (!armStatus.github?.connected) {
                          alert(t('ce.publish_netlify_needs_github'))
                          return
                        }
                        setPublishBusy('railway')
                        try {
                          const res = await fetch('/api/arms/claude-code/github-push', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: activeSessionId }),
                          })
                          const data = await res.json()
                          if (data.success && data.repoUrl) {
                            saveDeployedUrl('github', data.repoUrl)
                            const repoPath = data.repoUrl.replace('https://github.com/', '')
                            const railwayUrl = `https://railway.app/new/github?repo=${repoPath}`
                            window.open(railwayUrl, '_blank')
                          } else {
                            alert(data.error || t('ce.publish_error'))
                          }
                        } catch { alert(t('ce.publish_conn_error')) }
                        setPublishBusy(null)
                      }}
                      className={`w-full text-left rounded-2xl border p-4 transition-all group relative overflow-hidden ${
                        armStatus.github?.connected
                          ? 'border-indigo-200 bg-gradient-to-br from-indigo-50 via-white to-violet-50 hover:border-indigo-400 hover:shadow-xl hover:shadow-indigo-100/60 ring-1 ring-indigo-200/50'
                          : 'border-zinc-100 bg-zinc-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          armStatus.github?.connected ? 'bg-indigo-600' : 'bg-zinc-200'
                        }`}>
                          <Train className={`w-5 h-5 ${armStatus.github?.connected ? 'text-white' : 'text-zinc-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-zinc-900">{t('ce.publish_railway')}</span>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-bold">FULL-STACK</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{t('ce.publish_railway_desc')}</p>
                          {armStatus.github?.connected ? (
                            <p className="text-[10px] text-indigo-600 font-medium mt-1 flex items-center gap-1">
                              <Zap className="w-3 h-3" /> {t('ce.publish_railway_cta')}
                            </p>
                          ) : (
                            <a href="/dashboard/brazos" className="text-[10px] text-indigo-500 font-medium mt-1 flex items-center gap-1 hover:underline">
                              <ArrowUpRight className="w-3 h-3" /> {t('ce.publish_netlify_needs_github')}
                            </a>
                          )}
                        </div>
                        {publishBusy === 'railway' && <Loader2 className="w-4 h-4 animate-spin text-indigo-500 flex-shrink-0" />}
                      </div>
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex-1 border-t border-zinc-100" />
                      <span className="text-[9px] text-zinc-400 font-medium uppercase tracking-wider">{t('ce.publish_other_options')}</span>
                      <div className="flex-1 border-t border-zinc-100" />
                    </div>

                    {/* Hostinger */}
                    <button
                      disabled={!!publishBusy || !armStatus.hostinger?.connected}
                      onClick={async () => {
                        setPublishBusy('hostinger')
                        try {
                          const res = await fetch('/api/arms/claude-code/hostinger-deploy', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: activeSessionId }),
                          })
                          const ct = res.headers.get('content-type') || ''
                          if (ct.includes('application/zip')) {
                            const blob = await res.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url; a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || 'deploy.zip'
                            document.body.appendChild(a); a.click(); document.body.removeChild(a)
                            URL.revokeObjectURL(url)
                            const domain = res.headers.get('x-deploy-domain') || ''
                            if (domain) saveDeployedUrl('hostinger', domain.startsWith('http') ? domain : `https://${domain}`)
                            alert(`📦 ZIP downloaded.\n\n1. Open File Manager → ${domain}\n2. Upload to public_html\n3. Extract ZIP\n\nYour site will be live!`)
                          } else {
                            const data = await res.json()
                            if (data.success && data.method === 'api') {
                              const domainUrl = data.domain?.startsWith('http') ? data.domain : `https://${data.domain}`
                              saveDeployedUrl('hostinger', domainUrl)
                              alert(`✅ Published to ${data.domain}! 🚀`)
                            } else {
                              alert(data.error || t('ce.publish_error'))
                            }
                          }
                        } catch { alert(t('ce.publish_conn_error')) }
                        setPublishBusy(null)
                      }}
                      className={`w-full text-left rounded-2xl border p-4 transition-all group ${
                        armStatus.hostinger?.connected
                          ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-white hover:border-purple-400 hover:shadow-lg hover:shadow-purple-100/50'
                          : 'border-zinc-100 bg-zinc-50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${armStatus.hostinger?.connected ? 'bg-purple-100' : 'bg-zinc-100'}`}>
                          <Globe className={`w-5 h-5 ${armStatus.hostinger?.connected ? 'text-purple-600' : 'text-zinc-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900">{t('ce.publish_hostinger')}</span>
                            {armStatus.hostinger?.connected && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">LIVE</span>}
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{t('ce.publish_hostinger_desc')}</p>
                          {armStatus.hostinger?.connected ? (
                            <p className="text-[10px] text-purple-600 font-medium mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> {armStatus.hostinger.detail}
                            </p>
                          ) : (
                            <a href="/dashboard/brazos" className="text-[10px] text-purple-500 font-medium mt-1 flex items-center gap-1 hover:underline">
                              <ArrowUpRight className="w-3 h-3" /> {t('ce.publish_hostinger_connect')}
                            </a>
                          )}
                        </div>
                        {publishBusy === 'hostinger' && <Loader2 className="w-4 h-4 animate-spin text-purple-500 flex-shrink-0" />}
                      </div>
                    </button>

                    {/* GitHub */}
                    <button
                      disabled={!!publishBusy || !armStatus.github?.connected}
                      onClick={async () => {
                        setPublishBusy('github')
                        try {
                          const res = await fetch('/api/arms/claude-code/github-push', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ sessionId: activeSessionId }),
                          })
                          const data = await res.json()
                          if (data.success) {
                            saveDeployedUrl('github', data.repoUrl)
                            window.open(data.repoUrl, '_blank')
                          } else {
                            alert(data.error || t('ce.publish_error'))
                          }
                        } catch { alert(t('ce.publish_conn_error')) }
                        setPublishBusy(null)
                      }}
                      className={`w-full text-left rounded-2xl border p-4 transition-all group ${
                        armStatus.github?.connected
                          ? 'border-zinc-200 bg-gradient-to-br from-zinc-50 to-white hover:border-zinc-400 hover:shadow-lg hover:shadow-zinc-100/50'
                          : 'border-zinc-100 bg-zinc-50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${armStatus.github?.connected ? 'bg-zinc-900' : 'bg-zinc-100'}`}>
                          <Github className={`w-5 h-5 ${armStatus.github?.connected ? 'text-white' : 'text-zinc-400'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900">{t('ce.publish_github')}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{t('ce.publish_github_desc')}</p>
                          {armStatus.github?.connected ? (
                            <p className="text-[10px] text-zinc-600 font-medium mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-500" /> @{armStatus.github.detail}
                            </p>
                          ) : (
                            <a href="/dashboard/brazos" className="text-[10px] text-zinc-500 font-medium mt-1 flex items-center gap-1 hover:underline">
                              <ArrowUpRight className="w-3 h-3" /> {t('ce.publish_github_connect')}
                            </a>
                          )}
                        </div>
                        {publishBusy === 'github' && <Loader2 className="w-4 h-4 animate-spin text-zinc-500 flex-shrink-0" />}
                      </div>
                    </button>

                    {/* Download ZIP — always available */}
                    <button
                      disabled={!!publishBusy}
                      onClick={() => {
                        setPublishBusy('zip')
                        const a = document.createElement('a')
                        a.href = `/api/arms/claude-code/export?sessionId=${activeSessionId}`
                        a.download = 'project.zip'
                        document.body.appendChild(a); a.click(); document.body.removeChild(a)
                        setTimeout(() => setPublishBusy(null), 1500)
                      }}
                      className={`w-full text-left rounded-2xl border p-4 transition-all ${publishProjectType === 'fullstack' ? 'border-zinc-200 bg-zinc-50 opacity-60' : 'border-zinc-200 bg-gradient-to-br from-sky-50 to-white hover:border-sky-300 hover:shadow-lg hover:shadow-sky-100/50'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-sky-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-zinc-900">{t('ce.publish_zip')}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">{t('ce.publish_zip_badge')}</span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{t('ce.publish_zip_desc')}</p>
                          <p className="text-[10px] text-sky-600 font-medium mt-1">{t('ce.publish_zip_note')}</p>
                        </div>
                        {publishBusy === 'zip' && <Loader2 className="w-4 h-4 animate-spin text-sky-500 flex-shrink-0" />}
                      </div>
                    </button>
                  </div>

                  {/* ── Deployed URLs ── */}
                  {(deployedUrls.github || deployedUrls.hostinger || deployedUrls.pages || deployedUrls.octopus) && (
                    <div className="px-5 pb-3">
                      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                            <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                          </div>
                          <span className="text-xs font-semibold text-zinc-900">{t('ce.publish_deployed_urls')}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">{t('ce.publish_deployed_live')}</span>
                        </div>
                        <div className="space-y-2">
                          {/* Octopus Hosting URL — primary, shown first */}
                          {deployedUrls.octopus && (
                            <div className="flex items-center gap-2 group/url">
                              <span className="w-3.5 h-3.5 flex-shrink-0 text-[11px] leading-none flex items-center justify-center">🐙</span>
                              <a
                                href={deployedUrls.octopus}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-[#C4622D] font-semibold truncate flex-1 hover:underline"
                              >
                                {deployedUrls.octopus.replace(/^https?:\/\//, '')}
                              </a>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyUrl(deployedUrls.octopus!) }}
                                className="opacity-0 group-hover/url:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100"
                                title="Copiar URL"
                              >
                                {copiedUrl === deployedUrls.octopus
                                  ? <Check className="w-3 h-3 text-emerald-600" />
                                  : <Copy className="w-3 h-3 text-zinc-400" />
                                }
                              </button>
                              <a
                                href={deployedUrls.octopus}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover/url:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100"
                                title="Abrir"
                              >
                                <ExternalLink className="w-3 h-3 text-zinc-400" />
                              </a>
                            </div>
                          )}
                          {/* Production URL (GitHub Pages) */}
                          {deployedUrls.pages && (
                            <div className="flex items-center gap-2 group/url">
                              <Zap className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                              <a
                                href={deployedUrls.pages}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-emerald-700 font-semibold truncate flex-1 hover:underline"
                              >
                                {deployedUrls.pages.replace(/^https?:\/\//, '')}
                              </a>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyUrl(deployedUrls.pages!) }}
                                className="opacity-0 group-hover/url:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100"
                                title="Copiar URL"
                              >
                                {copiedUrl === deployedUrls.pages
                                  ? <Check className="w-3 h-3 text-emerald-600" />
                                  : <Copy className="w-3 h-3 text-zinc-400" />
                                }
                              </button>
                              <a
                                href={deployedUrls.pages}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover/url:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100"
                                title="Abrir"
                              >
                                <ExternalLink className="w-3 h-3 text-zinc-400" />
                              </a>
                            </div>
                          )}
                          {deployedUrls.hostinger && (
                            <div className="flex items-center gap-2 group/url">
                              <Globe className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />
                              <a
                                href={deployedUrls.hostinger}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-purple-600 font-medium truncate flex-1 hover:underline"
                              >
                                {deployedUrls.hostinger.replace(/^https?:\/\//, '')}
                              </a>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyUrl(deployedUrls.hostinger!) }}
                                className="opacity-0 group-hover/url:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100"
                                title="Copiar URL"
                              >
                                {copiedUrl === deployedUrls.hostinger
                                  ? <Check className="w-3 h-3 text-emerald-600" />
                                  : <Copy className="w-3 h-3 text-zinc-400" />
                                }
                              </button>
                              <a
                                href={deployedUrls.hostinger}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover/url:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100"
                                title="Abrir"
                              >
                                <ExternalLink className="w-3 h-3 text-zinc-400" />
                              </a>
                            </div>
                          )}
                          {deployedUrls.github && (
                            <div className="flex items-center gap-2 group/url">
                              <Github className="w-3.5 h-3.5 text-zinc-700 flex-shrink-0" />
                              <a
                                href={deployedUrls.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[11px] text-zinc-700 font-medium truncate flex-1 hover:underline"
                              >
                                {deployedUrls.github.replace(/^https?:\/\/github\.com\//, '')}
                              </a>
                              <button
                                onClick={(e) => { e.stopPropagation(); copyUrl(deployedUrls.github!) }}
                                className="opacity-0 group-hover/url:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100"
                                title="Copiar URL"
                              >
                                {copiedUrl === deployedUrls.github
                                  ? <Check className="w-3 h-3 text-emerald-600" />
                                  : <Copy className="w-3 h-3 text-zinc-400" />
                                }
                              </button>
                              <a
                                href={deployedUrls.github}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="opacity-0 group-hover/url:opacity-100 transition-opacity w-5 h-5 rounded flex items-center justify-center hover:bg-emerald-100"
                                title="Abrir"
                              >
                                <ExternalLink className="w-3 h-3 text-zinc-400" />
                              </a>
                            </div>
                          )}
                        </div>
                        {deployedUrls.updatedAt && (
                          <p className="text-[9px] text-zinc-400 mt-2 pt-2 border-t border-emerald-100">
                            {t('ce.publish_last_deploy')}: {new Date(deployedUrls.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── Version History / Rollback ── */}
                  {deployedUrls.octopus && deployedUrls.siteId && (
                    <div className="px-5 pb-3">
                      <button
                        onClick={() => {
                          if (!rollbackOpen) {
                            setRollbackOpen(true)
                            fetchRollbackSnapshots(deployedUrls.siteId!)
                          } else {
                            setRollbackOpen(false)
                          }
                        }}
                        className="w-full flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left hover:bg-zinc-100 transition group"
                      >
                        <History className="w-4 h-4 text-zinc-500 group-hover:text-zinc-700 transition" />
                        <span className="text-xs font-medium text-zinc-700 flex-1">{t('ce.rollback_title')}</span>
                        {deployedUrls.version && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">v{deployedUrls.version}</span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${rollbackOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {rollbackOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 rounded-xl border border-zinc-200 bg-white overflow-hidden">
                              {rollbackLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                </div>
                              ) : rollbackSnapshots.length === 0 ? (
                                <div className="py-5 px-4 text-center">
                                  <p className="text-[11px] text-zinc-400">{t('ce.rollback_no_history')}</p>
                                </div>
                              ) : (
                                <div className="divide-y divide-zinc-100 max-h-[200px] overflow-y-auto">
                                  {rollbackSnapshots.map((snap) => {
                                    const isCurrent = deployedUrls.version === snap.version
                                    const isRestoring = rollbackRestoring === snap.version
                                    const dateStr = new Date(snap.createdAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                                    return (
                                      <div key={snap.version} className={`flex items-center gap-2 px-3 py-2 ${isCurrent ? 'bg-emerald-50/50' : 'hover:bg-zinc-50'} transition`}>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[11px] font-bold text-zinc-800">v{snap.version}</span>
                                            {isCurrent && (
                                              <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold uppercase tracking-wider">{t('ce.rollback_current')}</span>
                                            )}
                                          </div>
                                          <p className="text-[9px] text-zinc-400 mt-0.5">{dateStr} · {t('ce.rollback_files').replace('{n}', String(snap.fileCount))}</p>
                                        </div>
                                        {!isCurrent && (
                                          <button
                                            disabled={!!rollbackRestoring}
                                            onClick={() => performRollback(deployedUrls.siteId!, snap.version)}
                                            className="flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg px-2 py-1.5 transition disabled:opacity-50"
                                          >
                                            {isRestoring ? (
                                              <Loader2 className="w-3 h-3 animate-spin" />
                                            ) : (
                                              <RotateCcw className="w-3 h-3" />
                                            )}
                                            {isRestoring ? t('ce.rollback_restoring') : t('ce.rollback_restore')}
                                          </button>
                                        )}
                                      </div>
                                    )
                                  })}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* ── Analytics ── */}
                  {deployedUrls.octopus && deployedUrls.siteId && (
                    <div className="px-5 pb-3">
                      <button
                        onClick={() => {
                          if (!analyticsOpen) {
                            setAnalyticsOpen(true)
                            fetchAnalytics(deployedUrls.siteId!, analyticsPeriod)
                          } else {
                            setAnalyticsOpen(false)
                          }
                        }}
                        className="w-full flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left hover:bg-zinc-100 transition group"
                      >
                        <BarChart3 className="w-4 h-4 text-zinc-500 group-hover:text-zinc-700 transition" />
                        <span className="text-xs font-medium text-zinc-700 flex-1">{t('ce.analytics_title')}</span>
                        {analyticsData && !analyticsLoading && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center gap-0.5">
                            <Eye className="w-2.5 h-2.5" />
                            {analyticsData.totalViewsAllTime}
                          </span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${analyticsOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {analyticsOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 rounded-xl border border-zinc-200 bg-white overflow-hidden">
                              {analyticsLoading ? (
                                <div className="flex items-center justify-center py-6">
                                  <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                                </div>
                              ) : !analyticsData || analyticsData.totalViewsAllTime === 0 ? (
                                <div className="py-5 px-4 text-center">
                                  <Eye className="w-5 h-5 text-zinc-300 mx-auto mb-1.5" />
                                  <p className="text-[11px] text-zinc-400">{t('ce.analytics_no_data')}</p>
                                </div>
                              ) : (
                                <div className="p-3 space-y-3">
                                  {/* Period selector */}
                                  <div className="flex gap-1">
                                    {(['7d', '30d'] as const).map(p => (
                                      <button
                                        key={p}
                                        onClick={() => { setAnalyticsPeriod(p); fetchAnalytics(deployedUrls.siteId!, p) }}
                                        className={`text-[9px] font-medium px-2 py-1 rounded-md transition ${analyticsPeriod === p ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'}`}
                                      >
                                        {p === '7d' ? '7d' : '30d'}
                                      </button>
                                    ))}
                                  </div>

                                  {/* KPI cards */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-2.5">
                                      <div className="flex items-center gap-1 mb-1">
                                        <Eye className="w-3 h-3 text-blue-500" />
                                        <span className="text-[9px] text-blue-600 font-medium">{t('ce.analytics_views')}</span>
                                      </div>
                                      <p className="text-lg font-bold text-zinc-900 leading-none">{analyticsData.totalViews.toLocaleString()}</p>
                                      <p className="text-[8px] text-zinc-400 mt-0.5">{t('ce.analytics_period').replace('{n}', analyticsPeriod === '7d' ? '7' : '30')}</p>
                                    </div>
                                    <div className="rounded-lg bg-gradient-to-br from-emerald-50 to-white border border-emerald-100 p-2.5">
                                      <div className="flex items-center gap-1 mb-1">
                                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                                        <span className="text-[9px] text-emerald-600 font-medium">{t('ce.analytics_alltime')}</span>
                                      </div>
                                      <p className="text-lg font-bold text-zinc-900 leading-none">{analyticsData.totalViewsAllTime.toLocaleString()}</p>
                                    </div>
                                  </div>

                                  {/* Mini bar chart — views by day */}
                                  {analyticsData.viewsByDay.length > 0 && (
                                    <div>
                                      <p className="text-[9px] text-zinc-500 font-medium mb-1.5">{t('ce.analytics_views')}</p>
                                      <div className="flex items-end gap-[2px] h-[40px]">
                                        {(() => {
                                          const maxCount = Math.max(...analyticsData.viewsByDay.map(d => d.count), 1)
                                          return analyticsData.viewsByDay.map((d, i) => {
                                            const h = Math.max((d.count / maxCount) * 100, 4)
                                            const isToday = i === analyticsData.viewsByDay.length - 1
                                            return (
                                              <div
                                                key={d.date}
                                                className="flex-1 group relative"
                                                title={`${d.date}: ${d.count}`}
                                              >
                                                <div
                                                  className={`w-full rounded-t-sm transition-colors ${isToday ? 'bg-blue-500' : 'bg-blue-200 group-hover:bg-blue-400'}`}
                                                  style={{ height: `${h}%` }}
                                                />
                                              </div>
                                            )
                                          })
                                        })()}
                                      </div>
                                      <div className="flex justify-between mt-0.5">
                                        <span className="text-[7px] text-zinc-300">{analyticsData.viewsByDay[0]?.date.slice(5)}</span>
                                        <span className="text-[7px] text-zinc-400 font-medium">{t('ce.analytics_today')}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Top pages */}
                                  {analyticsData.topPages.length > 0 && (
                                    <div>
                                      <p className="text-[9px] text-zinc-500 font-medium mb-1">{t('ce.analytics_pages')}</p>
                                      <div className="space-y-1">
                                        {analyticsData.topPages.slice(0, 5).map(p => (
                                          <div key={p.path} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-zinc-600 truncate flex-1 font-mono">{p.path || '/'}</span>
                                            <span className="text-[9px] text-zinc-400 font-medium tabular-nums">{p.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Top referrers */}
                                  {analyticsData.topReferrers.length > 0 && (
                                    <div>
                                      <p className="text-[9px] text-zinc-500 font-medium mb-1">{t('ce.analytics_referrers')}</p>
                                      <div className="space-y-1">
                                        {analyticsData.topReferrers.slice(0, 5).map(r => (
                                          <div key={r.referrer} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-zinc-600 truncate flex-1">{r.referrer}</span>
                                            <span className="text-[9px] text-zinc-400 font-medium tabular-nums">{r.count}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Top countries */}
                                  {analyticsData.topCountries.length > 0 && (
                                    <div>
                                      <p className="text-[9px] text-zinc-500 font-medium mb-1">{t('ce.analytics_countries')}</p>
                                      <div className="flex flex-wrap gap-1">
                                        {analyticsData.topCountries.slice(0, 8).map(c => (
                                          <span key={c.country} className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-600">
                                            {c.country} <span className="font-medium text-zinc-800">{c.count}</span>
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* ── Custom Domain ── */}
                  {deployedUrls.octopus && deployedUrls.siteId && (
                    <div className="px-5 pb-3">
                      <button
                        onClick={() => {
                          if (!domainOpen) {
                            setDomainOpen(true)
                            fetchDomainStatus(deployedUrls.siteId!)
                          } else {
                            setDomainOpen(false)
                          }
                        }}
                        className="w-full flex items-center gap-2 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-left hover:bg-zinc-100 transition group"
                      >
                        <Globe2 className="w-4 h-4 text-zinc-500 group-hover:text-zinc-700 transition" />
                        <span className="text-xs font-medium text-zinc-700 flex-1">{t('ce.domain_title')}</span>
                        {domainData?.domain && domainData.status === 'verified' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            SSL
                          </span>
                        )}
                        {domainData?.domain && domainData.status === 'pending' && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">{t('ce.domain_status_pending')}</span>
                        )}
                        <ChevronDown className={`w-3.5 h-3.5 text-zinc-400 transition-transform ${domainOpen ? 'rotate-180' : ''}`} />
                      </button>
                      <AnimatePresence>
                        {domainOpen && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-3 space-y-3">
                              {/* If domain not set — show input */}
                              {!domainData?.domain ? (
                                <div className="space-y-2">
                                  <div className="flex gap-1.5">
                                    <input
                                      type="text"
                                      value={domainInput}
                                      onChange={(e) => setDomainInput(e.target.value.toLowerCase().trim())}
                                      placeholder={t('ce.domain_placeholder')}
                                      className="flex-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-zinc-50 focus:outline-none focus:ring-1 focus:ring-[#C4622D] font-mono"
                                    />
                                    <button
                                      disabled={!domainInput || !!domainLoading}
                                      onClick={() => saveDomain(deployedUrls.siteId!, domainInput)}
                                      className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-[#C4622D] text-white hover:bg-[#B5551F] transition disabled:opacity-50"
                                    >
                                      {domainLoading === 'save' ? t('ce.domain_saving') : t('ce.domain_save')}
                                    </button>
                                  </div>
                                  <p className="text-[9px] text-zinc-400">{t('ce.domain_ssl_pending')}</p>
                                </div>
                              ) : (
                                <div className="space-y-2.5">
                                  {/* Domain display */}
                                  <div className="flex items-center gap-2">
                                    <Globe2 className="w-3.5 h-3.5 text-[#C4622D] flex-shrink-0" />
                                    <span className="text-[11px] font-semibold text-zinc-800 font-mono flex-1 truncate">{domainData.domain}</span>
                                    {domainData.status === 'verified' && (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold flex items-center gap-0.5">
                                        <CheckCircle2 className="w-2.5 h-2.5" /> {t('ce.domain_status_verified')}
                                      </span>
                                    )}
                                    {domainData.status === 'pending' && (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold animate-pulse">{t('ce.domain_status_pending')}</span>
                                    )}
                                    {domainData.status === 'error' && (
                                      <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 font-bold">{t('ce.domain_status_error')}</span>
                                    )}
                                  </div>

                                  {/* CNAME instructions (show if not verified) */}
                                  {domainData.status !== 'verified' && (
                                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5">
                                      <p className="text-[9px] text-amber-800 font-medium mb-1.5">{t('ce.domain_instructions')}</p>
                                      <div className="space-y-1 font-mono text-[10px]">
                                        <div className="flex gap-2">
                                          <span className="text-amber-600 w-[50px] flex-shrink-0">{t('ce.domain_cname_host')}</span>
                                          <span className="text-zinc-800 font-semibold">{domainData.domain}</span>
                                        </div>
                                        <div className="flex gap-2">
                                          <span className="text-amber-600 w-[50px] flex-shrink-0">{t('ce.domain_cname_target')}</span>
                                          <span className="text-zinc-800 font-semibold">octopuskills.com</span>
                                        </div>
                                      </div>
                                      <p className="text-[8px] text-amber-500 mt-1.5">{t('ce.domain_propagation')}</p>
                                    </div>
                                  )}

                                  {/* Verified — show SSL status */}
                                  {domainData.status === 'verified' && (
                                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 flex items-center gap-2">
                                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                      <div>
                                        <p className="text-[10px] font-semibold text-emerald-800">{t('ce.domain_ssl_ok')}</p>
                                        <p className="text-[9px] text-emerald-600">https://{domainData.domain}</p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Action buttons */}
                                  <div className="flex gap-1.5">
                                    {domainData.status !== 'verified' && (
                                      <button
                                        disabled={!!domainLoading}
                                        onClick={() => verifyDomain(deployedUrls.siteId!)}
                                        className="flex items-center gap-1 text-[10px] font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg px-2.5 py-1.5 transition disabled:opacity-50"
                                      >
                                        {domainLoading === 'verify' ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <RefreshCw className="w-3 h-3" />
                                        )}
                                        {domainLoading === 'verify' ? t('ce.domain_verifying') : t('ce.domain_verify')}
                                      </button>
                                    )}
                                    <button
                                      disabled={!!domainLoading}
                                      onClick={() => removeDomain(deployedUrls.siteId!)}
                                      className="flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg px-2.5 py-1.5 transition disabled:opacity-50 ml-auto"
                                    >
                                      {domainLoading === 'remove' ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : (
                                        <X className="w-3 h-3" />
                                      )}
                                      {domainLoading === 'remove' ? t('ce.domain_removing') : t('ce.domain_remove')}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Footer — Web3Forms status */}
                  <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                      <MailCheck className={`w-3.5 h-3.5 ${armStatus.web3forms?.connected ? 'text-emerald-500' : 'text-zinc-300'}`} />
                      <span className="text-[10px] text-zinc-500">
                        {t('ce.publish_forms')}: {armStatus.web3forms?.connected ? (
                          <span className="text-emerald-600 font-medium">Web3Forms {t('ce.publish_forms_active').toLowerCase()} ✓</span>
                        ) : (
                          <a href="/dashboard/brazos" className="text-amber-600 font-medium hover:underline">{t('ce.publish_forms_setup')}</a>
                        )}
                      </span>
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {(rightTab === 'preview' || previewExpanded) ? (
            <>
              {/* Sub-header: file counter + project toggle — hidden in Zen mode */}
              {!previewExpanded && (
                <div className="px-5 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {previewCmd && !projectPreview && (
                      <span className="text-[10px] text-zinc-400">
                        {commands.findIndex((c) => c.id === previewCmd.id) + 1} / {commands.length}
                      </span>
                    )}
                    {projectPreview && (
                      <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                        <Eye className="w-3 h-3" /> {t('ce.project_preview')}
                      </span>
                    )}
                  </div>
                  {commands.filter((c) => ['completed', 'approved', 'executing'].includes(c.status)).length >= 2 && (
                    <button
                      onClick={() => setProjectPreview((v) => !v)}
                      className={`text-[10px] px-2.5 py-1 rounded-full border transition ${
                        projectPreview
                          ? 'bg-zinc-900 text-white border-zinc-900'
                          : 'border-zinc-200 text-zinc-500 hover:border-zinc-400'
                      }`}
                    >
                      {projectPreview ? t('ce.single_file') : t('ce.project_view')}
                    </button>
                  )}
                </div>
              )}
              {/* Preview content area */}
              <div className={`flex-1 min-h-0 relative ${previewExpanded ? 'p-0' : 'px-5 pb-5'}`}>
                {/* Updating overlay */}
                {isExecutingAny && (
                  <div className={`absolute z-10 flex items-center justify-center bg-white/70 backdrop-blur-[2px] pointer-events-none ${previewExpanded ? 'inset-0' : 'inset-x-5 inset-y-0 rounded-2xl'}`}>
                    <div className="flex flex-col items-center gap-2">
                      <div className="relative">
                        <div className="w-8 h-8 rounded-full border-2 border-amber-400 border-t-transparent animate-spin" />
                      </div>
                      <span className="text-[11px] font-medium text-amber-600">{t('ce.preview_updating')}</span>
                    </div>
                  </div>
                )}
                {/* Responsive wrapper — constrains iframe width in expanded mode */}
                <div className={`h-full ${previewExpanded ? 'flex justify-center bg-zinc-100' : ''}`}>
                  <div
                    className={`h-full overflow-auto transition-all duration-300 ease-out ${
                      previewExpanded
                        ? previewDevice === 'desktop'
                          ? 'w-full bg-white'
                          : previewDevice === 'tablet'
                            ? 'bg-white rounded-2xl border border-zinc-200 shadow-lg my-2'
                            : 'bg-white rounded-3xl border-[3px] border-zinc-800 shadow-xl my-2'
                        : 'bg-white rounded-2xl border border-zinc-100 p-4'
                    }`}
                    style={previewExpanded && previewDevice !== 'desktop' ? {
                      width: previewDevice === 'tablet' ? 768 : 375,
                      maxWidth: '100%',
                    } : undefined}
                  >
                    {showRuntimePanel && activeSessionId ? (
                      <iframe
                        src={`/dashboard/claude-code/runtime?sessionId=${activeSessionId}`}
                        className="w-full h-full border-0 rounded-2xl"
                        title="Live Runtime"
                        allow="cross-origin-isolated"
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    ) : (
                      <PreviewPanel command={previewCmd} commands={commands} projectMode={projectPreview} refreshKey={previewRefreshKey} t={t} onRuntimeErrors={handleRuntimeErrors} />
                    )}
                  </div>
                </div>
              </div>
              {/* Status bar — hidden in Zen mode */}
              {!previewExpanded && (
                <div className="px-5 pb-3 text-[10px] text-zinc-400 text-center flex items-center justify-center gap-1.5">
                  {isThinking && <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                  {isThinking ? t('ce.status_live') : t('ce.status_idle')}
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 overflow-y-auto px-5 pb-5">
              {!workspace?.indexed ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                  <FolderTree className="w-8 h-8 text-zinc-300 mb-3" />
                  <p className="text-sm text-zinc-500 mb-1">{t('ce.ws_not_indexed')}</p>
                  <p className="text-xs text-zinc-400">{t('ce.ws_not_indexed_hint')}</p>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  {/* Stats bar */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-medium">
                      <Zap className="w-3 h-3" /> {t('ce.ws_context_active')}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {workspace.fileCount} {t('ce.ws_files')} · {formatSizeUI(workspace.totalSize || 0)}
                    </span>
                  </div>

                  {/* Recent external changes */}
                  {recentChanges.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-400 mb-2">{t('ce.ws_recent_changes')}</div>
                      <div className="space-y-1">
                        {recentChanges.slice(0, 10).map((c) => (
                          <div key={c.id} className="flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white transition">
                            <span className="text-xs">
                              {c.eventType === 'create' ? '🆕' : c.eventType === 'modify' ? '✏️' : c.eventType === 'delete' ? '🗑️' : '🔄'}
                            </span>
                            <span className="text-xs text-zinc-700 truncate flex-1">{c.filePath}</span>
                            <span className="text-[9px] text-zinc-400 flex-shrink-0">
                              {new Date(c.detectedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* File tree */}
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-400 mb-2">{t('ce.ws_file_tree')}</div>
                    <div className="bg-white rounded-xl border border-zinc-100 overflow-hidden">
                      <div className="max-h-[400px] overflow-y-auto py-1">
                        {(workspace.tree || []).slice(0, 100).map((f) => (
                          <div
                            key={f.path}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 transition"
                            style={{ paddingLeft: `${Math.min((f.path.split('/').length - 1) * 12 + 12, 60)}px` }}
                          >
                            {f.isDir ? (
                              <FolderOpen className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                            ) : (
                              <FileText className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                            )}
                            <span className="text-xs text-zinc-700 truncate flex-1">
                              {f.path.split('/').pop()}
                            </span>
                            {!f.isDir && f.size > 0 && (
                              <span className="text-[9px] text-zinc-400 flex-shrink-0">{formatSizeUI(f.size)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Scan info */}
                  <div className="text-[10px] text-zinc-400 text-center pt-2">
                    {t('ce.ws_last_scan')}: {workspace.lastScanAt ? new Date(workspace.lastScanAt).toLocaleTimeString() : '—'}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>


    </div>
  )
}

// strip both octopus-action JSON fences, code fences, and raw unfenced JSON actions from prose
function stripActionAndCodeFences(content: string): string {
  let out = content.replace(/```\s*octopus-action\s*\n[\s\S]*?```/g, '')
  // Keep regular code fences — tinyMarkdown renders them as collapsible blocks
  // Strip raw (unfenced) JSON blocks containing "actions" array
  const actionsIdx = out.indexOf('"actions"')
  if (actionsIdx > 0) {
    // Find the opening { before "actions"
    let openBrace = -1
    for (let i = actionsIdx - 1; i >= 0; i--) {
      if (out[i] === '{') { openBrace = i; break }
      if (out[i] !== ' ' && out[i] !== '\n' && out[i] !== '\r' && out[i] !== '\t') break
    }
    if (openBrace >= 0) {
      let depth = 0; let inStr = false; let esc = false; let closeIdx = -1
      for (let i = openBrace; i < out.length; i++) {
        const ch = out[i]
        if (esc) { esc = false; continue }
        if (ch === '\\' && inStr) { esc = true; continue }
        if (ch === '"' && !esc) { inStr = !inStr; continue }
        if (inStr) continue
        if (ch === '{') depth++
        else if (ch === '}') { depth--; if (depth === 0) { closeIdx = i; break } }
      }
      if (closeIdx > openBrace) {
        out = out.slice(0, openBrace) + out.slice(closeIdx + 1)
      }
    }
  }
  return out.trim()
}

function formatSizeUI(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1048576).toFixed(1)}MB`
}


// Suspense wrapper for useSearchParams compatibility
export default function CodeEnginePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen bg-[#0a0e1a]"><div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#FFD700]" /></div>}>
      <CodeEnginePageInner />
    </Suspense>
  )
}