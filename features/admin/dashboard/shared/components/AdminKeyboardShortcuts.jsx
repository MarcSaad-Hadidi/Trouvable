'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const SHORTCUTS = [
    { keys: ['g', 'd'], label: 'Tableau de bord', href: '/admin' },
    { keys: ['g', 'p'], label: 'Portefeuille', href: '/admin/clients' },
    { keys: ['g', 'n'], label: 'Nouveau mandat', href: '/admin/clients/new' },
    { keys: ['g', 'a'], label: 'Archives', href: '/admin/clients?archived=1' },
];

function isTyping(target) {
    if (!target) return false;
    const tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    return false;
}

export default function AdminKeyboardShortcuts() {
    const router = useRouter();
    const [showHelp, setShowHelp] = useState(false);
    const [prefix, setPrefix] = useState(null);

    const resetPrefix = useCallback(() => setPrefix(null), []);

    useEffect(() => {
        const handler = (event) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (isTyping(event.target)) return;

            const key = event.key.toLowerCase();

            if (key === 'escape') {
                setShowHelp(false);
                resetPrefix();
                return;
            }

            if (key === '?' || (key === '/' && event.shiftKey)) {
                event.preventDefault();
                setShowHelp((prev) => !prev);
                return;
            }

            if (prefix === 'g') {
                const match = SHORTCUTS.find((shortcut) => shortcut.keys[0] === 'g' && shortcut.keys[1] === key);
                if (match) {
                    event.preventDefault();
                    router.push(match.href);
                }
                resetPrefix();
                return;
            }

            if (key === 'g') {
                setPrefix('g');
                window.setTimeout(resetPrefix, 1200);
            }
        };

        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [prefix, resetPrefix, router]);

    if (!showHelp) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/30 backdrop-blur-sm"
            onClick={() => setShowHelp(false)}
        >
            <div
                className="w-full max-w-md rounded-[22px] border border-slate-200 bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.16)]"
                onClick={(event) => event.stopPropagation()}
            >
                <div className="flex items-start justify-between">
                    <div>
                        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Raccourcis clavier</div>
                        <h2 className="mt-2 text-[20px] font-semibold tracking-[-0.02em] text-slate-950">Navigation rapide</h2>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowHelp(false)}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-950"
                    >
                        Esc
                    </button>
                </div>

                <ul className="mt-5 space-y-2.5">
                    {SHORTCUTS.map((shortcut) => (
                        <li
                            key={shortcut.href}
                            className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"
                        >
                            <span className="text-[13px] text-slate-700">{shortcut.label}</span>
                            <span className="flex items-center gap-1">
                                {shortcut.keys.map((key) => (
                                    <kbd
                                        key={key}
                                        className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700"
                                    >
                                        {key.toUpperCase()}
                                    </kbd>
                                ))}
                            </span>
                        </li>
                    ))}
                </ul>

                <div className="mt-5 flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5">
                    <span className="text-[13px] text-slate-700">Ouvrir ce panneau</span>
                    <kbd className="rounded-md border border-slate-200 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
                        ?
                    </kbd>
                </div>

                <p className="mt-4 text-[11px] leading-relaxed text-slate-500">
                    Pressez <span className="font-semibold text-slate-700">G</span> puis la touche correspondante pour naviguer.
                </p>
            </div>
        </div>
    );
}
