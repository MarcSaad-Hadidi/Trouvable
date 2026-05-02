'use client';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Search, Globe, Plus, PlusCircle, Monitor, Grid, SlidersHorizontal, Clock, Share, MoreHorizontal, ImageIcon, Mic, ChevronDown, Pin } from 'lucide-react';
import { FaqSection, LinksSection, AiThinking, TypewriterText } from './shared-primitives';

function buildChats(page) {
    return [
        { id: 'main', label: 'Visibilité Perplexity', question: 'Comment être visible dans Perplexity ?', aiText: page.definition, aiSummary: page.summary, showSections: true },
        { id: 'citations', label: 'Analyse de citations web', question: 'Comment maximiser mes citations dans les sources Perplexity ?', aiText: 'Perplexity fonctionne avant tout comme un moteur de recherche en temps réel. Pour être cité, vous devez avoir des pages factuelles (sans discours commercial) qui se positionnent rapidement sur l\'actualité de votre secteur, ou qui offrent des définitions de référence (glossaires B2B).', aiSummary: 'La stratégie de citation passe par des RP digitales et la publication de données exclusives. Si vos concurrents publient des opinions, publiez des statistiques et des tableaux de données que Perplexity peut facilement extraire.', showSections: false },
        { id: 'format', label: 'Formatage pour l\'IA', question: 'Comment formater mon contenu pour un moteur de réponse ?', aiText: 'Les moteurs de réponse détestent les murs de texte. Adoptez la "Pyramide Inversée IA" : commencez chaque page par une synthèse directe de 50 mots (le "TL;DR"), puis développez avec des listes à puces (<ul>), des H2 sous forme de questions (<h2>), et finissez par le contexte.', aiSummary: 'Assurez-vous que vos images soient entourées de contexte sémantique (balise <figcaption> précise) car Perplexity affiche souvent des miniatures à côté des citations.', showSections: false },
        { id: 'tracking', label: 'Suivi de visibilité IA', question: 'Est-il possible de traquer sa visibilité sur Perplexity ?', aiText: 'Contrairement à Google Search Console, Perplexity ne fournit pas de dashboard officiel de clics ou d\'impressions. Le suivi s\'effectue en analysant les logs serveurs pour repérer le bot "PerplexityBot" et en effectuant des requêtes ciblées via API pour vérifier la part de voix (Share of Voice).', aiSummary: 'Chez Trouvable, nous mettons en place des protocoles de tests de requêtes réguliers (queries informationnelles, comparatives, transactionnelles) pour observer si vos entités sont appelées en source principale (Top 3) ou secondaire.', showSections: true },
    ];
}

export default function PerplexityPage({ page, trustBrief }) {
    const chats = buildChats(page);
    const [activeChat, setActiveChat] = useState('main');
    const [isSearching, setIsSearching] = useState(false);
    const [showResults, setShowResults] = useState(false);

    const activeConversation = chats.find(c => c.id === activeChat) || chats[0];

    const loadConversation = (chatId) => {
        setActiveChat(chatId);
        setIsSearching(true);
        setShowResults(false);

        setTimeout(() => {
            setIsSearching(false);
            setShowResults(true);
        }, 1500);
    };

    useEffect(() => {
        setIsSearching(true);
        const timer1 = setTimeout(() => {
            setIsSearching(false);
            setShowResults(true);
        }, 1500);
        return () => clearTimeout(timer1);
    }, []);

    return (
        <div className="min-h-screen bg-[#050709]">
            <main className="pt-[100px] pb-24 px-6 sm:px-10">
                {/* Native App Window - Perplexity Style */}
                <div className="mx-auto max-w-[1280px] h-[800px] rounded-2xl border border-white/10 bg-[#191a1a] shadow-2xl flex overflow-hidden relative font-sans text-[#e3e3e3]">

                    {/* Sidebar */}
                    <div className="w-[240px] bg-[#191a1a] border-r border-white/5 flex-col hidden md:flex shrink-0">
                        <div className="px-4 py-3 flex items-center justify-between">
                            <img src="/logos/perplexity.webp" alt="Perplexity" className="w-8 h-8 object-contain" />
                            <div className="w-6 h-6 border border-white/10 rounded-md flex items-center justify-center cursor-pointer hover:bg-white/5">
                                <span className="w-3 h-[1px] bg-white/70 block"></span>
                            </div>
                        </div>

                        <div className="px-3 mt-2">
                            <div className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] bg-[#2a2b2b] text-white text-[14px] font-medium cursor-pointer hover:bg-[#333]">
                                <Plus className="w-4 h-4" /> New
                            </div>
                        </div>

                        <div className="px-3 mt-4 space-y-1">
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 text-[14px] font-medium hover:bg-white/5 cursor-pointer">
                                <Monitor className="w-4 h-4" /> Computer
                            </div>
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 text-[14px] font-medium hover:bg-white/5 cursor-pointer">
                                <Grid className="w-4 h-4" /> Spaces
                            </div>
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-white/70 text-[14px] font-medium hover:bg-white/5 cursor-pointer">
                                <SlidersHorizontal className="w-4 h-4" /> Customize
                            </div>
                            <div className="flex items-center justify-between px-3 py-2 rounded-lg text-white/70 text-[14px] font-medium hover:bg-white/5 cursor-pointer mt-4">
                                <div className="flex items-center gap-3">
                                    <Clock className="w-4 h-4" /> History
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 clean-scroll text-[13px] text-white/60">
                            {chats.map(c => (
                                <div
                                    key={c.id}
                                    onClick={() => loadConversation(c.id)}
                                    className={`block px-3 py-1.5 rounded-lg cursor-pointer truncate ${activeChat === c.id ? 'bg-white/10 text-white' : 'hover:bg-white/5'} transition-colors`}
                                >
                                    {c.label}
                                </div>
                            ))}
                        </div>

                        <div className="p-3 mt-auto border-t border-white/5">
                            <div className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                    <img src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-white truncate">Trouvable</div>
                                    <div className="text-[10px] font-semibold text-[#1cb0f6] bg-[#1cb0f6]/10 px-1.5 py-0.5 rounded w-fit mt-0.5">Pro</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col relative bg-[#191a1a]">

                        {/* Header Tabs */}
                        <div className="flex h-14 items-center justify-between px-6 border-b border-white/5">
                            <div className="w-20"></div> {/* spacer */}
                            <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2 text-[14px] font-medium text-white border-b-2 border-white pb-4 mt-4 cursor-pointer">
                                    <img src="/logos/perplexity.webp" alt="Perplexity" className="w-4 h-4 object-contain opacity-80" /> Answer
                                </div>
                                <div className="flex items-center gap-2 text-[14px] font-medium text-white/50 hover:text-white pb-4 mt-4 cursor-pointer">
                                    <Globe className="w-4 h-4" /> Links
                                </div>
                                <div className="flex items-center gap-2 text-[14px] font-medium text-white/50 hover:text-white pb-4 mt-4 cursor-pointer">
                                    <ImageIcon className="w-4 h-4" /> Images
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 text-[13px] font-medium text-white hover:bg-white/5 cursor-pointer">
                                    <Share className="w-3.5 h-3.5" /> Partager
                                </div>
                                <MoreHorizontal className="w-5 h-5 text-white/50 cursor-pointer" />
                            </div>
                        </div>

                        {/* Content Scroll */}
                        <div className="flex-1 overflow-y-auto px-6 pt-8 pb-32 sm:px-12 lg:px-24 clean-scroll">
                            <div className="max-w-[800px] mx-auto">

                                {/* User Query Bubble */}
                                <div className="flex justify-end mb-8">
                                    <div className="bg-[#2a2b2b] text-[#e3e3e3] px-5 py-3 rounded-2xl text-[16px] max-w-[80%] font-medium">
                                        {activeConversation.question}
                                    </div>
                                </div>

                                {isSearching && (
                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[14px] text-white/50 font-medium h-[40px]">
                                        <AiThinking /> <span className="ml-2">Recherchant des sources factuelles...</span>
                                    </motion.div>
                                )}

                                {showResults && (
                                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

                                        {/* Status Line */}
                                        <div className="flex items-center gap-2 text-[14px] text-[#1cb0f6] font-medium mb-4">
                                            <Search className="w-4 h-4" /> Synthèse multi-sources
                                        </div>

                                        {/* Answer Section */}
                                        <div className="text-[#c4c7c5] text-[15px] leading-[1.8] space-y-6">

                                            <div className="text-white mb-2 font-medium">
                                                <TypewriterText text={activeConversation.aiText} speed={8} />
                                            </div>

                                            <div className="text-white/80">
                                                <TypewriterText text={activeConversation.aiSummary} delay={(activeConversation.aiText?.length || 0) * 8 + 200} speed={8} /> <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ((activeConversation.aiText?.length || 0) + (activeConversation.aiSummary?.length || 0)) * 0.008 + 0.4 }} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px] text-white/70 ml-2 border border-white/5"><Pin className="w-2.5 h-2.5" /> Source</motion.span>
                                            </div>

                                            {activeConversation.showSections && (
                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ((activeConversation.aiText?.length || 0) + (activeConversation.aiSummary?.length || 0)) * 0.008 + 0.4 }}>
                                                    <div className="mt-6 space-y-4">
                                                        <h3 className="text-[18px] font-semibold text-white">Ce qui bloque votre visibilité</h3>
                                                        <ul className="space-y-2">
                                                            {page.problems.map((p, i) => (
                                                                <li key={i} className="text-white/80"><span className="text-[#1cb0f6] mr-2">⬢</span> {p}</li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div className="mt-6 space-y-4">
                                                        <h3 className="text-[18px] font-semibold text-white">Optimisations GEO</h3>
                                                        <ul className="space-y-2">
                                                            {page.corrections.map((p, i) => (
                                                                <li key={i} className="text-white/80"><span className="text-[#2eb886] mr-2">⬢</span> {p}</li>
                                                            ))}
                                                        </ul>
                                                    </div>

                                                    <div className="mt-6 space-y-4">
                                                        <h3 className="text-[18px] font-semibold text-white">Livrables de l'expert</h3>
                                                        <ul className="grid sm:grid-cols-2 gap-3">
                                                            {page.deliverables.map((p, i) => (
                                                                <li key={i} className="text-white/80 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5"><span className="text-white font-medium block mb-1">Étape {i + 1}</span> {p}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </div>

                                    </motion.div>
                                )}
                            </div>
                        </div>

                        {/* Floating Search Bar */}
                        <div className="px-6 pb-6 bg-[#191a1a]">
                            <div className="max-w-[800px] mx-auto bg-[#2a2b2b] border border-white/10 rounded-2xl flex flex-col p-3 shadow-lg">
                                <div className="w-full text-white/60 text-[15px] bg-transparent outline-none px-2 mb-2">
                                    Ask a follow-up
                                </div>
                                <div className="flex items-center justify-between px-2">
                                    <div className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center cursor-pointer text-white/70">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-white/5 cursor-pointer text-[13px] font-medium text-white/70">
                                            GPT-5.4 Thinking <ChevronDown className="w-3 h-3" />
                                        </div>
                                        <Mic className="w-5 h-5 text-white/50 cursor-pointer" />
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/50 cursor-pointer">
                                            <ArrowUp className="w-4 h-4" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Regular content appended below the "app" */}
                {trustBrief}
                <div className="mt-20">
                    <section className="px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="cyan" heading="Questions fréquentes" /></section>
                    <section className="border-t border-white/5 px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="cyan" heading="Plateformes connexes" /></section>

                </div>
            </main>
        </div>
    );
}

