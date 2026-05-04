"use client";

import React from "react";
import { motion } from "framer-motion";
import Navbar from "@/features/public/shared/Navbar";
import SiteFooter from "@/features/public/shared/SiteFooter";
import ContactButton from "@/features/public/shared/ContactButton";
import { Mail, Phone, MapPin, Search, CheckCircle2, ChevronRight, ShieldCheck, Clock } from "lucide-react";
import { SITE_CONTACT_EMAIL, SITE_PHONE_DISPLAY, SITE_PHONE_TEL } from "@/lib/site-contact";
import Link from "next/link";

const PROCESS_STEPS = [
  { icon: Search, accent: "#5b73ff", title: "Analyse de repérage", desc: "Nous scannons rapidement vos signaux avant de vous contacter." },
  { icon: Phone, accent: "#34d399", title: "Appel de découverte (30\u00A0min)", desc: "Un échange qualifié. Nous pourrons vous ouvrir un véritable dossier-type. Pas de pression commerciale." },
  { icon: CheckCircle2, accent: "#f59e0b", title: "Le plan d'action", desc: "Si nous pouvons être rentables pour vous, nous vous soumettons un mandat sur-mesure." },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
      <Navbar />
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[linear-gradient(to_bottom,#080808,#080808)]" />

      <main>
        <section className="relative mt-[58px] overflow-hidden px-6 pt-[80px] pb-4 sm:pt-[110px]">
          <div className="pointer-events-none absolute right-[-150px] top-[-50px] h-[400px] w-[400px] bg-[radial-gradient(circle,rgba(91,115,255,0.06),transparent_70%)]" />
          <div className="relative z-[1] mx-auto max-w-[1100px] grid gap-16 md:grid-cols-2 md:gap-20 items-start">
            <div>
              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#7b8fff]">Discutons</motion.div>
              <motion.h1 initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.06 }} className="text-[clamp(36px,5vw,56px)] font-bold leading-[1.08] tracking-[-0.04em] mb-6">
                Faites analyser votre<br /><span className="bg-gradient-to-b from-white/50 to-white/20 bg-clip-text text-transparent">présence IA.</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.14 }} className="max-w-[460px] text-[15px] leading-[1.65] text-[#a0a0a0] mb-12">
                Que vous souhaitiez comprendre pourquoi vos concurrents trustent les réponses de ChatGPT, ou que vous cherchiez à dominer votre marché local sur Google, notre équipe est prête à évaluer votre profil.
              </motion.p>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }} className="space-y-5 mb-14">
                <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="group flex items-center gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] transition group-hover:bg-white/[0.08] group-hover:border-white/20">
                    <Mail className="h-5 w-5 text-[#a0a0a0] group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.06em] text-[#666] mb-0.5">Notre courriel</p>
                    <p className="text-[15px] font-medium text-white">{SITE_CONTACT_EMAIL}</p>
                  </div>
                </a>
                <a href={`tel:${SITE_PHONE_TEL}`} className="group flex items-center gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03] transition group-hover:bg-white/[0.08] group-hover:border-white/20">
                    <Phone className="h-5 w-5 text-[#a0a0a0] group-hover:text-white transition-colors" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.06em] text-[#666] mb-0.5">Téléphone</p>
                    <p className="text-[15px] font-medium text-white">{SITE_PHONE_DISPLAY}</p>
                  </div>
                </a>
                <div className="flex items-center gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.03]">
                    <MapPin className="h-5 w-5 text-[#a0a0a0]" />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.06em] text-[#666] mb-0.5">Zone d&apos;intervention</p>
                    <p className="text-[15px] font-medium text-white">Grand Montréal &amp; Québec</p>
                  </div>
                </div>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.28 }}>
                <div className="mb-5 text-[11px] font-bold uppercase tracking-[0.1em] text-white/25">Ce qui se passe après votre demande</div>
                <div className="relative space-y-0">
                  {PROCESS_STEPS.map((s, i) => {
                    const Icon = s.icon;
                    return (
                      <div key={s.title} className="relative flex items-stretch gap-4 pb-1">
                        <div className="flex flex-col items-center">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/12 bg-[#0d0d0d]">
                            <Icon className="h-4 w-4" style={{ color: s.accent }} />
                          </div>
                          {i < PROCESS_STEPS.length - 1 && <div className="flex-1 w-px my-1.5 bg-white/6" />}
                        </div>
                        <div className="pb-6 pt-1">
                          <div className="text-[14px] font-semibold text-white/90">{s.title}</div>
                          <div className="mt-1 text-[12px] leading-[1.6] text-[#888]">{s.desc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>

            <div className="relative">
              <motion.div initial={{ opacity: 0, y: 24, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.15 }} className="sticky top-32">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0a0a0a] p-8 shadow-[0_40px_100px_rgba(0,0,0,0.5)] md:p-12">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#5b73ff]/30 to-transparent" />
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.1em] text-white/25">
                    <Clock className="h-3 w-3" /> Réponse sous 24h
                  </div>
                  <h2 className="mb-4 text-[clamp(20px,2.5vw,26px)] font-bold tracking-[-0.02em] leading-snug">Remplissez une demande expresse.</h2>
                  <p className="mb-8 text-[15px] leading-[1.65] text-[#a0a0a0]">
                    Confiez-nous quelques informations de base pour que notre équipe effectue un premier repérage de votre couverture locale.
                  </p>
                  <div className="rounded-xl border border-white/5 bg-[#0d0d0d] p-8 text-center transition-all hover:border-white/10">
                    <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
                      <ShieldCheck className="h-5 w-5 text-white/40" />
                    </div>
                    <p className="mb-6 text-sm font-medium text-white">Ouvrez le formulaire sécurisé</p>
                    <ContactButton className="group flex w-full items-center justify-center gap-2 rounded-lg bg-white py-4 text-[15px] font-semibold text-black transition hover:bg-neutral-200 shadow-[0_0_20px_rgba(255,255,255,0.06)]">
                      Faire ma demande <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </ContactButton>
                  </div>
                  <div className="mt-6 text-center">
                    <Link href="/etudes-de-cas/dossier-type" className="text-[12px] font-medium text-[#7b8fff] transition-colors hover:text-white">
                      Voir à quoi ressemble un dossier Trouvable →
                    </Link>
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
