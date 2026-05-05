'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Mic, Camera, X, Grid, Sparkles, MoreVertical, Volume2, ChevronDown, ArrowRight, BookOpen } from 'lucide-react';
import Link from 'next/link';
import { TypewriterText, AiThinking, FaqSection, LinksSection, PlatformEditorialLead } from './shared-primitives';

export default function AiOverviewsPage({ page, trustBrief }) {
    const [isGenerating, setIsGenerating] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsGenerating(false);
        }, 2000);
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen bg-[#060609] text-[#e8eaed] font-sans">
            <main className="px-4 pb-24 sm:px-8">
                <PlatformEditorialLead page={page} />
                {/* Google Native App Window */}
                <div className="max-w-[1400px] mx-auto rounded-2xl border border-white/10 bg-[#202124] shadow-2xl overflow-hidden relative flex flex-col min-h-[800px]">

                    {/* Header */}
                    <header className="flex items-center px-4 sm:px-8 py-5 gap-4 sm:gap-8 border-b border-[#3c4043]/50">
                        <div className="text-white text-2xl font-semibold tracking-tighter shrink-0 flex items-center">
                            <span className="text-[#4285f4]">G</span>
                            <span className="text-[#ea4335]">o</span>
                            <span className="text-[#fbbc05]">o</span>
                            <span className="text-[#4285f4]">g</span>
                            <span className="text-[#34a853]">l</span>
                            <span className="text-[#ea4335]">e</span>
                        </div>
                        <div className="flex-1 max-w-[700px] relative">
                            <label htmlFor="ai-overviews-demo-query" className="sr-only">
                                Requête illustrée dans la simulation AI Overviews
                            </label>
                            <input
                                id="ai-overviews-demo-query"
                                type="text"
                                className="w-full bg-[#303134] hover:bg-[#3c4043] focus:bg-[#303134] rounded-full h-[46px] pl-6 pr-28 text-[15px] text-white outline-none border border-transparent shadow-sm transition-colors"
                                value={page.h1}
                                aria-label="Requête illustrée dans la simulation AI Overviews"
                                readOnly
                            />
                            <div className="absolute right-4 top-0 h-full flex items-center gap-3.5 text-[#9aa0a6]">
                                <X className="w-5 h-5 cursor-pointer hover:text-white transition" />
                                <div className="w-[1px] h-6 bg-[#5f6368]"></div>
                                <Mic className="w-5 h-5 cursor-pointer hover:text-[#8ab4f8] transition" />
                                <Camera className="w-5 h-5 cursor-pointer hover:text-[#8ab4f8] transition" />
                                <Search className="w-5 h-5 cursor-pointer text-[#8ab4f8]" />
                            </div>
                        </div>
                        <div className="flex-1 hidden md:block"></div>
                        <div className="flex items-center gap-4 shrink-0 hidden sm:flex">
                            <div className="p-2 hover:bg-white/10 rounded-full cursor-pointer transition">
                                <Grid className="w-5 h-5 text-[#e8eaed]" />
                            </div>
                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer overflow-hidden border border-white/10">
                                <img src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" className="w-full h-full object-contain p-1" />
                            </div>
                        </div>
                    </header>

                    {/* Nav Tabs */}
                    <nav className="flex items-center px-4 sm:px-[132px] gap-6 text-[14px] text-[#9aa0a6] border-b border-[#3c4043] pt-3 overflow-x-auto no-scrollbar">
                        <div className="flex items-center gap-2 cursor-pointer hover:text-white transition whitespace-nowrap pb-[11px] font-medium text-[#8ab4f8]">
                            <Sparkles className="w-4 h-4 fill-current" /> Mode IA
                        </div>
                        <div className="text-white border-b-[3px] border-[#8ab4f8] pb-[11px] cursor-pointer whitespace-nowrap font-medium">Tout</div>
                        <div className="cursor-pointer hover:text-white transition whitespace-nowrap pb-[11px]">Images</div>
                        <div className="cursor-pointer hover:text-white transition whitespace-nowrap pb-[11px] hidden sm:block">Shopping</div>
                        <div className="cursor-pointer hover:text-white transition whitespace-nowrap pb-[11px] hidden md:block">Vidéos</div>
                        <div className="cursor-pointer hover:text-white transition whitespace-nowrap pb-[11px] hidden lg:block">Vidéos courtes</div>
                        <div className="cursor-pointer hover:text-white transition whitespace-nowrap pb-[11px] hidden lg:block">Actualités</div>
                        <div className="cursor-pointer hover:text-white transition whitespace-nowrap pb-[11px]">Plus</div>
                        <div className="sm:ml-auto cursor-pointer hover:text-white transition whitespace-nowrap pb-[11px] hidden sm:block">Outils</div>
                    </nav>

                    {/* Main Content Area */}
                    <div className="flex-1 overflow-y-auto px-4 sm:px-[132px] py-8 flex flex-col lg:flex-row gap-8 lg:gap-16 clean-scroll">

                        {/* Left Column - SGE (AI Overview) */}
                        <div className="flex-1 max-w-[652px]">

                            {/* AI Overview Box */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="relative rounded-3xl bg-gradient-to-b from-[#2a2b2f] to-[#1e1f22] border border-[#3c4043]/60 shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden mb-10"
                            >
                                {/* Top Glow */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#4285f4] via-[#ea4335] to-[#fbbc05] opacity-50"></div>

                                <div className="p-5 sm:p-6">
                                    {/* Box Header */}
                                    <div className="flex items-center justify-between mb-5">
                                        <div className="flex items-center gap-2 text-[14px] text-white font-medium">
                                            <Sparkles className="w-5 h-5 text-[#8ab4f8] fill-current" />
                                            Aperçu généré par IA
                                        </div>
                                        <div className="p-1 hover:bg-white/10 rounded-full cursor-pointer transition">
                                            <MoreVertical className="w-5 h-5 text-[#9aa0a6]" />
                                        </div>
                                    </div>

                                    <div className="min-h-[200px]">
                                        {isGenerating ? (
                                            <div className="py-10 flex justify-center">
                                                <AiThinking />
                                            </div>
                                        ) : (
                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
                                                {/* Entity Header */}
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="w-[42px] h-[42px] rounded-full bg-[#303134] flex items-center justify-center cursor-pointer hover:bg-[#3c4043] shadow-sm transition border border-white/5 shrink-0">
                                                        <Volume2 className="w-[22px] h-[22px] text-[#8ab4f8]" />
                                                    </div>
                                                    <h2 className="text-[28px] text-white font-normal tracking-tight">{page.eyebrow}</h2>
                                                </div>

                                                {/* Text Content */}
                                                <div className="space-y-3 mb-6">
                                                    <p className="text-[15px] leading-[1.6] text-[#e8eaed]">
                                                        <TypewriterText text={page.definition} speed={5} />
                                                    </p>
                                                    <p className="text-[15px] leading-[1.6] text-[#e8eaed]">
                                                        <TypewriterText text={page.summary} speed={5} delay={page.definition?.length * 5 + 300} />
                                                    </p>
                                                </div>

                                                {/* Sections matching the Google UI lists */}
                                                <div className="mt-8 space-y-6">
                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 2.0 }}
                                                    >
                                                        <h3 className="text-[16px] text-white mb-3 font-medium">Failles identifiées</h3>
                                                        <ul className="space-y-2">
                                                            {page.problems?.map((p, i) => (
                                                                <motion.li
                                                                    key={i}
                                                                    initial={{ opacity: 0, x: -5 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: 2.2 + i * 0.1 }}
                                                                    className="flex items-start gap-3 text-[14px] text-[#e8eaed] leading-snug"
                                                                >
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] mt-1.5 shrink-0"></div>
                                                                    <span>{p}</span>
                                                                </motion.li>
                                                            ))}
                                                        </ul>
                                                    </motion.div>

                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 3.0 }}
                                                    >
                                                        <h3 className="text-[16px] text-white mb-3 font-medium">Stratégie de correction</h3>
                                                        <ul className="space-y-2">
                                                            {page.corrections?.map((p, i) => (
                                                                <motion.li
                                                                    key={i}
                                                                    initial={{ opacity: 0, x: -5 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: 3.2 + i * 0.1 }}
                                                                    className="flex items-start gap-3 text-[14px] text-[#e8eaed] leading-snug"
                                                                >
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] mt-1.5 shrink-0"></div>
                                                                    <span>{p}</span>
                                                                </motion.li>
                                                            ))}
                                                        </ul>
                                                    </motion.div>

                                                    <motion.div
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: 4.0 }}
                                                    >
                                                        <h3 className="text-[16px] text-white mb-3 font-medium">Livrables</h3>
                                                        <ul className="space-y-2">
                                                            {page.deliverables?.map((p, i) => (
                                                                <motion.li
                                                                    key={i}
                                                                    initial={{ opacity: 0, x: -5 }}
                                                                    animate={{ opacity: 1, x: 0 }}
                                                                    transition={{ delay: 4.2 + i * 0.1 }}
                                                                    className="flex items-start gap-3 text-[14px] text-[#e8eaed] leading-snug"
                                                                >
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#8ab4f8] mt-1.5 shrink-0"></div>
                                                                    <span>{p}</span>
                                                                </motion.li>
                                                            ))}
                                                        </ul>
                                                    </motion.div>
                                                </div>

                                                {/* Plus button */}
                                                <div className="mt-8 flex justify-center border-t border-white/10 pt-6">
                                                    <div className="px-10 py-2.5 rounded-full bg-[#303134] text-[14px] text-white font-medium hover:bg-[#3c4043] cursor-pointer flex items-center gap-2 transition">
                                                        Plus <ChevronDown className="w-4 h-4" />
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>
                                </div>
                            </motion.div>

                            {/* Standard Organic Results */}
                            <div className="space-y-8 pl-1">
                                {[
                                    {
                                        title: "Agence SEO & GEO à Montréal | Trouvable",
                                        url: "https://trouvable.ca/villes/montreal",
                                        breadcrumb: "trouvable.ca › villes › montreal",
                                        description: "Découvrez notre expertise en référencement naturel (SEO) et IA (GEO) pour positionner votre entreprise en tête des résultats de recherche à Montréal."
                                    },
                                    {
                                        title: "Audit de Visibilité IA - Mesurez votre impact",
                                        url: "https://trouvable.ca/services/audit-visibilite-ia",
                                        breadcrumb: "trouvable.ca › services › audit-visibilite-ia",
                                        description: "Testez comment votre marque apparaît dans ChatGPT, Gemini et Claude. Obtenez un rapport personnalisé sur votre présence dans les moteurs génératifs."
                                    },
                                    {
                                        title: "Notre Méthodologie : Devenir le choix évident",
                                        url: "https://trouvable.ca/methodologie",
                                        breadcrumb: "trouvable.ca › methodologie",
                                        description: "Comprenez notre approche unique combinant architecture de contenu, entités nommées et autorité thématique pour dominer la SGE et le SEO traditionnel."
                                    }
                                ].map((res, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        whileInView={{ opacity: 1, y: 0 }}
                                        viewport={{ once: true }}
                                        transition={{ delay: i * 0.1 }}
                                        className="group"
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <Link href={res.url.replace('https://trouvable.ca', '')} className="flex items-center gap-3 group/header">
                                                <div className="w-[28px] h-[28px] rounded-full bg-[#303134] border border-white/10 flex items-center justify-center overflow-hidden">
                                                    <img src="/logos/trouvable_logo_blanc1.png" alt="T" className="w-5 h-5 object-contain" />
                                                </div>
                                                <div>
                                                    <div className="text-[14px] text-[#e8eaed] leading-tight group-hover/header:text-white transition">Trouvable</div>
                                                    <div className="text-[12px] text-[#9aa0a6] leading-tight truncate max-w-[300px]">{res.breadcrumb}</div>
                                                </div>
                                            </Link>
                                            <MoreVertical className="w-4 h-4 text-[#9aa0a6] ml-auto opacity-0 group-hover:opacity-100 transition" />
                                        </div>
                                        <Link href={res.url.replace('https://trouvable.ca', '')}>
                                            <h3 className="text-[20px] text-[#8ab4f8] cursor-pointer group-hover:underline mb-2 leading-snug">{res.title}</h3>
                                        </Link>
                                        <p className="text-[14px] text-[#bdc1c6] line-clamp-2 leading-[1.6]">{res.description}</p>
                                    </motion.div>
                                ))}
                            </div>
                        </div>

                        {/* Right Column - Knowledge Panel (Simulated with Internal Links) */}
                        <div className="flex-1 max-w-[368px] hidden lg:block">
                            <div className="sticky top-8 space-y-3">
                                {page.internalLinks?.slice(0, 3).map((link, i) => (
                                    <Link
                                        key={i}
                                        href={link.href.replace('https://trouvable.ca', '')}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.5 + i * 0.1 }}
                                        className="rounded-2xl border border-[#3c4043]/50 bg-[#202124] hover:bg-[#303134]/50 transition cursor-pointer p-4 group block"
                                    >
                                        <div className="flex items-start justify-between mb-2">
                                            <h4 className="text-[16px] text-[#8ab4f8] group-hover:underline leading-tight">{link.label}</h4>
                                        </div>
                                        <p className="text-[12px] text-[#9aa0a6] mb-3 truncate">{link.href}</p>
                                        <div className="text-[14px] text-[#bdc1c6] leading-relaxed line-clamp-2">
                                            {link.description || "Découvrez comment optimiser votre stratégie de référencement pour améliorer votre visibilité."}
                                        </div>
                                        <div className="mt-4 flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-[#1e1e1e] flex items-center justify-center">
                                                <BookOpen className="w-3 h-3 text-[#9aa0a6]" />
                                            </div>
                                            <span className="text-[12px] text-[#9aa0a6]">Ressource associée</span>
                                        </div>
                                    </Link>
                                ))}

                                {/* Sponsored / Ads Simulation */}
                                <Link
                                    href="/contact"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 1 }}
                                    className="rounded-2xl border border-[#3c4043]/50 bg-[#202124] p-5 mt-6 relative overflow-hidden group hover:border-[#8ab4f8]/50 transition cursor-pointer block"
                                >
                                    <div className="text-[12px] font-bold text-white mb-3">Sponsorisé</div>
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className="w-[28px] h-[28px] rounded-full bg-white flex items-center justify-center overflow-hidden">
                                            <img src="/logos/trouvable_logo_blanc1.png" alt="T" className="w-full h-full object-cover invert" />
                                        </div>
                                        <div>
                                            <div className="text-[14px] text-[#e8eaed]">Trouvable</div>
                                            <div className="text-[12px] text-[#9aa0a6]">https://trouvable.ca/contact</div>
                                        </div>
                                    </div>
                                    <h4 className="text-[18px] text-[#8ab4f8] group-hover:underline mb-2 leading-tight">Augmentez votre visibilité IA</h4>
                                    <p className="text-[14px] text-[#bdc1c6] mb-4 leading-relaxed">Passez d'introuvable à leader de votre marché avec notre méthodologie GEO avancée.</p>
                                    <div className="inline-flex items-center gap-2 text-[#8ab4f8] text-[14px] font-medium">
                                        Commencer maintenant <ArrowRight className="w-4 h-4" />
                                    </div>
                                </Link>
                            </div>
                        </div>

                    </div>
                </div>

                {trustBrief}

                {/* Regular bottom content */}
                <div className="mt-20 max-w-[1400px] mx-auto">
                    <section className="px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="indigo" heading="Questions fréquentes" /></section>
                    <section className="border-t border-white/5 px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="indigo" heading="Univers connecté" /></section>
                </div>
            </main>


        </div>
    );
}
