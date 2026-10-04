/**
 * Barrel d'export du système Command.
 * Point d'entrée unique pour toutes les primitives visuelles du centre de commande.
 */

export { default as CommandPageShell } from './CommandPageShell';
export { default as CommandHeader } from './CommandHeader';
export { default as CommandMetricCard } from './CommandMetricCard';
export { default as CommandChartCard } from './CommandChartCard';
export { default as CommandEmptyState } from './CommandEmptyState';
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
} from '@/lib/design/tokens';
