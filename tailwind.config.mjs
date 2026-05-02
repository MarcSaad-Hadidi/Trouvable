import animate from 'tailwindcss-animate'

/**
 * Trouvable Tailwind theme.
 *
 * Design tokens reference CSS variables defined in
 * `features/admin/dashboard/shared/admin-shell.css`. This keeps a
 * single runtime palette swappable per `data-discipline`.
 *
 * preflight remains disabled — the project ships its own reset
 * via `app/globals.css` and the marketing site relies on it.
 */
/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './app/**/*.{js,ts,jsx,tsx,mdx}',
        './components/**/*.{js,ts,jsx,tsx,mdx}',
        './features/**/*.{js,ts,jsx,tsx,mdx}',
        './src/**/*.{js,ts,jsx,tsx,mdx}',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                display: ['var(--font-plus-jakarta-sans)', 'var(--font-inter)', 'sans-serif'],
                mono: [
                    'var(--font-jetbrains-mono)',
                    'ui-monospace',
                    'SFMono-Regular',
                    'Menlo',
                    'Monaco',
                    'monospace',
                ],
            },
            colors: {
                /* Neutral ink scale — single source of truth */
                ink: {
                    50: '#f8fafc',
                    100: '#e2e4ea',
                    200: '#9a9ba0',
                    300: '#5a5b60',
                    400: '#3a3b3f',
                    500: '#2c2d31',
                    600: '#222326',
                    700: '#1a1b1e',
                    800: '#131416',
                    900: '#0d0e10',
                    950: '#060607',
                },
                /* SEO Ops — Field grammar */
                cobalt: {
                    50: '#eef3ff',
                    100: '#dde7ff',
                    200: '#b8ccff',
                    300: '#8fafff',
                    400: '#6e93ff',
                    500: '#5b8def',
                    600: '#4870d6',
                    700: '#3a59b0',
                    800: '#2c4385',
                    900: '#1d2c5e',
                    950: '#0a1226',
                },
                /* GEO Ops — Atmosphere grammar */
                aurora: {
                    50: '#faf5ff',
                    100: '#f3e8ff',
                    200: '#e9d5ff',
                    300: '#d8b4fe',
                    400: '#c084fc',
                    500: '#a855f7',
                    600: '#9333ea',
                    700: '#7c3aed',
                    800: '#5b21b6',
                    900: '#3b0a78',
                    950: '#15091e',
                },
                /* AGENT Ops — Forge grammar */
                ember: {
                    50: '#fff8eb',
                    100: '#fef0c7',
                    200: '#fcdf89',
                    300: '#fac74b',
                    400: '#fbbf24',
                    500: '#f59e0b',
                    600: '#d97706',
                    700: '#b45309',
                    800: '#823e07',
                    900: '#44260a',
                    950: '#1c1108',
                },
                /* Status semantics */
                signal: {
                    ok: '#34d399',
                    warn: '#fbbf24',
                    crit: '#fb7185',
                    info: '#60a5fa',
                },
            },
            borderRadius: {
                '2xs': '4px',
                xs: '6px',
                sm: '8px',
                md: '12px',
                lg: '16px',
                xl: '20px',
                '2xl': '24px',
                '3xl': '28px',
                '4xl': '32px',
            },
            boxShadow: {
                surface: '0 18px 44px rgba(0,0,0,0.34)',
                'surface-elevated': '0 28px 72px rgba(0,0,0,0.42)',
                'surface-deep': '0 40px 96px rgba(0,0,0,0.55)',
                'edge-cobalt': '0 0 28px rgba(91,141,239,0.18)',
                'edge-aurora': '0 0 28px rgba(168,85,247,0.22)',
                'edge-ember': '0 0 28px rgba(245,158,11,0.18)',
                'inset-line': 'inset 0 1px 0 rgba(255,255,255,0.06)',
                'inset-ring': 'inset 0 0 0 1px rgba(255,255,255,0.05)',
            },
            keyframes: {
                fadeUp: {
                    from: { opacity: '0', transform: 'translateY(24px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                cmdSlideUp: {
                    from: { opacity: '0', transform: 'translateY(10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                cmdFadeIn: {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
                cmdGlowPulse: {
                    '0%, 100%': { opacity: '0.55' },
                    '50%': { opacity: '1' },
                },
                disciplineDrift: {
                    '0%, 100%': { transform: 'translate3d(0, 0, 0)' },
                    '50%': { transform: 'translate3d(0, -3px, 0)' },
                },
                disciplinePulse: {
                    '0%, 100%': { opacity: '1', transform: 'scale(1)' },
                    '50%': { opacity: '0.78', transform: 'scale(0.96)' },
                },
                disciplineSweep: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' },
                },
                heartbeat: {
                    '0%, 100%': { transform: 'scale(1)', opacity: '0.92' },
                    '12%': { transform: 'scale(1.08)', opacity: '1' },
                    '24%': { transform: 'scale(0.96)', opacity: '0.85' },
                    '36%': { transform: 'scale(1.04)', opacity: '0.94' },
                },
                ticker: {
                    '0%': { transform: 'translateY(0%)' },
                    '100%': { transform: 'translateY(-100%)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
            },
            animation: {
                'fade-up': 'fadeUp 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
                'cmd-slide-up': 'cmdSlideUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
                'cmd-fade-in': 'cmdFadeIn 0.35s ease both',
                'cmd-glow': 'cmdGlowPulse 2.5s ease-in-out infinite',
                'discipline-drift': 'disciplineDrift 6s ease-in-out infinite',
                'discipline-pulse': 'disciplinePulse 2.4s ease-in-out infinite',
                'discipline-sweep': 'disciplineSweep 2.4s linear infinite',
                heartbeat: 'heartbeat 1.4s ease-in-out infinite',
                ticker: 'ticker 22s linear infinite',
                shimmer: 'shimmer 2.4s linear infinite',
            },
            backgroundImage: {
                'field-grid':
                    'repeating-linear-gradient(90deg, transparent, transparent 119px, rgba(91, 141, 239, 0.025) 119px, rgba(91, 141, 239, 0.025) 120px), repeating-linear-gradient(0deg, transparent, transparent 119px, rgba(91, 141, 239, 0.025) 119px, rgba(91, 141, 239, 0.025) 120px)',
                'aurora-wash':
                    'radial-gradient(70% 50% at 0% 0%, rgba(168, 85, 247, 0.10), transparent 55%), radial-gradient(60% 40% at 100% 100%, rgba(244, 114, 182, 0.06), transparent 60%)',
                'forge-bed':
                    'radial-gradient(50% 40% at 50% 0%, rgba(245, 158, 11, 0.06), transparent 60%), linear-gradient(180deg, rgba(28, 18, 8, 0.4) 0%, transparent 35%)',
            },
            transitionTimingFunction: {
                'crisp-out': 'cubic-bezier(0.22, 1, 0.36, 1)',
                'drift-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
                'mech-step': 'steps(6, end)',
            },
        },
    },
    corePlugins: {
        preflight: false,
    },
    plugins: [animate],
}
