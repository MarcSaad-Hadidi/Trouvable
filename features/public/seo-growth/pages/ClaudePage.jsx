'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, AlertTriangle, PackageOpen, Plus, Search, MessageSquare, Folder, Code2, Settings, Download, MoreHorizontal, ChevronDown, AlignLeft } from 'lucide-react';
import { FaqSection, LinksSection, AiThinking, TypewriterText, PlatformEditorialLead } from './shared-primitives';

function SoundWavesIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <path d="M12 4v16M8 8v8M16 8v8M4 11v2M20 11v2" />
        </svg>
    );
}

function buildChats(page) {
    return [
        { id: 'main', label: 'Visibilité Claude', question: 'Comment être visible dans Claude ?', aiText: page.definition, aiSummary: page.summary, showSections: true },
        { id: 'refactor', label: 'Refactoriser les pages SEO, GEO...', question: 'Comment restructurer mes pages SEO et GEO pour Claude ?', aiText: 'Claude privilégie les contenus analytiques et bien structurés. Pour refactoriser vos pages, séparez clairement chaque service dans sa propre page avec une définition précise, des critères de décision et des preuves vérifiables.', aiSummary: 'Une bonne structure pour Claude : introduction en 2 phrases, problème client, méthode détaillée, livrables concrets, puis FAQ. Chaque section doit pouvoir être comprise isolément si Claude l\'extrait pour une synthèse.', showSections: false },
        { id: 'audit', label: 'Audit complet de visibilité IA', question: 'Que doit couvrir un audit de visibilité IA complet pour Claude ?', aiText: 'Un audit pour Claude doit aller au-delà du SEO classique. Il faut vérifier la profondeur sémantique de chaque page, la qualité des relations entre entités, et la capacité du contenu à soutenir une analyse comparative approfondie.', aiSummary: 'Les points clés à auditer : hiérarchie des titres, présence de définitions autonomes, tableaux comparatifs, FAQ factuelles, preuves documentées, et maillage entre services, méthode et résultats.', showSections: true },
        { id: 'prompting', label: 'Recommandations Prompting', question: 'Quels prompts utiliser pour tester ma visibilité dans Claude ?', aiText: 'Pour tester votre visibilité dans Claude, utilisez des prompts analytiques B2B : "Compare les agences GEO à Montréal", "Quelle firme recommandes-tu pour améliorer la visibilité IA ?", ou "Analyse les forces et faiblesses de [votre secteur]".', aiSummary: 'Testez chaque prompt 3 fois à des moments différents. Notez si votre entreprise est mentionnée, avec quels attributs, et quelles sources Claude cite. Comparez avec ChatGPT et Perplexity pour une vue complète.', showSections: false },
    ];
}

export default function ClaudePage({ page, trustBrief }) {
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
        const timer2 = setTimeout(() => { setMessages(prev => [...prev, { role: 'ai', text: chat.aiText, summary: chat.aiSummary, sections: chat.showSections }]); }, 1000);
        return () => { clearTimeout(timer1); clearTimeout(timer2); };
    }, [chats]);
    
    useEffect(() => {
        const timer1 = setTimeout(() => { setMessages([{ role: 'user', text: activeConversation.question }]); }, 500);
        const timer2 = setTimeout(() => { setMessages(prev => [...prev, { role: 'ai', text: activeConversation.aiText, summary: activeConversation.aiSummary, sections: activeConversation.showSections }]); }, 1500);
        return () => { clearTimeout(timer1); clearTimeout(timer2); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-[#090706]">
            <main className="pb-24">
                <PlatformEditorialLead page={page} />
                <div className="px-6 sm:px-10">
                {/* Native App Window - Claude Style */}
                <div className="mx-auto max-w-[1280px] h-[800px] rounded-2xl border border-white/10 bg-[#252422] shadow-2xl flex overflow-hidden relative font-sans text-[#e3e3e3]">
                    
                    {/* Sidebar */}
                    <div className="w-[260px] bg-[#252422] border-r border-white/5 flex-col hidden md:flex shrink-0">
                        <div className="p-4 flex items-center justify-between">
                            <span className="text-[17px] font-medium text-[#e3e3e3] font-serif tracking-wide">Claude</span>
                            <AlignLeft className="w-5 h-5 text-white/50 cursor-pointer hover:text-white" />
                        </div>

                        <div className="px-3 space-y-1 mt-2">
                            <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 cursor-pointer group">
                                <div className="flex items-center gap-3 text-white text-[14px]">
                                    <Plus className="w-4 h-4" /> Nouveau chat
                                </div>
                                <span className="text-[10px] text-white/30 group-hover:text-white/50">Ctrl+I+O</span>
                            </div>
                            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-white/70 text-[14px]">
                                <Search className="w-4 h-4" /> Rechercher
                            </div>
                            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-white/70 text-[14px]">
                                <MessageSquare className="w-4 h-4" /> Chats
                            </div>
                        </div>

                        <div className="px-3 mt-4 space-y-1 border-t border-white/5 pt-4">
                            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-white/70 text-[14px]">
                                <Folder className="w-4 h-4" /> Projects
                            </div>
                            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-white/70 text-[14px]">
                                <Sparkles className="w-4 h-4" /> Artifacts
                            </div>
                            <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-white/70 text-[14px]">
                                <div className="flex items-center gap-3">
                                    <Code2 className="w-4 h-4" /> Code
                                </div>
                                <span className="text-[10px] border border-white/20 text-white/40 px-1.5 py-0.5 rounded-full">Mise à niveau</span>
                            </div>
                        </div>

                        <div className="px-3 mt-4 space-y-1 border-t border-white/5 pt-4">
                            <div className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/5 cursor-pointer text-white/70 text-[14px]">
                                <Settings className="w-4 h-4" /> Customize
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 mt-4 space-y-1 clean-scroll text-[13px] text-white/60 border-t border-white/5 pt-4">
                            <div className="text-[11px] font-medium text-white/40 px-2 mb-2">Récents</div>
                            {chats.map((chat) => (
                                <div
                                    key={chat.id}
                                    onClick={() => loadConversation(chat.id)}
                                    className={`px-2.5 py-1.5 rounded-lg cursor-pointer truncate transition-colors ${
                                        activeChat === chat.id
                                            ? 'flex items-center justify-between bg-white/5 text-white'
                                            : 'hover:bg-white/5'
                                    }`}
                                >
                                    <span className="truncate">{chat.label}</span>
                                    {activeChat === chat.id && <MoreHorizontal className="w-4 h-4 text-white/50" />}
                                </div>
                            ))}
                        </div>

                        <div className="p-3 mt-auto border-t border-white/5">
                            <div className="flex items-center justify-between px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                        <img src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-[14px] text-white/90">Trouvable</div>
                                        <div className="text-[11px] text-white/40">Pro plan</div>
                                    </div>
                                </div>
                                <Download className="w-4 h-4 text-white/50" />
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col relative bg-[#252422]">
                        
                        {/* Header */}
                        <div className="flex h-14 items-center justify-between px-4 shrink-0 z-10">
                            <div className="flex items-center gap-2 text-[14px] font-medium text-white/70 hover:bg-white/5 px-2 py-1.5 rounded-lg cursor-pointer truncate max-w-[280px]">
                                {activeConversation.label} <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                            </div>
                            <div className="px-3 py-1.5 rounded-lg border border-white/10 text-[13px] font-medium text-white/80 hover:bg-white/5 cursor-pointer">
                                Partager
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 overflow-y-auto px-4 pt-8 pb-32 sm:px-12 lg:px-32 space-y-8 clean-scroll">
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
                                        <div className="bg-[#3c3a36] text-[#e3e3e3] px-5 py-3.5 rounded-2xl text-[15px] max-w-[80%] leading-relaxed border border-white/5">
                                            {msg.text}
                                        </div>
                                    ) : (
                                        <div className="flex gap-5 max-w-[95%]">
                                            <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 mt-1 flex items-center justify-center bg-white p-1">
                                                <img src="/logos/claude.png" alt="Claude" className="w-full h-full object-contain" />
                                            </div>
                                            <div className="text-[#e3e3e3] text-[15px] leading-[1.75] space-y-6 pt-1 font-serif">
                                                {msg.isThinking ? (
                                                    <AiThinking />
                                                ) : (
                                                    <>
                                                        <p className="font-medium text-white text-[16px]"><TypewriterText text={msg.text} speed={8} /></p>
                                                        <p className="text-white/80"><TypewriterText text={msg.summary} delay={(msg.text?.length || 0) * 8 + 200} speed={8} /></p>
                                                        
                                                        {msg.sections && (
                                                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.4 }} className="grid gap-4 sm:grid-cols-2 mt-6 font-sans">
                                                                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                                                                    <div className="flex items-center gap-2 text-[#E5D9C5] mb-3 font-medium text-sm tracking-wide">
                                                                        <AlertTriangle className="w-4 h-4 text-[#cc785c]" /> Problématiques
                                                                    </div>
                                                                    <ul className="space-y-2 text-[14px] text-white/70">
                                                                        {page.problems.map((p, i) => (
                                                                            <motion.li 
                                                                                key={i} 
                                                                                initial={{ opacity: 0, x: -5 }} 
                                                                                animate={{ opacity: 1, x: 0 }} 
                                                                                transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.6 + i * 0.1 }}
                                                                                className="flex gap-2"
                                                                            >
                                                                                <span className="text-[#cc785c]">⬢</span> {p}
                                                                            </motion.li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
                                                                    <div className="flex items-center gap-2 text-[#E5D9C5] mb-3 font-medium text-sm tracking-wide">
                                                                        <CheckCircle2 className="w-4 h-4 text-[#7cb382]" /> Solutions
                                                                    </div>
                                                                    <ul className="space-y-2 text-[14px] text-white/70">
                                                                        {page.corrections.map((p, i) => (
                                                                            <motion.li 
                                                                                key={i} 
                                                                                initial={{ opacity: 0, x: -5 }} 
                                                                                animate={{ opacity: 1, x: 0 }} 
                                                                                transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.8 + i * 0.1 }}
                                                                                className="flex gap-2"
                                                                            >
                                                                                <span className="text-[#7cb382]">⬢</span> {p}
                                                                            </motion.li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
                                                                <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5 sm:col-span-2">
                                                                    <div className="flex items-center gap-2 text-[#E5D9C5] mb-3 font-medium text-sm tracking-wide">
                                                                        <PackageOpen className="w-4 h-4 text-[#6b9dcc]" /> Livrables
                                                                    </div>
                                                                    <ul className="grid sm:grid-cols-2 gap-2 text-[14px] text-white/70">
                                                                        {page.deliverables.map((p, i) => (
                                                                            <motion.li 
                                                                                key={i} 
                                                                                initial={{ opacity: 0, x: -5 }} 
                                                                                animate={{ opacity: 1, x: 0 }} 
                                                                                transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 1.0 + i * 0.1 }}
                                                                                className="flex gap-2"
                                                                            >
                                                                                <span className="text-[#6b9dcc]">⬢</span> {p}
                                                                            </motion.li>
                                                                        ))}
                                                                    </ul>
                                                                </div>
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
                        <div className="px-4 pb-6 sm:px-12 lg:px-32 bg-[#252422] shrink-0 z-10">
                            <div className="relative flex flex-col bg-[#302f2d] rounded-2xl overflow-hidden border border-white/5 shadow-sm">
                                <div className="w-full text-white/60 text-[15px] bg-transparent outline-none px-4 py-4 min-h-[80px]">
                                    Reply...
                                </div>
                                <div className="flex justify-between items-center px-3 pb-3">
                                    <div className="w-8 h-8 rounded-lg hover:bg-white/5 flex items-center justify-center cursor-pointer text-white/70">
                                        <Plus className="w-5 h-5" />
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer text-[13px] font-medium text-white/70">
                                            Sonnet 4.6 <ChevronDown className="w-3 h-3" />
                                        </div>
                                        <SoundWavesIcon className="w-5 h-5 text-white/50 cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                            <div className="text-center mt-3 text-[11px] text-white/40 font-serif">
                                Claude is AI and can make mistakes. Please double-check responses.
                            </div>
                        </div>

                    </div>
                </div>
                </div>
                
                {/* Regular content appended below the "app" */}
                {trustBrief}
                <div className="mt-20">
                    <section className="px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="orange" heading="Questions fréquentes" /></section>
                    <section className="border-t border-white/5 px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="orange" heading="Univers connecté" /></section>

                </div>
            </main>
        </div>
    );
}

