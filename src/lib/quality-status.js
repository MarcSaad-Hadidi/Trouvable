/**
 * Shared quality-status definitions for prompt review surfaces.
 *
 * Three quality tiers:
 *   strong  — prompt is well-formed, specific, ready to activate
 *   review  — prompt needs operator attention before activation
 *   weak    — prompt is blocked (too vague, multi-intent, internal label)
 *
 * These are QUALITY assessments, not selection states.
 * Selection is tracked separately via `is_selected` on each prompt.
 */

export const QUALITY_STATUS = {
  strong: 'strong',
  review: 'review',
  weak: 'weak',
};

export const QUALITY_META = {
  strong: {
    key: 'strong',
    label: 'Fort',
    description: 'Prompt bien formé, spécifique et prêt à activer.',
    tone: 'emerald',
  },
  review: {
    key: 'review',
    label: 'À revoir',
    description: 'Le prompt nécessite une vérification opérateur avant activation.',
    tone: 'amber',
  },
  weak: {
    key: 'weak',
    label: 'Faible',
    description: 'Prompt bloqué, trop vague, multi-intention ou libellé interne.',
    tone: 'red',
  },
};

export const QUALITY_TONE_CLASSES = {
  emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-400/20 bg-amber-400/10 text-amber-200',
  red: 'border-red-400/20 bg-red-400/10 text-red-200',
};

/**
 * Resolve quality status metadata.
 * @param {string} status — 'strong' | 'review' | 'weak'
 * @returns {{ key, label, description, tone }} or fallback to review
 */
export function getQualityMeta(status) {
  return QUALITY_META[status] || QUALITY_META.review;
}

/**
 * Get Tailwind classes for a quality status tone.
 * @param {string} status — 'strong' | 'review' | 'weak'
 * @returns {string} Tailwind class string
 */
export function getQualityToneClasses(status) {
  const meta = getQualityMeta(status);
  return QUALITY_TONE_CLASSES[meta.tone] || QUALITY_TONE_CLASSES.amber;
}
