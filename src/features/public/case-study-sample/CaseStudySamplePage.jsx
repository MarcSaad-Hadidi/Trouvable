"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  ArrowRight,
  ChevronRight,
  FileText,
  Lock,
  ShieldCheck,
  Target,
  CheckCircle2,
} from "lucide-react";

import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";
import ContactButton from "@/features/public/shared/ContactButton";
import GeoSeoInjector from "@/features/public/shared/GeoSeoInjector";
import { SITE_LAST_MODIFIED, SITE_LAST_MODIFIED_ISO, SITE_URL } from "@/lib/site-config";

const MANDATE_FLOW = [
  {
    id: "cartographie",
    label: "Cartographie stratégique",
    description:
      "Lecture croisée des signaux publics, inventaire des écarts entre discours commercial et traces visibles, priorisation des causes qui freinent la visibilité.",
  },
  {
    id: "implementation",
    label: "Mandat d’implémentation",
    description:
      "Exécution des correctifs et enrichissements sur périmètre validé, avec traçabilité de chaque action appliquée et contrôle des points sensibles.",
  },
  {
    id: "pilotage",
    label: "Pilotage continu",
    description:
      "Suivi périodique, arbitrages de priorités, itération sur les signaux Google et IA, puis compte rendu consolidé pour la direction.",
  },
];

const DELIVERABLE_EXAMPLES = [
  {
    title: "Synthèse direction",
    details:
      "Document court de décision : situation de départ, risques principaux, priorités retenues, limites connues et ordre d’exécution recommandé.",
  },
  {
    title: "Plan d’action mandaté",
    details:
      "Feuille de route opérationnelle avec sections par lot, dépendances, statut par action et critères de validation avant clôture.",
  },
  {
    title: "Compte rendu de période",
    details:
      "Récapitulatif factuel des actions exécutées, points stables, points en progression, risques ouverts et prochaines actions proposées.",
  },
];

const METRIC_EXAMPLES = [
  "Évolution du score GEO et du score SEO sur période comparable",
  "Couverture des requêtes suivies (présence, mention, position relative)",
  "Cohésion des informations publiques (coordonnées, services, zones, preuves)",
  "État du backlog d’actions (livrées, en cours, à arbitrer)",
];

const DOSSIER_READING_GUIDE = [
  {
    title: "Lecture direction",
    text: "Vue synthétique pour arbitrer : ce qui a bougé, ce qui reste stable, et les décisions de périmètre à valider.",
  },
  {
    title: "Lecture opérationnelle",
    text: "Plan d’action détaillé pour suivre l’exécution : priorités, dépendances, et ordre de déploiement.",
  },
  {
    title: "Lecture de compte rendu",
    text: "Narratif de période relié aux signaux mesurés : progression, stabilité, risques, et prochaines actions engagées.",
  },
];

const HERO_OVERVIEW_TEXT =
  "Ce dossier-type illustre la forme réelle d’un compte rendu Trouvable : sections de contexte, séquence de mandats, extraits de livrables et lecture direction. Les contenus sensibles sont anonymisés ou remplacés par des placeholders.";

const CASE_STUDY_SAMPLE_URL = `${SITE_URL}/etudes-de-cas/dossier-type`;
const CASE_STUDY_ARTICLE_SCHEMA = {
  url: CASE_STUDY_SAMPLE_URL,
  headline: "Dossier-type de mandat Trouvable",
  description: "Structure representative d un dossier d execution Trouvable avec donnees anonymisees.",
  datePublished: SITE_LAST_MODIFIED_ISO,
  dateModified: SITE_LAST_MODIFIED_ISO,
  about: ["etude de cas", "mandat de visibilite", "processus d execution"],
  mentions: [`${SITE_URL}/etudes-de-cas`, `${SITE_URL}/offres`],
};

export default function DossierTypePage() {
  return (
    <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
      <Navbar />
      <GeoSeoInjector article={CASE_STUDY_ARTICLE_SCHEMA} baseUrl={SITE_URL} />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,#080808,#050505)]" />

      <main>
        <section className="relative mt-[58px] overflow-hidden px-6 pb-14 pt-[84px] sm:px-10 sm:pt-[104px]">
          <div className="pointer-events-none absolute left-1/2 top-[-110px] z-0 h-[540px] w-[860px] -translate-x-1/2 bg-[radial-gradient(ellipse,rgba(91,115,255,0.07)_0%,transparent_62%)]" />
          <div className="relative z-[1] mx-auto max-w-[1000px]">
            <motion.nav
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mb-7 flex items-center gap-2 text-[12px] font-medium text-white/40"
            >
              <Link href="/etudes-de-cas" className="transition-colors hover:text-white">
                Études de cas
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-white/65">Dossier-type</span>
            </motion.nav>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.04 }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.09em] text-white/45"
            >
              <Lock className="h-3.5 w-3.5" />
              Exemple structure de dossier
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.08 }}
              className="mt-6 text-[clamp(32px,5vw,62px)] font-bold leading-[1.06] tracking-[-0.045em]"
            >
              Dossier-type de mandat<br />
              <span className="bg-gradient-to-b from-white/55 to-white/20 bg-clip-text text-transparent">structure réelle, données anonymisées</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.14 }}
              translate="no"
              className="mt-5 max-w-3xl text-[16px] leading-[1.7] text-[#a0a0a0] notranslate"
            >
              <span>{HERO_OVERVIEW_TEXT}</span>
            </motion.p>
            <div className="mt-4 flex flex-wrap items-center gap-3 text-[12px] uppercase tracking-[0.08em] text-white/35">
              <span>Par Trouvable</span>
              <span aria-hidden>•</span>
              <span>Dernière mise à jour: {SITE_LAST_MODIFIED}</span>
            </div>

            <div className="mt-7 flex flex-wrap gap-3">
              <div className="inline-flex items-center rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-amber-200">
                Confidentialité : anonymisation active
              </div>
              <div className="inline-flex items-center rounded-full border border-white/12 bg-white/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.09em] text-white/45">
                Structure représentative, contenu réel partagé en entretien
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] px-6 py-20 sm:px-10">
          <div className="mx-auto grid max-w-[1000px] gap-6 lg:grid-cols-[1.1fr_1fr]">
            <motion.article
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-7"
            >
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-white/55">
                <Target className="h-3.5 w-3.5" />
                Contexte initial
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-white">Secteur, territoire, problématique</h2>
              <p className="mt-4 text-[14px] leading-[1.7] text-white/70">
                Exemple structuré : cabinet de services local, territoire prioritaire à définir, et écart entre perception interne et signal public observé sur Google et dans les réponses IA.
              </p>
              <p className="mt-3 text-[14px] leading-[1.7] text-white/60">
                Le contenu détaillé (secteur, zone, concurrence, contraintes) est présenté lors d’un premier entretien, par respect de nos engagements de confidentialité.
              </p>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.06 }}
              className="rounded-2xl border border-white/10 bg-[#0d0d0d] p-7"
            >
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-white/55">
                <ShieldCheck className="h-3.5 w-3.5" />
                Cadre de lecture
              </div>
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-white">Ce dossier est un exemple structuré</h2>
              <p className="mt-4 text-[14px] leading-[1.7] text-white/70">
                Les informations réelles sont anonymisées ou remplacées par des placeholders. Aucun nom de client, aucun chiffre public sensible, aucun extrait identifiant n’est publié sur cette page.
              </p>
            </motion.article>
          </div>
        </section>

        <section className="border-t border-white/[0.06] bg-[#060606] px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-[1000px]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7b8fff]">Séquence de mandat</div>
              <h2 className="text-[clamp(24px,3.2vw,36px)] font-bold tracking-[-0.03em] text-white">Ce que Trouvable a fait</h2>
            </motion.div>

            <div className="grid gap-4 md:grid-cols-3">
              {MANDATE_FLOW.map((step, idx) => (
                <motion.article
                  key={step.id}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, delay: idx * 0.06 }}
                  className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
                >
                  <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/35">Étape {String(idx + 1).padStart(2, "0")}</div>
                  <h3 className="text-[18px] font-semibold tracking-[-0.02em] text-white">{step.label}</h3>
                  <p className="mt-3 text-[14px] leading-[1.7] text-white/65">{step.description}</p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] px-6 py-20 sm:px-10">
          <div className="mx-auto max-w-[1000px]">
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="mb-8"
            >
              <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[#7b8fff]">Extraits attendus</div>
              <h2 className="text-[clamp(24px,3.2vw,36px)] font-bold tracking-[-0.03em] text-white">Exemples de livrables</h2>
            </motion.div>

            <div className="space-y-3">
              {DELIVERABLE_EXAMPLES.map((item, idx) => (
                <motion.article
                  key={item.title}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: idx * 0.05 }}
                  className="flex gap-4 rounded-2xl border border-white/10 bg-[#0b0b0b] p-5"
                >
                  <FileText className="mt-0.5 h-5 w-5 shrink-0 text-white/50" />
                  <div>
                    <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-white">{item.title}</h3>
                    <p className="mt-2 text-[14px] leading-[1.7] text-white/65">{item.details}</p>
                  </div>
                </motion.article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[0.06] bg-[#060606] px-6 py-20 sm:px-10">
          <div className="mx-auto grid max-w-[1000px] gap-8 lg:grid-cols-2">
            <motion.article
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Exemples de métriques suivies</h2>
              <ul className="mt-5 space-y-3 text-[14px] text-white/65">
                {METRIC_EXAMPLES.map((metric) => (
                  <li key={metric} className="flex items-start gap-2.5 leading-[1.7]">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                    <span>{metric}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-xs uppercase tracking-[0.08em] text-white/35">
                Aucun chiffre réel n’est publié ici. Types de métriques uniquement.
              </p>
            </motion.article>

            <motion.article
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.06 }}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
            >
              <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-white">Comment le client lit ce dossier</h2>
              <div className="mt-5 space-y-4">
                {DOSSIER_READING_GUIDE.map((item) => (
                  <div key={item.title} className="rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/45">{item.title}</div>
                    <p className="mt-2 text-[14px] leading-[1.7] text-white/65">{item.text}</p>
                  </div>
                ))}
              </div>
            </motion.article>
          </div>
        </section>

        <section className="relative overflow-hidden border-t border-white/[0.06] px-6 py-24 sm:px-10">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[680px] -translate-x-1/2 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(91,115,255,0.05)_0%,transparent_60%)]" />
          <div className="relative z-10 mx-auto max-w-[700px] text-center">
            <motion.h3
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-[clamp(24px,3vw,32px)] font-bold tracking-[-0.03em] text-white"
            >
              Ouvrir un mandat avec un dossier pilote
            </motion.h3>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.06 }}
              className="mx-auto mt-4 max-w-xl text-[15px] leading-[1.7] text-white/65"
            >
              Nous cadrons le périmètre, exécutons les actions et livrons un compte rendu exploitable pour votre direction.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.12 }}
              className="mt-8"
            >
              <ContactButton className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-[15px] font-semibold text-black transition hover:-translate-y-px hover:bg-[#e8e8e8]">
                Planifier un appel de cadrage <ArrowRight className="h-4 w-4" />
              </ContactButton>
            </motion.div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
