'use client'

/**
 * WebContainers Runtime — corre Node.js completo en el navegador.
 *
 * Reemplaza el preview estático del Code Engine por un entorno full-stack
 * ejecutable: npm install, Next.js dev, Vite, Express — sin servidores.
 *
 * Requiere: Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy
 * (configurados en next.config.js SOLO para /dashboard/claude-code/runtime).
 *
 * Flujo:
 * 1. Recibe { files, meta } vía props (desde la página runtime) o postMessage
 * 2. Monta el filesystem virtual en el WebContainer
 * 3. Corre `npm install` si hay package.json (con spinner de progreso)
 * 4. Lanza el dev server y captura la URL de localhost del contenedor
 * 5. Muestra la URL en un iframe embebido + terminal con logs en vivo
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { WebContainer, type FileSystemTree, type DirectoryNode, type FileNode } from '@webcontainer/api'
import {
  Terminal as TerminalIcon, Globe, Loader2, RefreshCw,
  CheckCircle, XCircle, PackageOpen, Play, ChevronDown, ChevronUp
} from 'lucide-react'

interface FileMap {
  [path: string]: string
}

interface RuntimeMeta {
  hasPackageJson: boolean
  isNextJs: boolean
  isVite: boolean
  isReact: boolean
  devCmd: string
  fileCount: number
}

interface Props {
  files: FileMap
  meta: RuntimeMeta
  projectName?: string
}

type Phase = 'idle' | 'booting' | 'installing' | 'starting' | 'ready' | 'error'

function termColor(phase: Phase) {
  if (phase === 'ready') return 'text-emerald-400'
  if (phase === 'error') return 'text-red-400'
  return 'text-amber-400'
}

// Convierte flat path map → árbol de directorios para WebContainer
function buildFsTree(files: FileMap): FileSystemTree {
  const tree: FileSystemTree = {}
  for (const [filePath, content] of Object.entries(files)) {
    const parts = filePath.split('/').filter(Boolean)
    let node: FileSystemTree = tree
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!node[part]) {
        node[part] = { directory: {} } as DirectoryNode
      }
      node = (node[part] as DirectoryNode).directory
    }
    const fileName = parts[parts.length - 1]
    node[fileName] = { file: { contents: content } } as FileNode
  }
  return tree
}

// Singleton: solo una instancia de WebContainer por página (limitación de la API)
let wcInstance: WebContainer | null = null
let wcBooting = false

export default function CodeEngineRuntime({ files, meta, projectName }: Props) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [logs, setLogs] = useState<string[]>([])
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [showTerminal, setShowTerminal] = useState(true)
  const [iframeKey, setIframeKey] = useState(0)
  const logsEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef(false)

  const addLog = useCallback((line: string) => {
    setLogs(prev => [...prev.slice(-300), line])
  }, [])

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const boot = useCallback(async () => {
    abortRef.current = false
    setPhase('booting')
    setLogs([])
    setPreviewUrl(null)

    try {
      // Reutiliza la instancia si ya está corriendo
      if (!wcInstance) {
        if (wcBooting) {
          addLog('⏳ Esperando que el contenedor anterior arranque...')
          return
        }
        wcBooting = true
        addLog('🚀 Iniciando WebContainer (Node.js en el navegador)...')
        wcInstance = await WebContainer.boot()
        wcBooting = false
        addLog('✅ Contenedor listo.')
      } else {
        addLog('♻️  Reutilizando contenedor existente.')
      }

      if (abortRef.current) return

      // Montar sistema de archivos
      setPhase('installing')
      addLog(`📂 Montando ${meta.fileCount} archivo(s)...`)
      await wcInstance.mount(buildFsTree(files))
      addLog('✅ Archivos montados.')

      if (abortRef.current) return

      // npm install si hay package.json
      if (meta.hasPackageJson) {
        addLog('📦 Ejecutando npm install...')
        const install = await wcInstance.spawn('npm', ['install', '--prefer-offline', '--no-audit', '--progress=false'])
        install.output.pipeTo(new WritableStream({
          write(chunk) { addLog(chunk.trimEnd()) },
        }))
        const code = await install.exit
        if (code !== 0) {
          addLog(`❌ npm install falló (código ${code})`)
          setPhase('error')
          return
        }
        addLog('✅ Dependencias instaladas.')
      }

      if (abortRef.current) return

      // Lanzar dev server
      setPhase('starting')
      const cmdParts = meta.devCmd.split(' ')
      addLog(`▶  Lanzando: ${meta.devCmd}`)
      const devProcess = await wcInstance.spawn(cmdParts[0], cmdParts.slice(1))

      devProcess.output.pipeTo(new WritableStream({
        write(chunk) { addLog(chunk.trimEnd()) },
      }))

      // Escuchar server-ready event
      wcInstance.on('server-ready', (port, url) => {
        addLog(`🌐 Servidor listo en puerto ${port} → ${url}`)
        setPreviewUrl(url)
        setPhase('ready')
        setIframeKey(k => k + 1)
      })

    } catch (err) {
      wcBooting = false
      wcInstance = null
      const msg = err instanceof Error ? err.message : String(err)
      addLog(`❌ Error: ${msg}`)
      setPhase('error')
    }
  }, [files, meta, addLog])

  // Auto-arrancar al montar
  useEffect(() => {
    boot()
    return () => { abortRef.current = true }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 font-mono text-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900 shrink-0">
        <div className="flex items-center gap-2">
          {phase === 'ready' ? (
            <CheckCircle size={14} className="text-emerald-400" />
          ) : phase === 'error' ? (
            <XCircle size={14} className="text-red-400" />
          ) : (
            <Loader2 size={14} className="animate-spin text-amber-400" />
          )}
          <span className={`font-semibold ${termColor(phase)}`}>
            {phase === 'booting' && 'Arrancando contenedor…'}
            {phase === 'installing' && 'npm install…'}
            {phase === 'starting' && 'Iniciando servidor…'}
            {phase === 'ready' && `Live en ${previewUrl || '…'}`}
            {phase === 'error' && 'Error — ver terminal'}
            {phase === 'idle' && 'Listo'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {phase !== 'ready' && meta.hasPackageJson && (
            <span className="text-zinc-500 flex items-center gap-1">
              <PackageOpen size={12} /> {meta.isNextJs ? 'Next.js' : meta.isVite ? 'Vite' : 'Node'}
            </span>
          )}
          <button
            onClick={boot}
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-700 hover:bg-zinc-600 transition-colors text-zinc-300"
            title="Reiniciar runtime"
          >
            <RefreshCw size={12} />
          </button>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-700 hover:bg-emerald-600 transition-colors text-white"
            >
              <Globe size={12} /> Abrir
            </a>
          )}
        </div>
      </div>

      {/* Preview + Terminal */}
      <div className="flex flex-col flex-1 min-h-0">
        {/* Browser preview iframe */}
        {previewUrl && (
          <div className="flex-1 min-h-0 bg-white">
            <iframe
              key={iframeKey}
              src={previewUrl}
              className="w-full h-full border-0"
              title={projectName || 'Runtime Preview'}
              allow="cross-origin-isolated"
            />
          </div>
        )}

        {/* Terminal drawer */}
        <div
          className={`flex flex-col border-t border-zinc-800 transition-all ${
            previewUrl ? (showTerminal ? 'h-48' : 'h-8') : 'flex-1'
          }`}
        >
          <button
            onClick={() => setShowTerminal(s => !s)}
            className="flex items-center gap-2 px-4 py-1 bg-zinc-900 hover:bg-zinc-800 transition-colors text-zinc-400 shrink-0 text-left"
          >
            <TerminalIcon size={11} />
            <span>Terminal</span>
            {showTerminal ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
          </button>
          {(showTerminal || !previewUrl) && (
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 bg-zinc-950">
              {logs.map((line, i) => (
                <div key={i} className="leading-relaxed text-zinc-300 whitespace-pre-wrap break-all">
                  {line}
                </div>
              ))}
              {(phase === 'installing' || phase === 'starting' || phase === 'booting') && (
                <div className="flex items-center gap-2 text-amber-400 mt-1">
                  <Loader2 size={11} className="animate-spin" />
                  <span>Trabajando…</span>
                </div>
              )}
              <div ref={logsEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Estado inicial — botón de arranque manual */}
      {phase === 'idle' && (
        <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/90">
          <button
            onClick={boot}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold transition-colors"
          >
            <Play size={16} /> Ejecutar en Runtime
          </button>
        </div>
      )}
    </div>
  )
}
