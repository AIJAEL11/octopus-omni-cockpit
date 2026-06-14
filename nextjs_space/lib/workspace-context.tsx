'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

// Tipos
export interface Workspace {
  id: string
  name: string
  slug: string | null
  logo: string | null
  description: string | null
  primaryColor: string
  secondaryColor: string
  accentColor: string | null
  brandVoice: string | null
  linkedinUsername: string | null
  linkedinProfileImage: string | null
  linkedinUserId: string | null
  twitterUsername: string | null
  instagramUsername: string | null
  defaultAvatarId: string | null
  defaultVoiceId: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

interface WorkspaceContextType {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  isLoading: boolean
  error: string | null
  setActiveWorkspace: (workspaceId: string) => Promise<void>
  createWorkspace: (data: Partial<Workspace>) => Promise<Workspace | null>
  updateWorkspace: (workspaceId: string, data: Partial<Workspace>) => Promise<void>
  deleteWorkspace: (workspaceId: string) => Promise<void>
  refreshWorkspaces: () => Promise<void>
}

const WorkspaceContext = createContext<WorkspaceContextType | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || null

  // Cargar workspaces al iniciar
  const refreshWorkspaces = useCallback(async () => {
    try {
      setIsLoading(true)
      const res = await fetch('/api/workspaces')
      if (!res.ok) throw new Error('Error cargando workspaces')
      
      const data = await res.json()
      setWorkspaces(data.workspaces || [])
      setActiveWorkspaceIdState(data.activeWorkspaceId)
      setError(null)
    } catch (err) {
      console.error('[WorkspaceContext] Error:', err)
      setError('Error cargando workspaces')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshWorkspaces()
  }, [refreshWorkspaces])

  // Cambiar workspace activo
  const setActiveWorkspace = useCallback(async (workspaceId: string) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activeWorkspaceId: workspaceId })
      })
      
      if (!res.ok) throw new Error('Error cambiando workspace')
      
      setActiveWorkspaceIdState(workspaceId)
      
      // Log para Jarvis
      const workspace = workspaces.find(w => w.id === workspaceId)
      if (workspace) {
        console.log(`[OCTOPUS] 🔄 Workspace activo: ${workspace.name}`)
      }
    } catch (err) {
      console.error('[WorkspaceContext] Switch error:', err)
      throw err
    }
  }, [workspaces])

  // Crear workspace
  const createWorkspace = useCallback(async (data: Partial<Workspace>) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!res.ok) throw new Error('Error creando workspace')
      
      const { workspace } = await res.json()
      setWorkspaces(prev => [...prev, workspace])
      
      return workspace
    } catch (err) {
      console.error('[WorkspaceContext] Create error:', err)
      return null
    }
  }, [])

  // Actualizar workspace
  const updateWorkspace = useCallback(async (workspaceId: string, data: Partial<Workspace>) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, ...data })
      })
      
      if (!res.ok) throw new Error('Error actualizando workspace')
      
      const { workspace } = await res.json()
      setWorkspaces(prev => prev.map(w => w.id === workspaceId ? workspace : w))
    } catch (err) {
      console.error('[WorkspaceContext] Update error:', err)
      throw err
    }
  }, [])

  // Eliminar workspace
  const deleteWorkspace = useCallback(async (workspaceId: string) => {
    try {
      const res = await fetch(`/api/workspaces?id=${workspaceId}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) throw new Error('Error eliminando workspace')
      
      setWorkspaces(prev => prev.filter(w => w.id !== workspaceId))
      
      // Si era el activo, cambiar al primero disponible
      if (activeWorkspaceId === workspaceId) {
        const remaining = workspaces.filter(w => w.id !== workspaceId)
        if (remaining.length > 0) {
          setActiveWorkspaceIdState(remaining[0].id)
        }
      }
    } catch (err) {
      console.error('[WorkspaceContext] Delete error:', err)
      throw err
    }
  }, [activeWorkspaceId, workspaces])

  return (
    <WorkspaceContext.Provider value={{
      workspaces,
      activeWorkspace,
      isLoading,
      error,
      setActiveWorkspace,
      createWorkspace,
      updateWorkspace,
      deleteWorkspace,
      refreshWorkspaces
    }}>
      {children}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error('useWorkspace debe usarse dentro de WorkspaceProvider')
  }
  return context
}
