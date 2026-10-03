import 'server-only';
import { getAdminSupabase } from '@/lib/supabase-admin';
import { buildSeoHealthCorrectionPromptContext } from '../seo-health-context';

/**
 * Builder pour les opportunités (SEO et GEO).
 * Transforme une opportunité de la DB en contexte de prompt correctif
 * en réutilisant la logique du builder SEO Health.
 */
export async function buildOpportunityCorrectionPromptContext({ client, audit, ref }) {
    const opportunityId = ref.opportunityId;
    if (!opportunityId) {
        throw new Error('Opportunity ID missing in ProblemRef for source ' + ref.source);
    }

    const supabase = getAdminSupabase();
    const { data: opportunity, error } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', opportunityId)
        .single();

    if (error || !opportunity) {
        throw new Error(`Opportunity ${opportunityId} not found in database.`);
    }

    // Mapping d'une opportunité vers une "issue" compatible avec le builder SEO Health
    const issue = {
        id: opportunity.id,
        title: opportunity.label || opportunity.title || 'Opportunité détectée',
        description: opportunity.description || opportunity.title || 'Amélioration suggérée.',
        category: opportunity.category || 'seo',
        dimension: opportunity.dimension || 'technical_seo',
        evidence: opportunity.evidence || opportunity.rationale || opportunity.description || '',
        recommendedFix: opportunity.recommended_action || opportunity.recommended_fix || opportunity.suggested_fix || '',
        affectedScope: opportunity.target_url || opportunity.page_url || opportunity.affected_scope || '',
        sourceUrl: opportunity.target_url || opportunity.page_url || opportunity.affected_scope || null,
        priority: opportunity.priority || 'medium',
    };

    // On délègue la construction du contexte à la logique partagée SEO Health
    const context = buildSeoHealthCorrectionPromptContext({ client, audit, issue });
    
    // Personnalisation du contexte pour les opportunités
    context.source.surface = ref.source; // 'seo_opportunity' ou 'geo_opportunity'
    context.source.opportunityId = opportunityId;
    context.source.triggerSource = 'opportunity_pipeline';
    
    // Ajustement des labels si nécessaire
    if (ref.source === 'geo_opportunity') {
        context.problem.type = 'geo';
        context.problem.dimension = opportunity.dimension || 'local_readiness';
    }

    return context;
}
