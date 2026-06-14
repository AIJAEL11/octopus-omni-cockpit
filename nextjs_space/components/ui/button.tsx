'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none',
  {
    variants: {
      variant: {
        default: 'bg-[#2D4A3E] text-[#F5F0E8] hover:bg-[#3D5A4E] focus:ring-[#2D4A3E]',
        primary: 'bg-[#2D4A3E] text-[#F5F0E8] hover:bg-[#3D5A4E] focus:ring-[#2D4A3E]',
        secondary: 'bg-[#C4622D] text-[#F5F0E8] hover:bg-[#D4723D] focus:ring-[#C4622D]',
        destructive: 'bg-red-500 text-white hover:bg-red-600 focus:ring-red-500',
        outline: 'border-2 border-[#2D4A3E] text-[#2D4A3E] hover:bg-[#2D4A3E] hover:text-[#F5F0E8]',
        ghost: 'text-[#2D4A3E] hover:bg-[#2D4A3E]/10',
        link: 'text-[#2D4A3E] underline-offset-4 hover:underline',
      },
      size: {
        default: 'px-6 py-3 text-base rounded-2xl',
        sm: 'px-4 py-2 text-sm rounded-xl',
        md: 'px-6 py-3 text-base rounded-2xl',
        lg: 'px-8 py-4 text-lg rounded-2xl',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
