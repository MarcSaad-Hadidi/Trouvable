'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

import { commandDrawer, commandFade } from './motion';
import { COMMAND_BUTTONS, COMMAND_SURFACE, cn, getToneMeta } from './tokens';

export default function CommandDrawer({
    open,
    title,
    subtitle = null,
    tone = 'neutral',
    onClose,
    children,
    footer = null,
}) {
    const toneMeta = getToneMeta(tone);

    useEffect(() => {
        if (!open) return undefined;
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        function handleEscape(event) {
            if (event.key === 'Escape') onClose?.();
        }

        window.addEventListener('keydown', handleEscape);

        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener('keydown', handleEscape);
        };
    }, [open, onClose]);

    return (
        <AnimatePresence>
            {open ? (
                <>
                    <motion.button
                        type="button"
                        aria-label="Fermer le panneau de preuve"
                        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                        variants={commandFade}
                        initial="hidden"
                        animate="visible"
                        exit="hidden"
                        onClick={onClose}
                    />
                    <motion.aside
                        role="dialog"
                        aria-modal="true"
                        aria-label={title}
                        className={cn(COMMAND_SURFACE, 'fixed inset-y-4 right-4 z-50 flex w-[min(600px,calc(100vw-2rem))] flex-col overflow-hidden border-white/[0.10] shadow-[0_32px_80px_rgba(0,0,0,0.5)]')}
                        variants={commandDrawer}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <div className={cn('relative flex flex-col border-b border-white/[0.08] p-6 sm:p-8', toneMeta.panel)}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/30">Panneau de preuve</div>
                                    <h2 className="text-[24px] font-semibold tracking-[-0.03em] text-white leading-tight">{title}</h2>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="group flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition-all hover:bg-white/10 hover:text-white"
                                    title="Fermer"
                                >
                                    <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
                                </button>
                            </div>
                            {subtitle ? (
                                <p className="mt-4 text-[14px] leading-relaxed text-white/50 max-w-[90%]">
                                    {subtitle}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                            <div className="mx-auto max-w-2xl space-y-8">
                                {children}
                            </div>
                        </div>
                        {footer ? (
                            <div className="border-t border-white/[0.08] bg-black/20 p-6 sm:p-8">
                                <div className="mx-auto max-w-2xl">
                                    {footer}
                                </div>
                            </div>
                        ) : null}
                    </motion.aside>
                </>
            ) : null}
        </AnimatePresence>
    );
}
