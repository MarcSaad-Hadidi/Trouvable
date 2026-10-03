import { COMMAND_BUTTONS, cn, getToneMeta } from './tokens';

/**
 * CommandEmptyState — état vide unifié du centre de commande.
 *
 * Remplace progressivement GeoEmptyPanel (GeoPremium.jsx) et SeoEmptyState
 * (SeoOpsPrimitives.jsx). Peut aussi servir de loading light.
 *
 * Props:
 *   - icon       : élément optionnel (Lucide / SVG) affiché dans le médaillon
 *   - title      : titre court (obligatoire)
 *   - description: paragraphe explicatif (optionnel)
 *   - action     : React node — bouton primaire (optionnel)
 *   - secondary  : React node — lien secondaire (optionnel)
 *   - tone       : 'neutral' | 'info' | 'warning' | 'critical' | 'ok'
 *   - dashed     : bordure en pointillés (défaut true)
 *   - className  : classes additionnelles
 */
export default function CommandEmptyState({
    icon = null,
    title,
    description = null,
    action = null,
    secondary = null,
    tone = 'neutral',
    dashed = true,
    className = '',
}) {
    const toneMeta = getToneMeta(tone);
    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-[26px] p-8 text-center shadow-[0_18px_44px_rgba(0,0,0,0.22)] sm:p-10',
                dashed ? 'border border-dashed border-white/10' : 'border border-white/[0.06]',
                'bg-[#0b0d11]/76',
                className,
            )}
        >
            <div
                className={cn(
                    'inline-flex h-11 w-11 items-center justify-center rounded-full border',
                    tone === 'neutral'
                        ? 'border-white/[0.08] bg-white/[0.03] text-white/50'
                        : cn(toneMeta.pill, 'bg-white/[0.03]'),
                )}
            >
                {icon || <span className="text-lg">·</span>}
            </div>
            <div className="mt-4 text-[16px] font-semibold tracking-[-0.02em] text-white/85">{title}</div>
            {description ? (
                <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-white/45 sm:text-[14px]">
                    {description}
                </p>
            ) : null}
            {action || secondary ? (
                <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    {action}
                    {secondary}
                </div>
            ) : null}
        </div>
    );
}

/**
 * CommandEmptyStateAction — bouton primaire standardisé pour les empty states.
 * Utilise COMMAND_BUTTONS.primary (fond blanc, contraste fort).
 */
export function CommandEmptyStateAction({ children, className = '', ...props }) {
    return (
        <button type="button" className={cn(COMMAND_BUTTONS.primary, className)} {...props}>
            {children}
        </button>
    );
}
