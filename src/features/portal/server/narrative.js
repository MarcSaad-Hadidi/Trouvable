function findMetric(metrics = [], key) {
  return (metrics || []).find((metric) => metric.key === key) || null;
}

function describeDelta(delta) {
  if (typeof delta !== 'number') return 'stable';
  if (delta > 0) return 'up';
  if (delta < 0) return 'down';
  return 'stable';
}

function buildScoreSentence(geoMetric, seoMetric) {
  const geoDirection = describeDelta(geoMetric?.delta);
  const seoDirection = describeDelta(seoMetric?.delta);

  if (geoDirection === 'up' && seoDirection === 'stable') {
    return 'Sur cette periode, la visibilite dans les reponses IA progresse, tandis que la base SEO reste globalement stable.';
  }

  if (geoDirection === 'up' && seoDirection === 'up') {
    return 'Sur cette periode, la visibilite GEO et les fondations SEO progressent de maniere conjointe.';
  }

  if (geoDirection === 'stable' && seoDirection === 'up') {
    return 'Sur cette periode, la base SEO progresse, alors que la composante GEO reste stable.';
  }

  if (geoDirection === 'down' && seoDirection === 'up') {
    return 'Sur cette periode, la base SEO progresse mais la composante GEO recule, ce qui justifie un arbitrage cible.';
  }

  if (geoDirection === 'up' && seoDirection === 'down') {
    return 'Sur cette periode, la composante GEO progresse mais la base SEO recule et demande une correction prioritaire.';
  }

  if (geoDirection === 'down' && seoDirection === 'down') {
    return 'Sur cette periode, les signaux GEO et SEO reculent; le mandat doit se concentrer sur la stabilisation des fondamentaux.';
  }

  if (geoDirection === 'down' && seoDirection === 'stable') {
    return 'Sur cette periode, la composante GEO recule alors que la base SEO reste stable.';
  }

  if (geoDirection === 'stable' && seoDirection === 'down') {
    return 'Sur cette periode, la base SEO recule tandis que la composante GEO reste stable.';
  }

  return 'Sur cette periode, les indicateurs restent majoritairement stables.';
}

function buildActionsSentence(recentWorkItems = []) {
  const recentActions = Array.isArray(recentWorkItems) ? recentWorkItems.length : 0;

  if (recentActions >= 5) {
    return 'Le rythme d execution est soutenu avec plusieurs actions recentes documentees dans le dossier.';
  }

  if (recentActions >= 2) {
    return 'Le dossier presente des actions recentes qui alimentent les ajustements en cours.';
  }

  return 'Le dossier affiche peu d actions recentes; la priorisation de la prochaine sequence est a confirmer.';
}

export function buildNarrativeSummary({ trendSummary, recentWorkItems, manualNote }) {
  const note = typeof manualNote === 'string' ? manualNote.trim() : '';
  if (note) return note;

  const geoMetric = findMetric(trendSummary?.metrics, 'geo_score');
  const seoMetric = findMetric(trendSummary?.metrics, 'seo_score');

  const scoreSentence = buildScoreSentence(geoMetric, seoMetric);
  const actionsSentence = buildActionsSentence(recentWorkItems);

  return `${scoreSentence} ${actionsSentence} Le compte rendu de mandat reste factuel: evolutions observees, points stables et risques a traiter.`;
}
