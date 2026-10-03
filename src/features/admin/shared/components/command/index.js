/**
 * Barrel d'export du système Command.
 * Point d'entrée unique pour toutes les primitives visuelles du centre de commande.
 */

export { default as CommandPageShell } from './CommandPageShell';
export { default as CommandHeader } from './CommandHeader';
export { default as CommandHero } from './CommandHero';
export { default as CommandMetricCard } from './CommandMetricCard';
export { default as CommandChartCard } from './CommandChartCard';
export { default as CommandEvidenceCard } from './CommandEvidenceCard';
export { default as CommandActionCard } from './CommandActionCard';
export { default as CommandTimeline } from './CommandTimeline';
export { default as CommandDrawer } from './CommandDrawer';
export { default as CommandSkeleton } from './CommandSkeleton';
export { default as CommandBrandLockup } from './CommandBrandLockup';
export { default as CommandEmptyState, CommandEmptyStateAction } from './CommandEmptyState';
export {
    default as CommandFilterBar,
    CommandSearchInput,
    CommandSegmentControl,
    CommandSelectFilter,
    CommandFilterResetButton,
} from './CommandFilterBar';
export { default as CommandTable } from './CommandTable';

export {
    cn,
    COMMAND_COLORS,
    COMMAND_SURFACE,
    COMMAND_SURFACE_SOFT,
    COMMAND_PANEL,
    COMMAND_MUTED_PANEL,
    COMMAND_TEXT,
    COMMAND_BUTTONS,
    getToneMeta,
    getToneAccent,
    getToneLabel,
} from './tokens';

export {
    COMMAND_EASE,
    commandStagger,
    commandFadeUp,
    commandFade,
    commandDrawer,
} from './motion';
