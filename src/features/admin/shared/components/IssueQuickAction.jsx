'use client';

import { Sparkles, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { buildCorrectionPromptsHref, useIssueHandoff } from '@/features/admin/shared/context/IssueHandoffContext';
import { normalizeProblemRef } from '@/lib/correction-prompts/problem-ref';

/**
 * IssueQuickAction — bouton unique réutilisé sur chaque surface émettant
 * un problème/issue/finding/opportunité.
 *
 * Accepte un `ref` (ProblemRef) et déclenche l'ouverture du drawer universel.
 * Mode optionnel `navigate` pour basculer sur la page prompts complète.
 *
 * Props :
 *   - ref : ProblemRef
 *   - label : libellé du bouton (défaut « Générer prompt »)
 *   - variant : 'primary' | 'ghost' | 'inline'
 *   - mode : 'drawer' (défaut) | 'navigate'
 *   - size : 'xs' | 'sm' (défaut 'sm')
 */

const VARIANT_CLASSES = {
    primary:
        'border-violet-400/30 bg-gradient-to-r from-violet-500/20 to-violet-500/10 text-violet-100 hover:from-violet-500/30 hover:to-violet-500/20',
    ghost: 'border-white/[0.08] bg-white/[0.03] text-white/72 hover:border-white/[0.16] hover:bg-white/[0.08] hover:text-white/92',
    inline: 'border-transparent bg-transparent text-violet-300 hover:text-violet-200 px-0',
};

const SIZE_CLASSES = {
    xs: 'px-2 py-1 text-[10px]',
    sm: 'px-2.5 py-1.5 text-[11px]',
};

export default function IssueQuickAction({
    problemRef,
    label = 'Générer prompt',
    variant = 'primary',
    mode = 'drawer',
    size = 'sm',
    className = '',
}) {
    const { openHandoff } = useIssueHandoff();
    const normalized = normalizeProblemRef(problemRef);

    if (!normalized) {
        return null;
    }

    const baseClass = `inline-flex items-center gap-1.5 rounded-lg border font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-violet-400/30 ${
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary
    } ${SIZE_CLASSES[size] || SIZE_CLASSES.sm} ${className}`;

    if (mode === 'navigate') {
        const href = buildCorrectionPromptsHref(normalized.clientId, normalized, { handoffUi: 'page' });
        return (
            <Link href={href} className={baseClass}>
                <ExternalLink className="h-3 w-3" />
                {label}
            </Link>
        );
    }

    return (
        <button
            type="button"
            className={baseClass}
            onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                openHandoff(normalized);
            }}
        >
            <Sparkles className="h-3 w-3" />
            {label}
        </button>
    );
}
