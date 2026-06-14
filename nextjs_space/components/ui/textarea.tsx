'use client'

import { forwardRef, TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'w-full px-4 py-3 rounded-2xl bg-white border-2 border-[#2D4A3E]/20',
          'text-[#1A1A1A] placeholder-[#1A1A1A]/50',
          'focus:outline-none focus:border-[#2D4A3E] focus:ring-2 focus:ring-[#2D4A3E]/20',
          'transition-all duration-300 resize-none',
          className
        )}
        {...props}
      />
    )
  }
)

Textarea.displayName = 'Textarea'

export { Textarea }
