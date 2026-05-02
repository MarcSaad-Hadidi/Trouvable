import React from 'react'

/**
 * Minimal Card primitive used by marketing pages and a few admin spots.
 * Uses concrete tokens (no undefined Tailwind theme keys).
 */
const Card = React.forwardRef(({ className = '', children, ...props }, ref) => (
    <div
        ref={ref}
        className={`rounded-2xl border border-white/10 bg-ink-900/70 text-white shadow-surface backdrop-blur-sm ${className}`}
        {...props}
    >
        {children}
    </div>
))
Card.displayName = 'Card'

const CardContent = React.forwardRef(({ className = '', children, ...props }, ref) => (
    <div ref={ref} className={`p-6 ${className}`} {...props}>
        {children}
    </div>
))
CardContent.displayName = 'CardContent'

export { Card, CardContent }
