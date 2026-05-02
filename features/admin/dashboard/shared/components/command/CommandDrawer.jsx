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
    evidenceSections = null,
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
                        className="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
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
                        className={cn(COMMAND_SURFACE, 'fixed inset-y-4 right-4 z-50 flex w-[min(600px,calc(100vw-2rem))] flex-col overflow-hidden')}
                        variants={commandDrawer}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                    >
                        <div className={cn('relative flex flex-col border-b border-slate-200 p-6 sm:p-8', toneMeta.panel)}>
                            <div className="flex items-start justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Panneau de preuve</div>
                                    <h2 className="text-[24px] font-semibold leading-tight text-slate-950">{title}</h2>
                                </div>
                                <button 
                                    type="button" 
                                    onClick={onClose} 
                                    className="group flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition-all hover:bg-slate-50 hover:text-slate-950"
                                    title="Fermer"
                                >
                                    <X className="h-5 w-5 transition-transform group-hover:rotate-90" />
                                </button>
                            </div>
                            {subtitle ? (
                                <p className="mt-4 max-w-[90%] text-[14px] leading-relaxed text-slate-600">
                                    {subtitle}
                                </p>
                            ) : null}
                        </div>
                        <div className="flex-1 overflow-y-auto px-6 py-8 sm:px-8">
                            <div className="mx-auto max-w-2xl space-y-8">
                                {children}
                                {evidenceSections ? (
                                    <div className="grid gap-3 text-[12px] text-slate-600">
                                        {evidenceSections.map((section) => (
                                            <section key={section.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">{section.label}</div>
                                                {section.content ? <div className="mt-2">{section.content}</div> : null}
                                            </section>
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        {footer ? (
                            <div className="border-t border-slate-200 bg-slate-50 p-6 sm:p-8">
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
