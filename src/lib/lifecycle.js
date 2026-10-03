/**
 * Canonical client lifecycle definitions for Trouvable.
 *
 * The lifecycle tracks where a client record stands in the
 * service delivery journey. It is SEPARATE from publication status —
 * a client can be "active" in service but not yet published on the public site.
 *
 * States:
 *   prospect  → record created, not yet onboarded (quick-create or lead intake)
 *   onboarding → audit + profile build in progress
 *   active    → under active service delivery
 *   paused    → service temporarily on hold (client request or billing hold)
 *   archived  → soft-deleted / relationship ended
 *
 * All transitions are operator-initiated.
 */

export const LIFECYCLE_STATES = {
  prospect: 'prospect',
  onboarding: 'onboarding',
  active: 'active',
  paused: 'paused',
  archived: 'archived',
};

export const LIFECYCLE_STATE_LIST = Object.values(LIFECYCLE_STATES);

export const LIFECYCLE_META = {
  prospect: {
    label: 'Prospect',
    description: 'Fiche créée, pas encore embarqué',
    entryCondition: 'Record created via quick-create or lead conversion',
    exitConditions: ['Start onboarding → onboarding', 'Archive directly → archived'],
    blockedTransitions: ['active', 'paused'],
  },
  onboarding: {
    label: 'Embarquement',
    description: 'Audit initial et construction du profil en cours',
    entryCondition: 'Onboarding flow started (audit triggered)',
    exitConditions: ['Operator activates → active', 'Archive → archived'],
    blockedTransitions: ['prospect', 'paused'],
  },
  active: {
    label: 'Actif',
    description: 'Sous service actif : suivi, optimisation et visibilité',
    entryCondition: 'Operator activates client after onboarding review',
    exitConditions: ['Pause service → paused', 'Archive → archived'],
    blockedTransitions: ['prospect', 'onboarding'],
  },
  paused: {
    label: 'En pause',
    description: 'Service temporairement suspendu',
    entryCondition: 'Operator pauses (client request, billing hold, etc.)',
    exitConditions: ['Resume service → active', 'Archive → archived'],
    blockedTransitions: ['prospect', 'onboarding'],
  },
  archived: {
    label: 'Archivé',
    description: 'Relation terminée ou fiche supprimée',
    entryCondition: 'Operator archives from any non-archived state',
    exitConditions: ['Restore → active'],
    blockedTransitions: ['prospect', 'onboarding', 'paused'],
  },
};

/**
 * Allowed transitions: { fromState: Set<toState> }
 */
const ALLOWED_TRANSITIONS = {
  prospect: new Set(['onboarding', 'archived']),
  onboarding: new Set(['active', 'archived']),
  active: new Set(['paused', 'archived']),
  paused: new Set(['active', 'archived']),
  archived: new Set(['active']),
};

/**
 * Check if a lifecycle transition is allowed.
 * @param {string} from - current lifecycle_status
 * @param {string} to - desired lifecycle_status
 * @returns {boolean}
 */
export function isTransitionAllowed(from, to) {
  if (!ALLOWED_TRANSITIONS[from]) return false;
  return ALLOWED_TRANSITIONS[from].has(to);
}

/**
 * Validate and return the target state, or throw with a clear message.
 * @param {string} from
 * @param {string} to
 * @returns {string} the validated target state
 */
export function validateTransition(from, to) {
  if (!LIFECYCLE_STATE_LIST.includes(from)) {
    throw new Error(`[Lifecycle] Unknown current state: "${from}"`);
  }
  if (!LIFECYCLE_STATE_LIST.includes(to)) {
    throw new Error(`[Lifecycle] Unknown target state: "${to}"`);
  }
  if (!isTransitionAllowed(from, to)) {
    throw new Error(`[Lifecycle] Transition "${from}" → "${to}" is not allowed`);
  }
  return to;
}

/**
 * Get allowed next states for a given current state.
 * @param {string} current
 * @returns {string[]}
 */
export function getAllowedNextStates(current) {
  const transitions = ALLOWED_TRANSITIONS[current];
  return transitions ? [...transitions] : [];
}

/**
 * States eligible for active service delivery: monitoring, publication, portal access.
 * Prospect/onboarding are not yet serviced; archived is terminated.
 */
export const LIFECYCLE_SERVICEABLE_STATES = [LIFECYCLE_STATES.active, LIFECYCLE_STATES.paused];

/**
 * Default lifecycle_status for new records created via different paths.
 */
export const LIFECYCLE_DEFAULTS = {
  quickCreate: LIFECYCLE_STATES.prospect,
  onboarding: LIFECYCLE_STATES.onboarding,
};

/**
 * Determine appropriate lifecycle_status when archiving.
 * Validates transition from current state.
 */
export function transitionToArchived(currentStatus) {
  return validateTransition(currentStatus || LIFECYCLE_STATES.prospect, LIFECYCLE_STATES.archived);
}

/**
 * Determine appropriate lifecycle_status when restoring from archive.
 * Always restores to 'active'.
 */
export function transitionFromArchived() {
  return validateTransition(LIFECYCLE_STATES.archived, LIFECYCLE_STATES.active);
}
