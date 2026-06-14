'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useSession } from 'next-auth/react'
import {
  ArrowLeft,
  ArrowRight,
  Rocket,
  Globe,
  Layout,
  AppWindow,
  Target,
  CheckCircle,
  Loader2,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'

const projectTypes = [
  {
    id: 'landing',
    icon: Layout,
    title: 'Landing Page',
    description: 'Página de aterrizaje para captar leads',
  },
  {
    id: 'website',
    icon: Globe,
    title: 'Website',
    description: 'Sitio web completo con múltiples páginas',
  },
  {
    id: 'webapp',
    icon: AppWindow,
    title: 'Web App',
    description: 'Aplicación web con funcionalidades avanzadas',
  },
]

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)
  const [formData, setFormData] = useState({
    projectName: '',
    projectType: '',
    objective: '',
  })
  const router = useRouter()
  const { data: session } = useSession() || {}

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      handleSubmit()
    }
  }

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setCompleted(true)
        setTimeout(() => {
          router.replace('/dashboard')
        }, 2000)
      } else {
        console.error('Failed to save onboarding data')
      }
    } catch (error) {
      console.error('Onboarding error:', error)
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.projectName.trim().length > 0
      case 2:
        return formData.projectType.length > 0
      case 3:
        return formData.objective.trim().length > 0
      default:
        return false
    }
  }

  if (completed) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
            className="w-24 h-24 bg-[#2D4A3E] rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-12 h-12 text-[#F5F0E8]" />
          </motion.div>
          <h1 className="text-3xl font-bold text-[#1A1A1A] mb-4">
            ¡Proyecto Creado!
          </h1>
          <p className="text-[#1A1A1A]/60 mb-2">
            Redirigiendo al dashboard...
          </p>
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#2D4A3E]" />
        </motion.div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 bg-gradient-to-br from-[#2D4A3E] to-[#C4622D] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Rocket className="w-8 h-8 text-[#F5F0E8]" />
        </div>
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Crear Nuevo Proyecto</h1>
        <p className="text-[#1A1A1A]/60">Completa estos pasos para configurar tu proyecto</p>
      </motion.div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {[1, 2, 3].map((s) => (
          <motion.div
            key={s}
            className={`flex items-center`}
            initial={false}
          >
            <motion.div
              animate={{
                backgroundColor: s <= step ? '#2D4A3E' : '#E5E5E5',
                scale: s === step ? 1.1 : 1,
              }}
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
              style={{ color: s <= step ? '#F5F0E8' : '#1A1A1A' }}
            >
              {s < step ? <CheckCircle className="w-5 h-5" /> : s}
            </motion.div>
            {s < 3 && (
              <div
                className="w-16 h-1 mx-2 rounded-full transition-colors"
                style={{ backgroundColor: s < step ? '#2D4A3E' : '#E5E5E5' }}
              />
            )}
          </motion.div>
        ))}
      </div>

      {/* Form Card */}
      <Card variant="elevated" className="relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* Step 1: Project Name */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-[#2D4A3E]/10 rounded-xl">
                  <Sparkles className="w-6 h-6 text-[#2D4A3E]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1A1A1A]">
                    Nombre del Proyecto
                  </h2>
                  <p className="text-sm text-[#1A1A1A]/60">
                    ¿Cómo se llamará tu proyecto?
                  </p>
                </div>
              </div>
              <Input
                placeholder="Ej: Mi Landing Page, App de Ventas..."
                value={formData.projectName}
                onChange={(e) =>
                  setFormData({ ...formData, projectName: e.target.value })
                }
                className="text-lg py-4"
                autoFocus
              />
            </motion.div>
          )}

          {/* Step 2: Project Type */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-[#C4622D]/10 rounded-xl">
                  <Layout className="w-6 h-6 text-[#C4622D]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1A1A1A]">
                    Tipo de Proyecto
                  </h2>
                  <p className="text-sm text-[#1A1A1A]/60">
                    Selecciona el tipo de proyecto que deseas crear
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                {projectTypes.map((type) => (
                  <motion.button
                    key={type.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      setFormData({ ...formData, projectType: type.id })
                    }
                    className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                      formData.projectType === type.id
                        ? 'border-[#2D4A3E] bg-[#2D4A3E]/10'
                        : 'border-[#2D4A3E]/20 hover:border-[#2D4A3E]/40'
                    }`}
                  >
                    <div
                      className={`p-3 rounded-xl ${
                        formData.projectType === type.id
                          ? 'bg-[#2D4A3E] text-[#F5F0E8]'
                          : 'bg-[#2D4A3E]/10 text-[#2D4A3E]'
                      }`}
                    >
                      <type.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-[#1A1A1A]">{type.title}</h3>
                      <p className="text-sm text-[#1A1A1A]/60">
                        {type.description}
                      </p>
                    </div>
                    {formData.projectType === type.id && (
                      <CheckCircle className="w-6 h-6 text-[#2D4A3E] ml-auto" />
                    )}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Step 3: Objective */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-[#2D4A3E]/10 rounded-xl">
                  <Target className="w-6 h-6 text-[#2D4A3E]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1A1A1A]">
                    Objetivo del Proyecto
                  </h2>
                  <p className="text-sm text-[#1A1A1A]/60">
                    Describe brevemente el objetivo principal
                  </p>
                </div>
              </div>
              <Textarea
                placeholder="Ej: Captar 100 leads mensuales, vender mi servicio de consultoría, mostrar mi portafolio..."
                value={formData.objective}
                onChange={(e) =>
                  setFormData({ ...formData, objective: e.target.value })
                }
                className="min-h-[120px]"
                autoFocus
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-[#2D4A3E]/10">
          <Button
            variant="ghost"
            onClick={handleBack}
            disabled={step === 1}
            className={step === 1 ? 'opacity-0' : ''}
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Atrás
          </Button>
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={!canProceed() || loading}
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : step === 3 ? (
              <>
                Crear Proyecto
                <CheckCircle className="w-5 h-5 ml-2" />
              </>
            ) : (
              <>
                Siguiente
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}
