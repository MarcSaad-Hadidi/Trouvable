import { COMMAND_BUTTONS, DEGRADED_STATES, cn, getToneMeta } from './tokens';

/**
 * CommandEmptyState: unified empty/degraded state for operator pages.
 *
 * Supports explicit states:
 * noConnector, noRuns, staleData, partialData, parseFailed,
 * insufficientEvidence, noActions.
 */
export default function CommandEmptyState({
    icon = null,
    title,
    description = null,
    action = null,
    secondary = null,
    state = null,
    tone = 'neutral',
    dashed = true,
    className = '',
}) {
    const degradedState = state ? DEGRADED_STATES[state] : null;
    const resolvedTone = degradedState?.tone || tone;
    const resolvedTitle = title || degradedState?.title || 'Etat indisponible';
    const resolvedDescription = description || degradedState?.description || null;
    const toneMeta = getToneMeta(resolvedTone);

    return (
        <div
            className={cn(
                'flex flex-col items-center justify-center rounded-[20px] p-8 text-center shadow-[0_18px_44px_rgba(15,23,42,0.07)] sm:p-10',
                dashed ? 'border border-dashed border-slate-300' : 'border border-slate-200',
                'bg-white',
                className,
            )}
        >
            <div
                className={cn(
                    'inline-flex h-11 w-11 items-center justify-center rounded-full border',
                    resolvedTone === 'neutral'
                        ? 'border-slate-200 bg-slate-50 text-slate-500'
                        : toneMeta.pill,
                )}
            >
                {icon || <span className="text-lg">·</span>}
            </div>
            <div className="mt-4 text-[16px] font-semibold text-slate-900">{resolvedTitle}</div>
            {resolvedDescription ? (
                <p className="mx-auto mt-2 max-w-lg text-[13px] leading-relaxed text-slate-500 sm:text-[14px]">
                    {resolvedDescription}
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

export function CommandEmptyStateAction({ children, className = '', ...props }) {
    return (
        <button type="button" className={cn(COMMAND_BUTTONS.primary, className)} {...props}>
            {children}
        </button>
    );
}
