'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Search, Plus, MessageSquare, Book, Sparkles, Settings, Share, MoreVertical, Mic, ChevronDown, PenSquare, LayoutGrid } from 'lucide-react';
import { FaqSection, LinksSection, AiThinking, TypewriterText, PlatformEditorialLead } from './shared-primitives';

function buildChats(page) {
    return [
        {
            id: 'main',
            label: 'Visibilité Gemini',
            question: 'Comment être visible dans Gemini ?',
            aiText: page.definition,
            aiSummary: page.summary,
            showSections: true,
        },
        {
            id: 'visibilite',
            label: 'Visibilité IA de Trouvable Montréal',
            question: 'Comment améliorer la visibilité IA de Trouvable sur le marché de Montréal ?',
            aiText: 'La visibilité IA sur Montréal nécessite une approche locale précise. Les moteurs génératifs comme Gemini exploitent les signaux géographiques, les entités locales et la cohérence entre votre fiche Google Business, vos pages de services et vos mentions externes.',
            aiSummary: 'Pour Montréal spécifiquement, il faut travailler le bilinguisme des pages, relier les quartiers et zones servies aux services offerts, et s\'assurer que les données structurées LocalBusiness sont cohérentes avec les informations affichées.',
            showSections: false,
        },
        {
            id: 'fiche-google',
            label: 'Optimisation de la fiche Google My...',
            question: 'Comment optimiser une fiche Google My Business pour les moteurs IA comme Gemini ?',
            aiText: 'La fiche Google Business Profile est un signal majeur pour Gemini puisqu\'il s\'inscrit dans l\'écosystème Google. Les informations de la fiche (catégories, description, avis, photos, horaires) sont directement exploitées par Gemini pour répondre aux questions locales.',
            aiSummary: 'Les actions prioritaires : compléter tous les champs, choisir la bonne catégorie principale, publier des posts réguliers, encourager les avis avec réponse, et s\'assurer que les coordonnées correspondent exactement à celles du site web.',
            showSections: true,
        },
        {
            id: 'serp',
            label: 'Analyse concurrentielle des SERP...',
            question: 'Peux-tu analyser la concurrence SERP pour les agences GEO à Montréal ?',
            aiText: 'L\'analyse concurrentielle des SERP pour "agence GEO Montréal" révèle un marché encore jeune. Peu d\'acteurs ont structuré leurs pages spécifiquement pour les moteurs génératifs, ce qui crée une fenêtre d\'opportunité pour les entreprises qui agissent maintenant.',
            aiSummary: 'Les leaders actuels se distinguent par la profondeur de leur contenu, la qualité de leur maillage interne et la cohérence de leurs entités à travers Google, les répertoires et les mentions éditoriales. La clé est de produire des pages plus claires et mieux reliées que la concurrence.',
            showSections: false,
        },
    ];
}

export default function GeminiPage({ page, trustBrief }) {
    const chats = buildChats(page);
    const [activeChat, setActiveChat] = useState('main');
    const [messages, setMessages] = useState([]);
    const [animKey, setAnimKey] = useState(0);

    const activeConversation = chats.find(c => c.id === activeChat) || chats[0];

    const loadConversation = useCallback((chatId) => {
        const chat = chats.find(c => c.id === chatId) || chats[0];
        setActiveChat(chatId);
        setMessages([]);
        setAnimKey(prev => prev + 1);
        const timer1 = setTimeout(() => { setMessages([{ role: 'user', text: chat.question }]); }, 300);
        const timer2 = setTimeout(() => { setMessages(prev => [...prev, { role: 'ai', isThinking: true }]); }, 800);
        const timer3 = setTimeout(() => { 
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'ai', isThinking: false, title: page.h1, text: chat.aiText, summary: chat.aiSummary, sections: chat.showSections };
                return newMsgs;
            });
        }, 2200);
        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
    }, [chats, page.h1]);
    
    useEffect(() => {
        const timer1 = setTimeout(() => { setMessages([{ role: 'user', text: activeConversation.question }]); }, 500);
        const timer2 = setTimeout(() => { setMessages(prev => [...prev, { role: 'ai', isThinking: true }]); }, 1200);
        const timer3 = setTimeout(() => {
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'ai', isThinking: false, title: page.h1, text: activeConversation.aiText, summary: activeConversation.aiSummary, sections: activeConversation.showSections };
                return newMsgs;
            });
        }, 2600);
        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-[#060609]">
            <main className="pb-24">
                <PlatformEditorialLead page={page} />
                <div className="px-6 sm:px-10">
                {/* Native App Window - Gemini Style */}
                <div className="mx-auto max-w-[1280px] h-[800px] rounded-2xl border border-white/10 bg-[#131314] shadow-2xl flex overflow-hidden relative font-sans">
                    
                    {/* Sidebar */}
                    <div className="w-[280px] bg-[#1e1f22] flex-col hidden lg:flex border-r border-white/5 shrink-0">
                        <div className="p-4 flex items-center justify-between">
                            <Menu className="w-5 h-5 text-[#e3e3e3] cursor-pointer" />
                            <div className="flex gap-4">
                                <Search className="w-5 h-5 text-[#e3e3e3] cursor-pointer" />
                                <PenSquare className="w-5 h-5 text-[#e3e3e3] cursor-pointer" />
                            </div>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto px-2 mt-4 space-y-4 clean-scroll text-[13px] font-medium text-[#e3e3e3]">
                            
                            <div className="space-y-1">
                                <div className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-white/10 cursor-pointer">
                                    <MessageSquare className="w-4 h-4 text-white/50" /> Expert SEO B2B
                                </div>
                                <div className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-white/10 cursor-pointer">
                                    <LayoutGrid className="w-4 h-4" /> Mes contenus
                                </div>
                            </div>

                            <div>
                                <div className="px-3 py-1.5 text-white/50 text-[11px] font-semibold flex justify-between items-center group cursor-pointer hover:text-white/80">
                                    Bloc-notes <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                </div>
                                <div className="space-y-1 mt-1">
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-white/10 cursor-pointer text-white/80">
                                        <Book className="w-4 h-4 shrink-0" /> <span className="truncate">Directives d'audit SEO local...</span>
                                    </div>
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-white/10 cursor-pointer text-white/80">
                                        <Book className="w-4 h-4 shrink-0" /> <span className="truncate">Checklist d'optimisation GEO...</span>
                                    </div>
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-white/10 cursor-pointer text-[#8ab4f8]">
                                        <Plus className="w-4 h-4" /> Nouveau notebook
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="px-3 py-1.5 text-white/50 text-[11px] font-semibold flex justify-between items-center group cursor-pointer hover:text-white/80">
                                    Gems <ChevronDown className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                                </div>
                                <div className="space-y-1 mt-1">
                                    <div className="flex items-center gap-3 px-3 py-2 rounded-full hover:bg-white/10 cursor-pointer text-white/80">
                                        <Sparkles className="w-4 h-4 shrink-0" /> <span className="truncate">Expert SEO B2B</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="px-3 py-1.5 text-white/50 text-[11px] font-semibold">Conversations</div>
                                <div className="space-y-1 mt-1">
                                    {chats.map((chat) => (
                                        <div
                                            key={chat.id}
                                            onClick={() => loadConversation(chat.id)}
                                            className={`px-3 py-2 rounded-full cursor-pointer truncate transition-colors ${
                                                activeChat === chat.id
                                                    ? 'flex items-center justify-between bg-[#1e3a5f] text-[#8ab4f8]'
                                                    : 'text-white/80 hover:bg-white/10'
                                            }`}
                                        >
                                            <span className="truncate">{chat.label}</span>
                                            {activeChat === chat.id && <MoreVertical className="w-4 h-4 shrink-0" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            
                        </div>

                        <div className="p-3">
                            <div className="flex items-center gap-3 px-3 py-2 hover:bg-white/10 rounded-full cursor-pointer">
                                <Menu className="w-5 h-5 text-white/80" />
                                <span className="text-white text-[16px] font-medium tracking-tight">Gemini</span>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col relative">
                        {/* Header */}
                        <div className="flex h-16 items-center justify-between px-6 shrink-0 z-10 text-[#e3e3e3]">
                            <div className="flex items-center gap-2 text-[18px] font-medium">
                                Gemini
                            </div>
                            <div className="hidden md:flex text-[14px] font-medium truncate max-w-[300px]">
                                {activeConversation.label}
                            </div>
                            <div className="flex items-center gap-4">
                                <Share className="w-5 h-5 cursor-pointer text-[#e3e3e3]" title="Partager" />
                                <MoreVertical className="w-5 h-5 cursor-pointer text-[#e3e3e3]" />
                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center cursor-pointer overflow-hidden">
                                    <img src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" className="w-full h-full object-cover" />
                                </div>
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto px-4 pt-8 pb-32 sm:px-12 space-y-8 clean-scroll">
                            <AnimatePresence mode="wait">
                            <motion.div key={animKey} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="space-y-8">
                            {messages.map((msg, idx) => (
                                <motion.div 
                                    key={idx} 
                                    initial={{ opacity: 0, y: 10 }} 
                                    animate={{ opacity: 1, y: 0 }} 
                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                >
                                    {msg.role === 'user' ? (
                                        <div className="bg-[#282a2c] text-[#e3e3e3] px-5 py-4 rounded-3xl rounded-tr-sm text-[15px] max-w-[85%] leading-relaxed font-medium">
                                            {msg.text}
                                        </div>
                                    ) : (
                                        <div className="flex gap-4 max-w-full">
                                            <div className="w-8 h-8 shrink-0 mt-1 flex items-center justify-center">
                                                <img src="/logos/gemini.png" alt="Gemini" className="w-6 h-6 object-contain" />
                                            </div>
                                            <div className="text-[#e3e3e3] text-[15px] leading-[1.7] space-y-6 flex-1 max-w-[800px]">
                                                {msg.isThinking ? (
                                                    <AiThinking />
                                                ) : (
                                                    <>
                                                        {/* Removed Afficher le raisonnement & Title */}
                                                        <p><TypewriterText text={msg.text} speed={8} /></p>
                                                        <p><TypewriterText text={msg.summary} delay={(msg.text?.length || 0) * 8 + 200} speed={8} /></p>
                                                        
                                                        {msg.sections && (
                                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.4 }} className="space-y-4 mt-6">
                                                                <ul className="space-y-4">
                                                                    <li className="space-y-2">
                                                                        <strong className="text-white">1. Problèmes (ex: Pourquoi je suis invisible)</strong>
                                                                        <ul className="list-disc pl-5 space-y-2 text-[#c4c7c5]">
                                                                            {page.problems.map((p, i) => (
                                                                                <motion.li 
                                                                                    key={i}
                                                                                    initial={{ opacity: 0, x: -5 }}
                                                                                    animate={{ opacity: 1, x: 0 }}
                                                                                    transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.6 + i * 0.1 }}
                                                                                >
                                                                                    {p}
                                                                                </motion.li>
                                                                            ))}
                                                                        </ul>
                                                                    </li>
                                                                    <li className="space-y-2">
                                                                        <strong className="text-white">2. Solutions (ex: Ce que Trouvable corrige)</strong>
                                                                        <ul className="list-disc pl-5 space-y-2 text-[#c4c7c5]">
                                                                            {page.corrections.map((p, i) => (
                                                                                <motion.li 
                                                                                    key={i}
                                                                                    initial={{ opacity: 0, x: -5 }}
                                                                                    animate={{ opacity: 1, x: 0 }}
                                                                                    transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.8 + i * 0.1 }}
                                                                                >
                                                                                    {p}
                                                                                </motion.li>
                                                                            ))}
                                                                        </ul>
                                                                    </li>
                                                                    <li className="space-y-2">
                                                                        <strong className="text-white">3. Livrables (ex: Résultat final)</strong>
                                                                        <ul className="list-disc pl-5 space-y-2 text-[#c4c7c5]">
                                                                            {page.deliverables.map((p, i) => (
                                                                                <motion.li 
                                                                                    key={i}
                                                                                    initial={{ opacity: 0, x: -5 }}
                                                                                    animate={{ opacity: 1, x: 0 }}
                                                                                    transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 1.0 + i * 0.1 }}
                                                                                >
                                                                                    {p}
                                                                                </motion.li>
                                                                            ))}
                                                                        </ul>
                                                                    </li>
                                                                </ul>
                                                            </motion.div>
                                                        )}
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                            </motion.div>
                            </AnimatePresence>
                        </div>

                        {/* Input Bar */}
                        <div className="px-4 pb-6 sm:px-12 lg:px-32 bg-[#131314] shrink-0 z-10">
                            <div className="relative flex flex-col bg-[#1e1f22] rounded-[24px] overflow-hidden border border-white/5 shadow-lg">
                                <div className="w-full text-[#c4c7c5] text-[15px] bg-transparent outline-none px-5 py-4 min-h-[50px]">
                                    Demander à Gemini
                                </div>
                                <div className="flex justify-between items-center px-3 pb-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center cursor-pointer text-white/70">
                                            <Plus className="w-5 h-5" />
                                        </div>
                                        <div className="px-3 py-1.5 rounded-full hover:bg-white/5 cursor-pointer text-[13px] font-medium text-white/70 flex items-center gap-2">
                                            <Settings className="w-4 h-4" /> Outils
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="px-3 py-1.5 rounded-full hover:bg-white/5 cursor-pointer text-[13px] font-medium text-white/70 flex items-center gap-1">
                                            Pro <ChevronDown className="w-3 h-3" />
                                        </div>
                                        <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center cursor-pointer text-white">
                                            <Mic className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="text-center mt-3 text-[11px] text-[#c4c7c5]">
                                Gemini est une IA et peut se tromper.
                            </div>
                        </div>
                    </div>
                </div>
                </div>
                
                {/* Regular content */}
                {trustBrief}
                <div className="mt-20">
                    <section className="px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="indigo" heading="Questions fréquentes" /></section>
                    <section className="border-t border-white/5 px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="indigo" heading="Univers connecté" /></section>

                </div>
            </main>
        </div>
    );
}

