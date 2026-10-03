import React from 'react'

const VARIANTS = {
    primary:
        'bg-white text-ink-950 hover:bg-white/90 focus-visible:ring-white/40 border-transparent',
    secondary:
        'bg-white/[0.06] text-white border-white/[0.10] hover:bg-white/[0.10] hover:border-white/[0.18] focus-visible:ring-white/40',
    ghost:
        'bg-transparent text-white/70 border-transparent hover:bg-white/[0.06] hover:text-white focus-visible:ring-white/30',
    discipline:
        'bg-[var(--discipline-soft)] text-[var(--discipline-text)] border border-[var(--discipline-border)] hover:bg-[var(--discipline-medium)] hover:border-[var(--discipline-edge)] focus-visible:ring-[var(--discipline-ring)]',
    danger:
        'bg-rose-500/15 text-rose-100 border border-rose-400/30 hover:bg-rose-500/25 focus-visible:ring-rose-400/50',
}

const SIZES = {
    sm: 'h-7 px-3 text-[11.5px] font-medium gap-1.5',
    md: 'h-9 px-4 text-[12.5px] font-semibold gap-2',
    lg: 'h-11 px-5 text-[13.5px] font-semibold gap-2',
}

const Button = React.forwardRef(
    ({ className = '', variant = 'secondary', size = 'md', children, ...props }, ref) => {
        const v = VARIANTS[variant] || VARIANTS.secondary
        const s = SIZES[size] || SIZES.md
        return (
            <button
                ref={ref}
                className={`inline-flex items-center justify-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070a] disabled:pointer-events-none disabled:opacity-50 ${v} ${s} ${className}`}
                {...props}
            >
                {children}
            </button>
        )
    }
)
Button.displayName = 'Button'

export { Button }
