'use client';

import DimensionsRadar from '@/components/shared/metrics/DimensionsRadar';

import {
    LabEmptyState,
    LabPill,
    LabSectionHeader,
} from './LabPrimitives';
import {
    getSeoGeoBucketsViewModel,
    scoreToneClass,
} from './audit-lab-model';
import { humanizeCategoryKey, severityFr, severityTone } from './audit-lab-copy';

/**
 * Section B — Lecture SEO vs GEO.
 *
 * Couche d'interprétation opérateur : répartit les dimensions de scoring
 * existantes en deux colonnes lisibles pour l'audit interne.
 *
 *   - Colonne SEO  : lisibilité technique & complétude d'identité (base
 *     organique classique).
 *   - Colonne GEO  : réponse IA, ancrage local et signaux de confiance
 *     (visibilité sur les surfaces IA / locales).
 *
 * Règle produit : aucun de ces scores ne remplace le score Trouvable de la
 * Section A. Cette section explique, en français et sans jargon, pourquoi
 * chaque côté est haut ou bas à partir des mêmes données que le backend a
 * déjà produites (`score_dimensions`, `issues`, `strengths`).
 */

const BUCKET_META = {
    seo: {
        eyebrow: 'SEO — lisibilité classique',
        title: 'Socle SEO technique',
        description:
            'Ce que Google et les moteurs classiques voient du site : indexabilité, métadonnées, structure et identité business détectable. Un SEO haut = le site est lisible et techniquement propre.',
        accent: 'border-emerald-400/25 bg-gradient-to-br from-emerald-500/[0.06] via-emerald-500/[0.015] to-transparent',
        accentText: 'text-emerald-300/80',
        contributeLabel: 'Dimensions contributrices',
        influenceLabel: 'Signaux qui pèsent',
        influenceItems: [
            'HTTPS, indexabilité, couverture de crawl',
            'Balise title, meta description, structure H1/H2',
            'URL canonique et directives robots',
            'Présence du nom d’entreprise, pages identité (à propos, contact, services)',
        ],
    },
    geo: {
        eyebrow: 'GEO — visibilité IA & locale',
        title: 'Préparation à la réponse IA',
        description:
            'Ce que les assistants IA et les surfaces locales peuvent exploiter : contenu citable, ancrage géographique, preuves de confiance. Un GEO haut = le site est interprétable, répondable et crédible pour une IA.',
        accent: 'border-violet-400/25 bg-gradient-to-br from-violet-500/[0.06] via-violet-500/[0.015] to-transparent',
        accentText: 'text-violet-300/80',
        contributeLabel: 'Dimensions contributrices',
        influenceLabel: 'Signaux qui pèsent',
        influenceItems: [
            'Blocs de contenu citables & structure de réponse (FAQ, HowTo, listicles)',
            'Schéma LocalBusiness, empreinte géographique, pages de zones servies',
            'Accès des crawlers IA (llms.txt, robots.txt, endpoints de découverte)',
            'Preuves sociales, avis, mentions publiques et profils sociaux',
        ],
    },
};

function DimensionRow({ entry }) {
    const dim = entry.dimension;
    const meta = entry.meta;
    const score = dim && typeof dim.score === 'number' ? dim.score : null;
    const tone = score != null ? scoreToneClass(score) : 'text-white/30';
    const notApplicable = dim?.applicability === 'Low relevance';

    return (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-white/85">
                        {meta?.label || humanizeCategoryKey(entry.key)}
                    </div>
                    {meta?.short && (
                        <div className="text-[10px] leading-relaxed text-white/40">{meta.short}</div>
                    )}
                </div>
                <div className="shrink-0 text-right">
                    <div className={`text-base font-extrabold tabular-nums ${tone}`}>
                        {score != null ? score : '—'}
                        <span className="ml-0.5 text-[10px] text-white/25">/100</span>
                    </div>
                    {notApplicable && (
                        <div className="text-[9px] uppercase tracking-wider text-white/35">peu applicable</div>
                    )}
                </div>
            </div>
            {meta?.description && (
                <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-white/45">{meta.description}</p>
            )}
        </div>
    );
}

const SOURCE_LABELS = {
    issue: null,
    dimension: 'Dimension basse',
    layer1: 'Scan Layer 1',
    layer2: 'Expert Layer 2',
    missing: 'Signal manquant',
};

function SourceBadge({ source }) {
    const label = SOURCE_LABELS[source];
    if (!label) return null;
    return <LabPill label={label} tone="neutral" />;
}

function PointsList({ label, items, tone, emptyText, showSource = false }) {
    const toneClass = tone === 'bad'
        ? 'text-red-300/85'
        : tone === 'good'
        ? 'text-emerald-300/85'
        : 'text-white/65';

    return (
        <div>
            <div className={`mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] ${toneClass}`}>{label}</div>
            {items.length === 0 ? (
                <p className="rounded-md border border-dashed border-white/[0.06] bg-white/[0.01] px-2.5 py-1.5 text-[11px] italic text-white/35">
                    {emptyText}
                </p>
            ) : (
                <ul className="space-y-1">
                    {items.map((item, index) => {
                        const severity = item.severity || item.priority || null;
                        const severityLabel = severityFr(severity);
                        const severityToneKey = severityTone(severity);
                        return (
                            <li
                                key={`${item.id || item.title || 'item'}-${index}`}
                                className="flex flex-col gap-1 rounded-md border border-white/[0.04] bg-white/[0.01] px-2.5 py-1.5"
                            >
                                <div className="flex items-start gap-1.5">
                                    {severityLabel && tone === 'bad' && (
                                        <LabPill label={severityLabel} tone={severityToneKey} />
                                    )}
                                    {showSource && item.source && <SourceBadge source={item.source} />}
                                    <span className="text-[11px] leading-snug text-white/80">
                                        {item.title || item.message || humanizeCategoryKey(item.id || item.category || 'point')}
                                    </span>
                                </div>
                                {item.description && (
                                    <p className="pl-1 text-[10.5px] leading-snug text-white/45 line-clamp-2">
                                        {item.description}
                                    </p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

function BucketColumn({ bucketName, data }) {
    const meta = BUCKET_META[bucketName];
    const score = data?.score ?? null;
    const scoreTone = score != null ? scoreToneClass(score) : 'text-white/30';

    const readingLabel = score == null
        ? 'Score indisponible'
        : score >= 80
            ? 'Point fort clair'
            : score >= 60
                ? 'Exploitable — à consolider'
                : score >= 40
                    ? 'Inégal — à renforcer'
                    : 'Faible — chantier prioritaire';

    return (
        <div className={`flex flex-col gap-4 rounded-2xl border p-4 ${meta.accent}`}>
            <div>
                <div className={`text-[10px] font-bold uppercase tracking-[0.12em] ${meta.accentText}`}>
                    {meta.eyebrow}
                </div>
                <div className="mt-0.5 text-[15px] font-bold text-white/90">{meta.title}</div>
                <p className="mt-1 text-[11px] leading-relaxed text-white/50">{meta.description}</p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
                <div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/45">
                        {bucketName === 'seo' ? 'Score SEO' : 'Score GEO & IA'}
                    </div>
                    <div className={`mt-0.5 font-['Plus_Jakarta_Sans',sans-serif] text-[32px] font-extrabold leading-none tabular-nums ${scoreTone}`}>
                        {score != null ? score : '—'}
                        {score != null && <span className="ml-0.5 text-[12px] text-white/30">/100</span>}
                    </div>
                    <div className="mt-0.5 text-[10px] text-white/45">{readingLabel}</div>
                </div>
                <div className="text-right text-[10px] leading-relaxed text-white/35">
                    moyenne des {data.dimensions.length} dimension{data.dimensions.length > 1 ? 's' : ''}<br />
                    rattachée{data.dimensions.length > 1 ? 's' : ''} à ce bloc
                </div>
            </div>

            <div>
                <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                    {meta.contributeLabel}
                </div>
                <div className="space-y-1.5">
                    {data.dimensions.map((entry) => (
                        <DimensionRow key={entry.key} entry={entry} />
                    ))}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
                <PointsList
                    label="Points forts relevés"
                    items={(data.strengths || []).slice(0, 4)}
                    tone="good"
                    emptyText="Aucun point fort rattaché à ce bloc dans le dernier audit."
                />
                <PointsList
                    label={score != null && score >= 95 ? 'Points à surveiller' : 'Points à corriger'}
                    items={data.correctivePoints || []}
                    tone="bad"
                    emptyText={
                        score != null && score >= 95
                            ? 'Bucket proche du maximum — aucun point faible rattaché à ce bloc.'
                            : 'Aucun point de correction n\'a pu être synthétisé — vérifier le contenu de l\'audit brut.'
                    }
                    showSource
                />
                {data.synthesisApplied && (
                    <p className="-mt-1 rounded-md border border-violet-400/15 bg-violet-500/[0.04] px-2 py-1.5 text-[10.5px] leading-snug text-violet-200/80">
                        Les points à corriger ont été <strong className="font-semibold">synthétisés</strong> depuis les dimensions basses et les contrôles Layer 1 / Layer 2, car aucun « issue » n&apos;était explicitement tagué sur ce bucket alors que son score est inférieur à 95.
                    </p>
                )}
            </div>

            <div className="rounded-xl border border-white/[0.05] bg-white/[0.01] p-3">
                <div className="text-[10px] font-bold uppercase tracking-[0.08em] text-white/40">
                    {meta.influenceLabel}
                </div>
                <ul className="mt-1 space-y-0.5 text-[11px] text-white/55">
                    {meta.influenceItems.map((line, index) => (
                        <li key={index}>• {line}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export default function AuditLabSeoGeoInterpretation({ audit }) {
    if (!audit) return null;

    const model = getSeoGeoBucketsViewModel(audit);

    if (!model.hasAny) {
        return (
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.015] p-5">
                <LabSectionHeader
                    eyebrow="Section B · Lecture SEO vs GEO"
                    title="Lecture indisponible"
                    subtitle="Les dimensions de scoring ne sont pas présentes sur ce dernier audit — la séparation SEO / GEO ne peut pas être calculée."
                />
                <LabEmptyState
                    title="Aucune dimension à interpréter"
                    description="Lancez un audit complet pour peupler cette section. Le score Trouvable de la Section A reste la référence produit."
                />
            </section>
        );
    }

    const radarDimensions = (model.dimensions || [])
        .filter((dim) => typeof dim.score === 'number' && dim.applicability !== 'N/A')
        .map((dim) => ({
            key: dim.key,
            label: dim.label || humanizeCategoryKey(dim.key),
            score: dim.score,
            max: 100,
        }));

    return (
        <section className="rounded-2xl border border-white/[0.10] bg-gradient-to-br from-white/[0.04] via-white/[0.01] to-transparent p-5">
            <LabSectionHeader
                eyebrow="Section B · Lecture SEO vs GEO"
                title="Pourquoi le SEO et le GEO sont à ce niveau"
                subtitle="Interprétation opérateur du dernier audit. Les deux colonnes regroupent les dimensions de scoring selon leur rôle : base organique lisible (SEO) et préparation aux réponses IA & local (GEO). Ces deux scores expliquent le score Trouvable — ils ne le remplacent pas."
            />

            {radarDimensions.length >= 3 ? (
                <div className="mb-5 grid grid-cols-1 items-center gap-4 rounded-xl border border-white/[0.06] bg-black/30 p-4 lg:grid-cols-[auto_minmax(0,1fr)]">
                    <DimensionsRadar dimensions={radarDimensions} accent="violet" size={240} />
                    <div className="space-y-2 text-[12px] leading-relaxed text-white/65">
                        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-white/45">Profil de scoring</div>
                        <p>
                            Chaque sommet représente une dimension applicable au profil du site. Le polygone reflète la couverture actuelle par rapport à un idéal (100/100 sur chaque dimension).
                        </p>
                        <p className="text-white/50">
                            Les dimensions marquées « N/A » par la classification ne sont pas dessinées.
                        </p>
                    </div>
                </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <BucketColumn bucketName="seo" data={model.seo} />
                <BucketColumn bucketName="geo" data={model.geo} />
            </div>

            <p className="mt-3 text-[10.5px] leading-relaxed text-white/40">
                Un score bas dans une colonne ne rend pas le score Trouvable invalide : la pondération finale dépend du type de site détecté
                (services locaux, e-commerce, média, etc.). Voir « Vérité normalisée » plus bas pour le détail du profil de pondération.
            </p>
        </section>
    );
}
