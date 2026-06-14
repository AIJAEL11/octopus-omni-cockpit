'use client'

import { forwardRef, InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-3 rounded-2xl bg-white border-2 border-[#2D4A3E]/20',
          'text-[#1A1A1A] placeholder-[#1A1A1A]/50',
          'focus:outline-none focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20',
          'transition-all duration-300',
          className
        )}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
