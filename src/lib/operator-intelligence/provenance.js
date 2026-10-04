import 'server-only';

import { PROVENANCE_META } from './provenance-meta';
export { getProvenanceMeta } from './provenance-meta';

export function mapOpportunitySourceToProvenance(source) {
    if (source === 'observed') return PROVENANCE_META.observed;
    if (source === 'inferred') return PROVENANCE_META.inferred;
    if (source === 'recommended') return PROVENANCE_META.derived;
    return PROVENANCE_META.derived;
}
