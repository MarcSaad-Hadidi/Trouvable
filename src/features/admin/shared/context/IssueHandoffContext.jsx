'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

import {
    inferTaskType,
    normalizeProblemRef,
    problemRefToQueryString,
} from '@/lib/correction-prompts/problem-ref';

/**
 * IssueHandoffContext — store transitoire « problème → prompt ».
 *
 * Deux modes :
 *   - `drawer` (défaut) : ouvre le drawer universel et pré-remplit ProblemRef
 *                         pour générer un prompt en place.
 *   - `navigate`        : navigue vers la page prompts correctifs avec le
 *                         ProblemRef sérialisé en query params.
 *
 * Consommé par :
 *   - `<IssueQuickAction/>` — bouton réutilisable posé sur chaque issue UI
 *   - `<IssueActionsDrawer/>` — drawer universel monté au layout admin
 *   - `SeoCorrectionPromptsView` — hydratation initiale du ProblemRef depuis URL
 */

const HandoffContext = createContext(null);

export function IssueHandoffProvider({ children }) {
    const [open, setOpen] = useState(false);
    const [ref, setRef] = useState(null);
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const routeKey = `${pathname || ''}?${searchParams?.toString() || ''}`;
    const [previousRouteKey, setPreviousRouteKey] = useState(routeKey);
    if (previousRouteKey !== routeKey) {
        setPreviousRouteKey(routeKey);
        setOpen(false);
    }

    const openHandoff = useCallback((input) => {
        const normalized = normalizeProblemRef(input);
        if (!normalized) {
            console.warn('[IssueHandoff] ProblemRef invalide, ouverture ignorée.', input);
            return;
        }
        setRef(normalized);
        setOpen(true);
    }, []);

    const closeHandoff = useCallback(() => {
        setOpen(false);
    }, []);

    const clearHandoff = useCallback(() => {
        setOpen(false);
        setRef(null);
    }, []);

    // Ferme le drawer automatiquement à chaque navigation (changement de route
    // ou de query params), y compris quand on reste dans le même layout admin.

    const value = useMemo(() => ({
        open,
        ref,
        openHandoff,
        closeHandoff,
        clearHandoff,
    }), [open, ref, openHandoff, closeHandoff, clearHandoff]);

    return <HandoffContext.Provider value={value}>{children}</HandoffContext.Provider>;
}

export function useIssueHandoff() {
    const ctx = useContext(HandoffContext);
    if (!ctx) {
        // Retombe sur un no-op en cas d'absence de provider (par ex. si le
        // composant est rendu hors du layout admin).
        return {
            open: false,
            ref: null,
            openHandoff: () => {},
            closeHandoff: () => {},
            clearHandoff: () => {},
        };
    }
    return ctx;
}

/**
 * Helper : construit l'URL complète vers la page prompts correctifs,
 * avec le ProblemRef sérialisé en query params.
 */
/**
 * @param {{ handoffUi?: 'page' }} [options]
 *   handoffUi=page : navigation vers la page complète sans rouvrir le drawer
 *   (voir SeoCorrectionPromptsView).
 */
export function buildCorrectionPromptsHref(clientId, ref, options = {}) {
    if (!clientId) return '#';
    const base = `/admin/clients/${clientId}/seo/correction-prompts`;
    if (!ref) return base;
    const normalized = normalizeProblemRef(ref);
    const qs = normalized ? problemRefToQueryString(normalized) : '';
    const params = qs ? new URLSearchParams(qs) : new URLSearchParams();
    if (options.handoffUi === 'page') {
        params.set('handoffUi', 'page');
    }
    const finalQs = params.toString();
    return finalQs ? `${base}?${finalQs}` : base;
}

export { inferTaskType };
