/**
 * Backward-compat shim.
 * The canonical tokens now live in lib/design/tokens.ts.
 * This file is kept so existing imports from `@/lib/tokens` continue to work.
 * Prefer importing from `@/lib/design/tokens` in new code.
 */
export {
    cn,
    COMMAND_COLORS,
    COMMAND_SURFACE,
    COMMAND_SURFACE_SOFT,
    COMMAND_PANEL,
    COMMAND_MUTED_PANEL,
    COMMAND_TEXT,
    COMMAND_BUTTONS,
    DISCIPLINE_ACCENTS,
    DISCIPLINE_META,
    FIELD_SURFACE,
    ATMOSPHERE_SURFACE,
    FORGE_SURFACE,
    getToneMeta,
    getToneAccent,
    getToneLabel,
} from '@/lib/design/tokens';
export type { Discipline, Tone } from '@/lib/design/tokens';
