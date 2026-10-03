'use client';

import { useId } from 'react';
import { Search, X } from 'lucide-react';

import { COMMAND_PANEL, cn, getToneMeta } from './tokens';

/**
 * CommandFilterBar — rangée de filtres standardisée pour les tables et files d'actions.
 *
 * Structure recommandée :
 *   <CommandFilterBar
 *     search={{ value, onChange, placeholder }}
 *     segments={[...]}
 *     filters={[...]}
 *     trailing={<ResetButton />}
 *     sticky
 *   />
 *
 * Props :
 *   - search    : { value, onChange, placeholder } (optionnel)
 *   - segments  : Array<{ id, label, options: [{ value, label, count? }], value, onChange }>
 *                 → segment control (tabs inline).
 *   - filters   : Array<{ id, label, options: [{ value, label }], value, onChange, multiple? }>
 *                 → selects simples (native <select>) pour un rendu léger.
 *   - trailing  : React node à droite (ex. bouton Réinitialiser)
 *   - sticky    : rend la barre collante (top-4)
 *   - className : classes additionnelles
 */
export default function CommandFilterBar({
    search = null,
    segments = [],
    filters = [],
    trailing = null,
    sticky = false,
    className = '',
}) {
    return (
        <div
            className={cn(
                COMMAND_PANEL,
                'flex flex-col gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:p-3.5',
                sticky && 'sticky top-4 z-20 backdrop-blur-sm',
                className,
            )}
            role="toolbar"
            aria-label="Filtres"
        >
            {search ? <CommandSearchInput {...search} /> : null}

            {segments.map((segment) => (
                <CommandSegmentControl key={segment.id} {...segment} />
            ))}

            {filters.map((filter) => (
                <CommandSelectFilter key={filter.id} {...filter} />
            ))}

            {trailing ? <div className="sm:ml-auto">{trailing}</div> : null}
        </div>
    );
}

export function CommandSearchInput({ value, onChange, placeholder = 'Rechercher…' }) {
    const id = useId();
    const hasValue = Boolean(value);
    return (
        <div className="relative flex-1 min-w-[220px]">
            <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30"
                aria-hidden="true"
            />
            <input
                id={id}
                type="search"
                value={value ?? ''}
                onChange={(event) => onChange?.(event.target.value)}
                placeholder={placeholder}
                className={cn(
                    'w-full rounded-full border border-white/[0.08] bg-white/[0.02] py-2 pl-9 pr-9 text-[12px] text-white/85',
                    'placeholder:text-white/30 focus:border-white/[0.18] focus:bg-white/[0.04] focus:outline-none focus:ring-2 focus:ring-sky-400/20',
                    'transition-colors',
                )}
            />
            {hasValue ? (
                <button
                    type="button"
                    onClick={() => onChange?.('')}
                    aria-label="Effacer la recherche"
                    className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/35 hover:bg-white/[0.06] hover:text-white/80"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            ) : null}
        </div>
    );
}

export function CommandSegmentControl({ id, label = null, options = [], value, onChange }) {
    return (
        <div className="inline-flex items-center gap-2" role="group" aria-label={label || id}>
            {label ? (
                <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/30">
                    {label}
                </span>
            ) : null}
            <div className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.02] p-1">
                {options.map((option) => {
                    const active = option.value === value;
                    const tone = option.tone ? getToneMeta(option.tone) : null;
                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange?.(option.value)}
                            aria-pressed={active}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold transition-colors',
                                active
                                    ? tone
                                        ? cn(tone.pill, 'border')
                                        : 'bg-white text-[#090b10]'
                                    : 'text-white/55 hover:bg-white/[0.06] hover:text-white/85',
                            )}
                        >
                            <span>{option.label}</span>
                            {option.count != null ? (
                                <span
                                    className={cn(
                                        'rounded-full px-1.5 text-[10px] font-bold',
                                        active
                                            ? 'bg-black/10 text-[#090b10]'
                                            : 'bg-white/[0.06] text-white/50',
                                    )}
                                >
                                    {option.count}
                                </span>
                            ) : null}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

export function CommandSelectFilter({ id, label, options = [], value, onChange }) {
    const selectId = useId();
    return (
        <label
            htmlFor={selectId}
            className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] pl-3 pr-1 py-1 text-[11px] text-white/55"
        >
            <span className="font-semibold uppercase tracking-[0.1em] text-white/35">{label}</span>
            <select
                id={selectId}
                value={value ?? ''}
                onChange={(event) => onChange?.(event.target.value)}
                className="cursor-pointer appearance-none rounded-full bg-transparent pl-1 pr-6 text-[11px] font-semibold text-white/85 outline-none focus:text-white"
            >
                {options.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#0a0c10] text-white">
                        {option.label}
                    </option>
                ))}
            </select>
        </label>
    );
}

export function CommandFilterResetButton({ onClick, label = 'Réinitialiser' }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex items-center gap-1.5 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-semibold text-white/55 transition-colors hover:border-white/[0.1] hover:bg-white/[0.04] hover:text-white"
        >
            <X className="h-3 w-3" />
            {label}
        </button>
    );
}
