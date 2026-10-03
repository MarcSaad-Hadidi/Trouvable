/**
 * Command Design Token Shim
 *
 * Re-exports from the canonical token source at @/lib/design/tokens.
 * Existing imports from this path continue to work unchanged.
 * New code should import from @/lib/design/tokens directly.
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
