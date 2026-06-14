'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Plus, Building2, Check, Loader2 } from 'lucide-react'
import { useWorkspace } from '@/lib/workspace-context'

export function WorkspaceSelector() {
  const { workspaces, activeWorkspace, isLoading, setActiveWorkspace, createWorkspace } = useWorkspace()
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setIsCreating(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSwitch = async (workspaceId: string) => {
    await setActiveWorkspace(workspaceId)
    setIsOpen(false)
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    const workspace = await createWorkspace({ name: newName.trim() })
    if (workspace) {
      await setActiveWorkspace(workspace.id)
      setNewName('')
      setIsCreating(false)
      setIsOpen(false)
    }
  }

  if (isLoading || !activeWorkspace) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)]">
        <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
        <span className="text-xs text-[var(--text-muted)]">Cargando...</span>
      </div>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-primary)] rounded-xl border border-[var(--border-color)] hover:border-[#FFD700]/50 transition-all"
      >
        {/* Workspace Icon/Logo */}
        <div 
          className="w-6 h-6 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ backgroundColor: activeWorkspace.primaryColor }}
        >
          {activeWorkspace.logo ? (
            <img src={activeWorkspace.logo} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            activeWorkspace.name.charAt(0).toUpperCase()
          )}
        </div>
        
        {/* Name */}
        <span className="text-sm font-medium text-[var(--text-primary)] max-w-[100px] truncate hidden sm:block">
          {activeWorkspace.name}
        </span>
        
        {/* Chevron */}
        <ChevronDown className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </motion.button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-72 bg-[var(--bg-secondary)] rounded-xl border border-[var(--border-color)] shadow-xl z-[9999] overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-[var(--border-color)]">
              <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-3 h-3" />
                Workspaces
              </p>
            </div>

            {/* Workspace List */}
            <div className="max-h-60 overflow-y-auto py-2">
              {workspaces.map((ws) => (
                <button
                  key={ws.id}
                  onClick={() => handleSwitch(ws.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--hover-bg)] transition-colors ${
                    ws.id === activeWorkspace.id ? 'bg-[#FFD700]/10' : ''
                  }`}
                >
                  {/* Icon */}
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: ws.primaryColor }}
                  >
                    {ws.logo ? (
                      <img src={ws.logo} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      ws.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {ws.name}
                    </p>
                    {ws.linkedinUsername && (
                      <p className="text-xs text-[var(--text-muted)] truncate">
                        🔗 {ws.linkedinUsername}
                      </p>
                    )}
                  </div>

                  {/* Active Indicator */}
                  {ws.id === activeWorkspace.id && (
                    <Check className="w-4 h-4 text-[#FFD700] shrink-0" />
                  )}
                  
                  {/* Default Badge */}
                  {ws.isDefault && ws.id !== activeWorkspace.id && (
                    <span className="text-[10px] text-[var(--text-muted)] bg-[var(--bg-primary)] px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Create New */}
            <div className="border-t border-[var(--border-color)] p-3">
              {isCreating ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Nombre del workspace..."
                    className="w-full px-3 py-2 text-sm bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg focus:outline-none focus:border-[#FFD700]/50 text-[var(--text-primary)]"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setIsCreating(false); setNewName('') }}
                      className="flex-1 px-3 py-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-[var(--border-color)] rounded-lg transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleCreate}
                      disabled={!newName.trim()}
                      className="flex-1 px-3 py-2 bg-[#FFD700] text-black rounded-lg text-sm font-medium hover:bg-[#FFD700]/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Crear
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--text-muted)] hover:text-[#FFD700] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Nuevo Workspace
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
