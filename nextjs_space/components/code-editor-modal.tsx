'use client'

/**
 * Monaco Editor Modal — edición manual de archivos del Code Engine.
 *
 * Fase 3. Permite al usuario editar a mano cualquier archivo que el AI generó
 * y guardarlo de vuelta en la sesión (se persiste como BridgeCommand write_file,
 * igual que la salida del LLM). Así el runtime de WebContainers recoge el cambio.
 *
 * Monaco se carga dinámicamente (ssr:false) para no inflar el bundle ni romper
 * el SSR. El editor es full-screen con Ctrl/Cmd+S para guardar.
 */

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
      Cargando editor…
    </div>
  ),
})

/** Mapea extensión → lenguaje de Monaco. */
function languageFor(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', css: 'css', scss: 'scss', html: 'html', htm: 'html',
    md: 'markdown', markdown: 'markdown', py: 'python', go: 'go', rs: 'rust',
    yml: 'yaml', yaml: 'yaml', sql: 'sql', sh: 'shell', prisma: 'prisma',
  }
  return map[ext] || 'plaintext'
}

export interface CodeEditorModalProps {
  sessionId: string
  path: string
  initialContent: string
  onClose: () => void
  /** Se llama tras guardar con éxito; el padre suele refrescar los comandos. */
  onSaved?: (path: string, content: string) => void
}

export default function CodeEditorModal({
  sessionId, path, initialContent, onClose, onSaved,
}: CodeEditorModalProps) {
  const [value, setValue] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const dirty = value !== initialContent

  const save = useCallback(async () => {
    if (saving) return
    setSaving(true); setError('')
    try {
      const r = await fetch('/api/arms/claude-code/save-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, path, content: value }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        setError(d.error || 'No se pudo guardar')
        setSaving(false)
        return
      }
      onSaved?.(path, value)
      onClose()
    } catch {
      setError('Error de red al guardar')
      setSaving(false)
    }
  }, [saving, sessionId, path, value, onSaved, onClose])

  // Atajos: Cmd/Ctrl+S guarda, Esc cierra.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault(); save()
      } else if (e.key === 'Escape' && !saving) {
        onClose()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save, onClose, saving])

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950/95 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-violet-400">✎</span>
          <span className="truncate font-mono text-sm text-zinc-200">{path}</span>
          {dirty && <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">sin guardar</span>}
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <button
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40 hover:bg-violet-500 transition"
          >
            {saving ? 'Guardando…' : 'Guardar (⌘S)'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
      {/* Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          height="100%"
          theme="vs-dark"
          language={languageFor(path)}
          value={value}
          onChange={(v) => setValue(v ?? '')}
          options={{
            fontSize: 13,
            minimap: { enabled: true },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 2,
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  )
}
