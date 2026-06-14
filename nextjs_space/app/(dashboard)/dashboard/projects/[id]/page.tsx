'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Download,
  Loader2,
  FileCode,
  CheckCircle,
  RefreshCw,
  Image as ImageIcon,
  X,
  Pencil,
  Save,
  Trash2,
  Grid3X3,
  Maximize2,
  Upload,
  ImagePlus,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

interface ProjectFile {
  id: string
  name: string
  path: string
  content: string
  fileType: string
}

interface CreativeAsset {
  id: string
  title: string
  content: string  // image URL
  thumbnail: string | null
  type: string
  prompt: string
  createdAt: string
}

interface Project {
  id: string
  name: string
  description: string | null
  projectType: string
  status: string
  progress: number
  files: ProjectFile[]
  creativeAssets: CreativeAsset[]
  agentLogs: Array<{ agentName: string; message: string; status: string }>
}

export default function ProjectDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'gallery' | 'files'>('gallery')
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null)
  const [lightboxImage, setLightboxImage] = useState<CreativeAsset | null>(null)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [saving, setSaving] = useState(false)

  // Upload state
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadCount, setUploadCount] = useState({ done: 0, total: 0 })
  const [dragging, setDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dropZoneRef = useRef<HTMLDivElement>(null)
  const dragCounter = useRef(0)

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  // Core upload function — accepts File[] for reuse
  const uploadFiles = async (fileList: File[]) => {
    if (fileList.length === 0 || !project) return

    const imageFiles = fileList.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    setUploading(true)
    setUploadProgress(0)
    setUploadCount({ done: 0, total: imageFiles.length })

    let completed = 0

    // Upload in parallel batches of 3 for speed
    const batchSize = 3
    for (let i = 0; i < imageFiles.length; i += batchSize) {
      const batch = imageFiles.slice(i, i + batchSize)
      await Promise.all(batch.map(async (file) => {
        try {
          // Step 1: Get presigned URL
          const presignRes = await fetch(`/api/projects/${project.id}/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: file.name, contentType: file.type }),
          })
          if (!presignRes.ok) throw new Error('Failed to get upload URL')
          const { uploadUrl, cloud_storage_path } = await presignRes.json()

          // Step 2: Upload to S3
          const uploadHeaders: Record<string, string> = { 'Content-Type': file.type }
          if (uploadUrl.includes('content-disposition')) {
            uploadHeaders['Content-Disposition'] = 'attachment'
          }
          const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: uploadHeaders,
            body: file,
          })
          if (!uploadRes.ok) throw new Error('Failed to upload to S3')

          // Step 3: Complete — create CreativeAsset
          await fetch(`/api/projects/${project.id}/upload`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cloud_storage_path, fileName: file.name }),
          })

          completed++
          setUploadProgress(Math.round((completed / imageFiles.length) * 100))
          setUploadCount({ done: completed, total: imageFiles.length })
        } catch (err) {
          console.error(`Error uploading ${file.name}:`, err)
          completed++
          setUploadProgress(Math.round((completed / imageFiles.length) * 100))
          setUploadCount({ done: completed, total: imageFiles.length })
        }
      }))
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
    setUploadProgress(0)
    setUploadCount({ done: 0, total: 0 })
    fetchProject()
  }

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    await uploadFiles(Array.from(files))
  }

  // Drag & Drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current++
    if (e.dataTransfer.types.includes('Files')) {
      setDragging(true)
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    dragCounter.current--
    if (dragCounter.current === 0) {
      setDragging(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragging(false)
    dragCounter.current = 0

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      await uploadFiles(files)
    }
  }

  useEffect(() => {
    fetchProject()
  }, [params.id])

  const fetchProject = async () => {
    try {
      const res = await fetch(`/api/projects/${params.id}`)
      if (!res.ok) {
        router.push('/dashboard/projects')
        return
      }
      const data = await res.json()
      setProject(data.project)
      setEditName(data.project?.name || '')
      setEditDesc(data.project?.description || '')
      if (data.project?.files?.length > 0) {
        setSelectedFile(data.project.files[0])
      }
      // Auto-select best tab
      if (data.project?.creativeAssets?.length > 0) {
        setActiveTab('gallery')
      } else if (data.project?.files?.length > 0) {
        setActiveTab('files')
      } else {
        setActiveTab('gallery')
      }
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveEdits = async () => {
    if (!project) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName, description: editDesc }),
      })
      if (res.ok) {
        setProject(prev => prev ? { ...prev, name: editName, description: editDesc } : null)
        setEditing(false)
      }
    } catch (err) {
      console.error('Error saving:', err)
    } finally {
      setSaving(false)
    }
  }

  const removeAssetFromProject = async (assetId: string) => {
    try {
      await fetch('/api/ad-factory/save-to-project', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assetId, action: 'remove' }),
      })
      setProject(prev => prev ? {
        ...prev,
        creativeAssets: prev.creativeAssets.filter(a => a.id !== assetId),
      } : null)
    } catch (err) {
      console.error('Error removing asset:', err)
    }
  }

  // No preview render needed — this page focuses on asset organization

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D4A3E]" />
      </div>
    )
  }

  if (!project) {
    return (
      <Card className="text-center py-16">
        <h3 className="text-xl font-bold text-[#1A1A1A]">Proyecto no encontrado</h3>
        <Link href="/dashboard/projects"><Button className="mt-4">Volver a Proyectos</Button></Link>
      </Card>
    )
  }

  const totalAssets = project.creativeAssets?.length || 0
  const totalFiles = project.files?.length || 0

  return (
    <div className="space-y-6">
      {/* Hidden file input for uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/projects">
              <Button variant="ghost" className="p-2"><ArrowLeft className="w-5 h-5" /></Button>
            </Link>
            {editing ? (
              <div className="flex-1 space-y-2">
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="text-2xl font-bold text-[#1A1A1A] bg-transparent border-b-2 border-[#C4622D] outline-none w-full"
                  autoFocus
                />
                <input
                  value={editDesc}
                  onChange={e => setEditDesc(e.target.value)}
                  placeholder="Descripción del proyecto..."
                  className="text-sm text-[#1A1A1A]/60 bg-transparent border-b border-[#2D4A3E]/20 outline-none w-full"
                />
              </div>
            ) : (
              <div>
                <h1 className="text-2xl font-bold text-[#1A1A1A]">{project.name}</h1>
                <p className="text-[#1A1A1A]/60 text-sm">
                  {project.description || 'Sin descripción'}
                </p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={() => { setEditing(false); setEditName(project.name); setEditDesc(project.description || '') }}>
                  <X className="w-4 h-4 mr-1" /> Cancelar
                </Button>
                <Button onClick={saveEdits} disabled={saving} className="bg-[#C4622D] hover:bg-[#A54D20] text-white">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                  Guardar
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar
                </Button>
                <Button variant="outline" onClick={fetchProject}>
                  <RefreshCw className="w-4 h-4 mr-2" /> Actualizar
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats bar */}
      <div className="flex gap-4">
        {totalAssets > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#C4622D]/10 rounded-xl">
            <ImageIcon className="w-4 h-4 text-[#C4622D]" />
            <span className="text-sm font-medium text-[#C4622D]">{totalAssets} imagen{totalAssets !== 1 ? 'es' : ''}</span>
          </div>
        )}
        {totalFiles > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-[#2D4A3E]/10 rounded-xl">
            <FileCode className="w-4 h-4 text-[#2D4A3E]" />
            <span className="text-sm font-medium text-[#2D4A3E]">{totalFiles} archivo{totalFiles !== 1 ? 's' : ''}</span>
          </div>
        )}
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-xl">
          <CheckCircle className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium text-green-600">Activo</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('gallery')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
            activeTab === 'gallery' ? 'bg-[#C4622D] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          <Grid3X3 className="w-4 h-4" /> Imágenes {totalAssets > 0 ? `(${totalAssets})` : ''}
        </button>
        {totalFiles > 0 && (
          <button
            onClick={() => setActiveTab('files')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              activeTab === 'files' ? 'bg-[#2D4A3E] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            <FileCode className="w-4 h-4" /> Archivos ({totalFiles})
          </button>
        )}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {/* GALLERY TAB */}
        {activeTab === 'gallery' && (
          <motion.div
            key="gallery"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            ref={dropZoneRef}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="relative"
          >
            {/* Drag overlay */}
            <AnimatePresence>
              {dragging && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 z-40 bg-[#C4622D]/10 backdrop-blur-sm border-2 border-dashed border-[#C4622D] rounded-2xl flex flex-col items-center justify-center pointer-events-none"
                >
                  <motion.div
                    initial={{ scale: 0.8 }}
                    animate={{ scale: 1 }}
                    className="bg-[#1A2332] rounded-3xl p-8 shadow-2xl border border-[#C4622D]/40 flex flex-col items-center gap-4"
                  >
                    <div className="w-20 h-20 rounded-full bg-[#C4622D]/20 flex items-center justify-center">
                      <Upload className="w-10 h-10 text-[#C4622D]" />
                    </div>
                    <p className="text-xl font-bold text-white">Suelta las imágenes aquí</p>
                    <p className="text-sm text-gray-400">JPG, PNG, WebP — múltiples archivos</p>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Upload progress bar */}
            {uploading && (
              <div className="mb-4 bg-[#1A2332] rounded-xl p-4 border border-[#C4622D]/30">
                <div className="flex items-center gap-3 mb-2">
                  <Loader2 className="w-5 h-5 text-[#C4622D] animate-spin" />
                  <span className="text-white text-sm font-medium">
                    Subiendo {uploadCount.done}/{uploadCount.total} imágenes... {uploadProgress}%
                  </span>
                </div>
                <div className="w-full bg-[#0F1419] rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-[#C4622D] to-[#FFD700] h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {/* Upload card — click or drag */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="group cursor-pointer"
                onClick={handleUploadClick}
              >
                <Card className={`overflow-hidden !p-0 bg-[#1A2332] border-dashed border-2 transition-all hover:shadow-lg ${
                  dragging ? 'border-[#C4622D] bg-[#C4622D]/5' : 'border-[#2D4A3E]/30 hover:border-[#C4622D]/60'
                }`}>
                  <div className="aspect-square flex flex-col items-center justify-center gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-[#C4622D]/10 flex items-center justify-center group-hover:bg-[#C4622D]/20 transition-colors">
                      <ImagePlus className="w-7 h-7 text-[#C4622D]" />
                    </div>
                    <div className="text-center px-4">
                      <p className="text-sm font-medium text-white/80">Subir imágenes</p>
                      <p className="text-[10px] text-gray-500 mt-1">Click o arrastra aquí</p>
                      <p className="text-[10px] text-gray-600 mt-0.5">JPG, PNG, WebP</p>
                    </div>
                  </div>
                </Card>
              </motion.div>

              {project.creativeAssets.map((asset, idx) => (
                <motion.div
                  key={asset.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group relative"
                >
                  <Card className="overflow-hidden !p-0 bg-[#1A2332] border-[#2D4A3E]/20 hover:border-[#C4622D]/40 transition-all hover:shadow-lg">
                    {/* Image */}
                    <div className="aspect-square relative bg-[#0F1419] cursor-pointer" onClick={() => setLightboxImage(asset)}>
                      <img
                        src={asset.content}
                        alt={asset.title}
                        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Maximize2 className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-3">
                      <p className="text-xs text-white font-medium truncate">{asset.title}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[10px] text-gray-500">
                          {new Date(asset.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex items-center gap-1">
                          <a
                            href={asset.content}
                            download={`${asset.title}.png`}
                            className="text-gray-400 hover:text-white transition-colors p-1"
                            onClick={e => e.stopPropagation()}
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); removeAssetFromProject(asset.id) }}
                            className="text-gray-500 hover:text-red-400 transition-colors p-1"
                            title="Quitar del proyecto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))}
            </div>

            {project.creativeAssets.length === 0 && (
              <Card className="text-center py-16 mt-4">
                <ImageIcon className="w-12 h-12 text-[#1A1A1A]/20 mx-auto mb-4" />
                <p className="text-[#1A1A1A]/50">No hay más imágenes en este proyecto</p>
                <div className="flex items-center justify-center gap-3 mt-4">
                  <Button onClick={handleUploadClick} className="bg-[#C4622D] hover:bg-[#A54D20] text-white">
                    <Upload className="w-4 h-4 mr-2" /> Subir desde tu PC
                  </Button>
                  <Link href="/dashboard/ad-factory">
                    <Button variant="outline">
                      Ir a Ad Factory
                    </Button>
                  </Link>
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* FILES TAB */}
        {activeTab === 'files' && (
          <motion.div key="files" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-4 gap-6">
            <Card className="col-span-1">
              <h3 className="font-bold text-[#1A1A1A] mb-4">Archivos</h3>
              <div className="space-y-2">
                {project.files.map(file => (
                  <button
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full text-left px-3 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                      selectedFile?.id === file.id ? 'bg-[#2D4A3E] text-white' : 'hover:bg-gray-100'
                    }`}
                  >
                    <FileCode className="w-4 h-4" />
                    <span className="text-sm truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            </Card>
            <Card className="col-span-3">
              {selectedFile ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-[#1A1A1A]">{selectedFile.name}</h3>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">{selectedFile.fileType}</span>
                  </div>
                  <pre className="bg-[#1A1A1A] text-[#F5F0E8] p-4 rounded-xl overflow-auto max-h-[500px] text-sm">
                    <code>{selectedFile.content}</code>
                  </pre>
                </>
              ) : (
                <p className="text-gray-500">Selecciona un archivo para ver su contenido</p>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-1 text-sm"
              >
                <X className="w-5 h-5" /> ESC
              </button>
              <img
                src={lightboxImage.content}
                alt={lightboxImage.title}
                className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl"
              />
              <div className="flex items-center justify-between mt-3">
                <div>
                  <span className="text-white font-medium">{lightboxImage.title}</span>
                  <p className="text-xs text-white/40 mt-1 max-w-md truncate">{lightboxImage.prompt}</p>
                </div>
                <a
                  href={lightboxImage.content}
                  download={`${lightboxImage.title}.png`}
                  className="flex items-center gap-2 px-3 py-1.5 bg-[#C4622D] hover:bg-[#B5571F] text-white text-sm rounded-lg transition-colors"
                  onClick={e => e.stopPropagation()}
                >
                  <Download className="w-4 h-4" /> Descargar
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
