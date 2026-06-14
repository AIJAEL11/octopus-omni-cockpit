'use client'

import { motion } from 'framer-motion'
import { LucideIcon } from 'lucide-react'
import { useInView } from 'react-intersection-observer'
import { useState, useEffect } from 'react'

interface MetricCardProps {
  icon: LucideIcon
  label: string
  value: number
  suffix?: string
}

export function MetricCard({ icon: Icon, label, value, suffix = '' }: MetricCardProps) {
  const [ref, inView] = useInView({ triggerOnce: true })
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    if (inView) {
      const duration = 1000
      const steps = 30
      const increment = value / steps
      let current = 0
      const timer = setInterval(() => {
        current += increment
        if (current >= value) {
          setDisplayValue(value)
          clearInterval(timer)
        } else {
          setDisplayValue(Math.floor(current))
        }
      }, duration / steps)
      return () => clearInterval(timer)
    }
  }, [inView, value])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      className="bg-[#F5F0E8] rounded-2xl p-4 shadow-md hover:shadow-lg transition-all duration-300"
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-[#2D4A3E]/10 rounded-xl">
          <Icon className="w-5 h-5 text-[#2D4A3E]" />
        </div>
        <div>
          <p className="text-sm text-[#1A1A1A]/60">{label}</p>
          <p className="text-2xl font-bold text-[#2D4A3E]">
            {displayValue}{suffix}
          </p>
        </div>
      </div>
    </motion.div>
  )
}
