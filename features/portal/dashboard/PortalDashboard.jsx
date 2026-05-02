import PortalMandateHero from './PortalMandateHero';
import PortalAgentCard from './PortalAgentCard';
import PortalExecutiveStrip from './PortalExecutiveStrip';
import PortalActivityStory from './PortalActivityStory';
import PortalPriorityBoard from './PortalPriorityBoard';
import PortalTrendPanel from './PortalTrendPanel';
import PortalMomentumStrip from './PortalMomentumStrip';
import PortalSignalsPanel from './PortalSignalsPanel';
import { buildNarrativeSummary } from '@/features/portal/server/narrative';
import PortalSupportForm from './PortalSupportForm';
import { GoogleConnectButton } from '@/features/portal/dashboard/GoogleConnectButton';

const SECTIONS = [
    { id: 'lecture', label: 'I · Lecture du mandat', kicker: 'Synthèse' },
    { id: 'periode', label: 'II · Compte rendu de la période', kicker: 'Récit' },
    { id: 'momentum', label: 'III · Cadran de momentum', kicker: 'Mesure' },
    { id: 'travaux', label: 'IV · Travaux conduits', kicker: 'Journal' },
    { id: 'priorites', label: 'V · Prochaines priorités', kicker: 'Cap' },
    { id: 'tendance', label: 'VI · Tendance et profondeur', kicker: 'Analyse' },
    { id: 'signaux', label: 'VII · Signaux observés', kicker: 'Pouls' },
    { id: 'liaison', label: 'VIII · Connexions et échange', kicker: 'Liaison' },
];

function SectionAnchor({ id, label, kicker, index }) {
    const order = String(index + 1).padStart(2, '0');
    return (
        <a
            href={`#${id}`}
            className="group flex items-center gap-3 border-b border-white/[0.04] py-2.5 text-[12.5px] text-white/45 transition hover:text-white"
        >
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.20em] text-white/25 transition group-hover:text-white/70">
                {order}
            </span>
            <span className="flex-1 truncate font-medium">{label.replace(/^[IVX]+\s·\s/, '')}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/20 transition group-hover:text-white/55">
                {kicker}
            </span>
        </a>
    );
}

function SectionMast({ id, kicker, label, hint }) {
    return (
        <header id={id} className="mb-5 flex flex-col gap-1 border-l-2 border-[#5b73ff]/35 pl-4">
            <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7b8fff]/65">
                {kicker}
            </span>
            <h2 className="font-display text-[22px] font-semibold leading-tight tracking-[-0.025em] text-white">
                {label}
            </h2>
            {hint ? <p className="max-w-2xl text-[12.5px] leading-relaxed text-white/50">{hint}</p> : null}
        </header>
    );
}

export default function PortalDashboard({
    dashboard,
    membershipsCount = 1,
    viewerEmail = '',
    clientSlug = '',
    cloudflareBypassEnabled = false,
}) {
    const {
        client,
        visibility,
        completeness,
        trendSummary,
        recentWorkItems,
        nextPriorities,
        topTrackedPrompts,
        topSources,
        openOpportunitiesCount,
        periodNarrativeNote,
        agent,
    } = dashboard;

    const narrativeSummary = buildNarrativeSummary({
        trendSummary,
        recentWorkItems,
        manualNote: periodNarrativeNote,
    });

    return (
        <article className="space-y-12">
            <section id="lecture">
                <PortalMandateHero
                    client={client}
                    visibility={visibility}
                    completeness={completeness}
                    membershipsCount={membershipsCount}
                />

                {agent ? (
                    <div className="mt-5">
                        <PortalAgentCard agent={agent} />
                    </div>
                ) : null}
            </section>

            <nav
                aria-label="Sommaire de la restitution"
                className="rounded-[20px] border border-white/[0.06] bg-white/[0.015] p-5 sm:p-6"
            >
                <div className="mb-3 flex items-center justify-between">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.20em] text-white/35">
                        Sommaire
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/25">
                        {SECTIONS.length} sections
                    </span>
                </div>
                <div className="grid gap-x-8 sm:grid-cols-2">
                    {SECTIONS.map((section, index) => (
                        <SectionAnchor key={section.id} {...section} index={index} />
                    ))}
                </div>
            </nav>

            <section>
                <SectionMast
                    id="periode"
                    kicker="Récit"
                    label="Compte rendu de la période"
                    hint="Lecture éditoriale des dernières semaines, écrite à partir du journal effectif et des tendances mesurées."
                />
                <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-6 sm:p-8">
                    <p className="font-display text-[18px] leading-[1.72] tracking-[-0.005em] text-white/85 first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-[52px] first-letter:font-semibold first-letter:leading-[0.9] first-letter:text-[#7b8fff]">
                        {narrativeSummary}
                    </p>
                </div>
            </section>

            <section>
                <SectionMast
                    id="momentum"
                    kicker="Mesure"
                    label="Cadran de momentum"
                    hint="Indicateurs synthétiques agrégés : visibilité, complétude, dynamique récente."
                />
                <PortalExecutiveStrip
                    visibility={visibility}
                    completeness={completeness}
                    recentWorkItems={recentWorkItems}
                    trendSummary={trendSummary}
                />
            </section>

            <section>
                <SectionMast
                    id="travaux"
                    kicker="Journal"
                    label="Travaux conduits"
                    hint="Le détail chronologique des interventions Trouvable enregistrées sur la période."
                />
                <PortalActivityStory items={recentWorkItems} />
            </section>

            <section>
                <SectionMast
                    id="priorites"
                    kicker="Cap"
                    label="Prochaines priorités"
                    hint="La file de travail à venir, telle qu'elle est cadrée par l'équipe en regard du dossier."
                />
                <PortalPriorityBoard priorities={nextPriorities} />
            </section>

            <section>
                <SectionMast
                    id="tendance"
                    kicker="Analyse"
                    label="Tendance et profondeur"
                    hint="Lecture quantitative de l'évolution récente et de la profondeur du signal observé."
                />
                <PortalTrendPanel trendSummary={trendSummary} />

                <div className="mt-4">
                    <PortalMomentumStrip
                        visibility={visibility}
                        openOpportunitiesCount={openOpportunitiesCount}
                        sparklines={trendSummary?.sparklines}
                    />
                </div>
            </section>

            <section>
                <SectionMast
                    id="signaux"
                    kicker="Pouls"
                    label="Signaux observés"
                    hint="Les requêtes suivies et les sources qui structurent la présence du dossier dans les réponses."
                />
                <PortalSignalsPanel prompts={topTrackedPrompts} sources={topSources} />
            </section>

            <section>
                <SectionMast
                    id="liaison"
                    kicker="Liaison"
                    label="Connexions et échange"
                    hint="Pour permettre une lecture en temps réel, raccordez vos outils, ou écrivez à l'équipe directement."
                />
                <div className="space-y-4">
                    <div className="rounded-[20px] border border-white/[0.07] bg-white/[0.02] p-6">
                        <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.20em] text-white/40">
                            Connexion Google
                        </div>
                        <p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-white/55">
                            Synchronisez votre compte administrateur pour permettre à Trouvable de lire votre visibilité
                            en temps réel depuis les moteurs de recherche.
                        </p>
                        <GoogleConnectButton clientId={client.id} returnTo={`/portal/${clientSlug}`} />
                    </div>
                    <PortalSupportForm
                        defaultEmail={viewerEmail}
                        clientLabel={
                            clientSlug ? `${client.client_name} (${clientSlug})` : client.client_name
                        }
                        cloudflareBypassEnabled={cloudflareBypassEnabled}
                    />
                </div>
            </section>

            <footer className="border-t border-white/[0.05] pt-6 text-center font-mono text-[10px] uppercase tracking-[0.22em] text-white/25">
                Fin de la restitution · {client.client_name}
            </footer>
        </article>
    );
}
