/**
 * Composition resolver for programmatic pages.
 *
 * Maps market profiles to deterministic layout configs.
 * All output is serializable — safe to pass from server to client components.
 */

const VILLE_PROFILES = {
    'competitive-fortress': {
        sectionOrder: ['signals', 'methodology', 'problems'],
        problemsHeading: 'L\u2019angle mort concurrentiel',
        problemsDescription: (name) => `Ces vuln\u00e9rabilit\u00e9s sont les positions que vos concurrents \u00e0 ${name} peuvent occuper dans les IA si vous n\u2019y r\u00e9pondez pas en premier.`,
        methodologyHeading: 'L\u2019arsenal de domination',
        methodologyDescription: (name) => `Ce n\u2019est pas du r\u00e9f\u00e9rencement. C\u2019est une infrastructure de prise de position d\u00e9ploy\u00e9e en sequence pour contr\u00f4ler votre visibilit\u00e9 IA \u00e0 ${name}.`,
        signalsHeading: 'Les signaux de contr\u00f4le',
        signalsDescription: (name) => `Ces indicateurs sont activ\u00e9s et surveill\u00e9s en continu pour garantir que ${name} vous associe \u00e0 votre secteur d\u2019activit\u00e9 dans les IA.`,
        ctaHeadline: (name) => `\u00c9tablissez votre forteresse \u00e0 ${name}`,
        ctaDescription: `Ne laissez pas vos concurrents capter les recommandations IA. Dominez le march\u00e9 le plus comp\u00e9titif du Qu\u00e9bec.`,
        ctaSecondaryLabel: 'Notre m\u00e9thodologie',
        ctaSecondaryHref: '/methodologie',
        marketContextHeading: (name) => `${name}, le terrain de jeu le plus dense du Québec`,
    },
    'satellite-differentiation': {
        sectionOrder: ['problems', 'methodology', 'signals'],
        problemsHeading: 'Le pi\u00e8ge de la confusion',
        problemsDescription: (name) => `Ces m\u00e9canismes expliquent pourquoi les algorithmes IA confondent ou ignorent les commerces de ${name}. Chaque faille est un point de levier.`,
        methodologyHeading: 'La diff\u00e9renciation territoriale',
        methodologyDescription: (name) => `Ce dispositif ancre explicitement ${name} dans les bases de donn\u00e9es des LLMs, avec une identit\u00e9 distincte de la m\u00e9tropole.`,
        signalsHeading: 'Les marqueurs d\u2019identit\u00e9',
        signalsDescription: (name) => `Ces signaux d\u2019identit\u00e9 territoriale sont install\u00e9s pour que les LLMs associent votre activit\u00e9 \u00e0 ${name} sans ambigu\u00eft\u00e9.`,
        ctaHeadline: (name) => `Affirmez votre identit\u00e9 \u00e0 ${name}`,
        ctaDescription: `Sortez de l\u2019ombre de la m\u00e9tropole. Faites de votre commerce la r\u00e9ponse locale des assistants IA.`,
        ctaSecondaryLabel: 'Notre m\u00e9thodologie',
        ctaSecondaryHref: '/methodologie',
        marketContextHeading: (name) => `${name} face \u00e0 la m\u00e9tropole`,
    },
    'tourist-capture': {
        sectionOrder: ['methodology', 'signals', 'problems'],
        problemsHeading: 'Les failles saisonni\u00e8res',
        problemsDescription: (name) => `Ces failles expliquent pourquoi le flux touristique de ${name} part vers d\u2019autres \u00e9tablissements, y compris vos concurrents directs.`,
        methodologyHeading: 'L\u2019infrastructure de captation',
        methodologyDescription: (name) => `Ce dispositif est construit pour capter les requ\u00eates touristiques en fran\u00e7ais et en anglais \u00e0 ${name}, quelle que soit la saison.`,
        signalsHeading: 'Les signaux de captation',
        signalsDescription: (name) => `Ces indicateurs confirment votre pr\u00e9sence dans les recommandations touristiques IA pour ${name}, de l\u2019avant-saison \u00e0 l\u2019apr\u00e8s-saison.`,
        ctaHeadline: (name) => `Captez les visiteurs de ${name}`,
        ctaDescription: `Les touristes d\u00e9couvrent les commerces locaux via les IA. Soyez la r\u00e9ponse qu\u2019ils re\u00e7oivent.`,
        ctaSecondaryLabel: 'Notre m\u00e9thodologie',
        ctaSecondaryHref: '/methodologie',
        marketContextHeading: (name) => `${name}, l\u2019enjeu touristique et saisonnier`,
    },
    'emerging-opportunity': {
        sectionOrder: ['problems', 'signals', 'methodology'],
        problemsHeading: 'Le terrain vierge',
        problemsDescription: (name) => `Ces angles morts repr\u00e9sentent une position ouverte sur le march\u00e9 de ${name}. Vos concurrents n\u2019y sont pas encore.`,
        methodologyHeading: 'L\u2019implantation strat\u00e9gique',
        methodologyDescription: (name) => `Ce plan d\u2019implantation vous installe dans les LLMs au moment o\u00f9 le march\u00e9 de ${name} se densifie. C\u2019est le bon moment.`,
        signalsHeading: 'Les signaux pr\u00e9curseurs',
        signalsDescription: (name) => `Ces pr\u00e9curseurs indiquent si votre avance sur ${name} se consolide, et signalent quand vos concurrents commencent \u00e0 rattraper leur retard.`,
        ctaHeadline: (name) => `Prenez position \u00e0 ${name} maintenant`,
        ctaDescription: `Le march\u00e9 se red\u00e9finit. Les premiers \u00e0 se positionner dans les IA captent l\u2019avantage.`,
        ctaSecondaryLabel: 'Notre m\u00e9thodologie',
        ctaSecondaryHref: '/methodologie',
        marketContextHeading: (name) => `Une fen\u00eatre d\u2019opportunit\u00e9 \u00e0 ${name}`,
    },
};

const EXPERTISE_PROFILES = {
    'demand-capture': {
        contentLayout: 'sections',
        ctaHeadline: (name) => `Captez la demande en ${name}`,
        ctaDescription: 'Les consommateurs cherchent, les IA recommandent. Soyez la réponse.',
        ctaSecondaryLabel: 'Voir un dossier-type',
        ctaSecondaryHref: '/etudes-de-cas/dossier-type',
        intentsHeading: 'Comment vos clients vous cherchent',
        architectureHeading: 'Ce que nous structurons pour vous',
        precisionHeading: 'Le niveau de précision documentaire',
    },
    'authority-builder': {
        contentLayout: 'sections',
        ctaHeadline: (name) => `Devenez la référence en ${name}`,
        ctaDescription: 'Construisez l\u2019autorité que les algorithmes reconnaissent et recommandent.',
        ctaSecondaryLabel: 'Voir un dossier-type',
        ctaSecondaryHref: '/etudes-de-cas/dossier-type',
        intentsHeading: 'L\u2019intention de recherche dans votre secteur',
        architectureHeading: 'L\u2019architecture de crédibilité',
        precisionHeading: 'Le niveau de précision exigé',
    },
    'market-gap': {
        contentLayout: 'sections',
        ctaHeadline: (name) => `Comblez le vide en ${name}`,
        ctaDescription: 'Un marché sous-structuré, une demande en explosion. Positionnez-vous avant vos concurrents.',
        ctaSecondaryLabel: 'Voir un dossier-type',
        ctaSecondaryHref: '/etudes-de-cas/dossier-type',
        intentsHeading: 'Les requêtes sans réponse',
        architectureHeading: 'La structuration qui manque à votre secteur',
        precisionHeading: 'Les exigences de précision',
    },
};

/**
 * Resolve composition config for a ville entry.
 * Returns a plain serializable object safe for server→client boundary.
 */
export function resolveVilleComposition(ville) {
    const comp = ville.composition;
    if (!comp) return null;

    const profile = VILLE_PROFILES[comp.marketProfile];
    if (!profile) return null;

    const name = ville.name;

    return {
        marketProfile: comp.marketProfile,
        sectionOrder: profile.sectionOrder,
        problemsHeading: profile.problemsHeading,
        problemsDescription: profile.problemsDescription(name),
        methodologyHeading: profile.methodologyHeading,
        methodologyDescription: profile.methodologyDescription(name),
        signalsHeading: profile.signalsHeading,
        signalsDescription: profile.signalsDescription(name),
        ctaHeadline: profile.ctaHeadline(name),
        ctaDescription: profile.ctaDescription,
        ctaSecondaryLabel: profile.ctaSecondaryLabel,
        ctaSecondaryHref: profile.ctaSecondaryHref,
        heroAngle: comp.heroAngle,
        marketContext: comp.marketContext,
        marketContextHeading: profile.marketContextHeading(name),
        heroTagline: comp.heroTagline || null,
        metaDescription: comp.metaDescription || null,
        signalItems: comp.signalItems || null,
        expertiseContext: comp.expertiseContext || null,
    };
}

/**
 * Resolve composition config for an expertise entry.
 * Returns a plain serializable object safe for server→client boundary.
 */
export function resolveExpertiseComposition(expertise) {
    const comp = expertise.composition;
    if (!comp) return null;

    const profile = EXPERTISE_PROFILES[comp.marketProfile];
    if (!profile) return null;

    const name = expertise.name;

    return {
        marketProfile: comp.marketProfile,
        contentLayout: profile.contentLayout,
        ctaHeadline: profile.ctaHeadline(name),
        ctaDescription: profile.ctaDescription,
        ctaSecondaryLabel: profile.ctaSecondaryLabel,
        ctaSecondaryHref: profile.ctaSecondaryHref,
        heroAngle: comp.heroAngle,
        marketContext: comp.marketContext,
        intentsHeading: profile.intentsHeading,
        architectureHeading: profile.architectureHeading,
        precisionHeading: profile.precisionHeading,
    };
}
