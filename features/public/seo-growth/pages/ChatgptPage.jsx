'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, BotMessageSquare, CheckCircle2, AlertTriangle, PackageOpen, Plus, Search, Compass, MoreHorizontal, FileText, ChevronDown, PenSquare, LayoutGrid } from 'lucide-react';
import { FaqSection, LinksSection, AiThinking, TypewriterText } from './shared-primitives';

/*  Sidebar conversations data  */
function buildChats(page) {
    return [
        {
            id: 'main',
            label: 'Visibilité ChatGPT',
            question: 'Comment faire pour que ChatGPT recommande mon entreprise ?',
            aiText: page.definition,
            aiSummary: page.summary,
            showSections: true,
        },
        {
            id: 'maillage',
            label: 'Analyse de maillage interne',
            question: 'Peux-tu analyser le maillage interne de mon site pour améliorer la visibilité IA ?',
            aiText: 'Le maillage interne est un levier fondamental pour les moteurs IA. Quand ChatGPT ou Perplexity analyse votre site, il suit les liens internes pour comprendre la hiérarchie de vos pages, les relations entre vos services et la profondeur de votre expertise.',
            aiSummary: 'Un maillage bien construit relie vos pages de services aux pages de preuve, vos pages locales aux plateformes IA, et vos FAQ aux pages de conversion. Sans ces connexions, les moteurs traitent chaque page comme un fragment isolé au lieu d\'une source cohérente.',
            showSections: false,
        },
        {
            id: 'longue-traine',
            label: 'Stratégie de mots-clés longue traîne',
            question: 'Comment construire une stratégie de mots-clés longue traîne pour être cité par les IA ?',
            aiText: 'Les moteurs génératifs ne fonctionnent pas par mots-clés, mais par intentions. Une stratégie longue traîne efficace pour l\'IA consiste à identifier les questions précises que vos prospects posent, puis à y répondre avec des pages claires, factuelles et bien structurées.',
            aiSummary: 'Par exemple, "meilleure agence SEO locale pour PME à Montréal" est une intention longue traîne que ChatGPT peut traiter. Si votre page répond directement à cette question avec des preuves, des zones servies et des services nommés, vous devenez une source plausible.',
            showSections: false,
        },
        {
            id: 'snippets',
            label: 'Optimiser les Featured Snippets',
            question: 'Comment optimiser mes pages pour les Featured Snippets et les réponses IA ?',
            aiText: 'Les Featured Snippets et les réponses IA partagent un besoin commun : des passages courts, autonomes et directement utiles. Une page qui contient une définition nette en 2-3 phrases, suivie d\'une liste structurée, a plus de chances d\'être reprise par Google AI Overviews comme par ChatGPT.',
            aiSummary: 'La clé est d\'organiser vos pages avec des H2 qui correspondent aux questions réelles des prospects, des paragraphes de réponse immédiate, puis du contenu approfondi. Les données structurées FAQ et HowTo renforcent ce signal.',
            showSections: true,
        },
    ];
}

export default function ChatgptPage({ page, trustBrief }) {
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

        const timer1 = setTimeout(() => {
            setMessages([{ role: 'user', text: chat.question }]);
        }, 300);

        const timer2 = setTimeout(() => {
            setMessages(prev => [...prev, { role: 'ai', isThinking: true }]);
        }, 800);

        const timer3 = setTimeout(() => {
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'ai', isThinking: false, text: chat.aiText, summary: chat.aiSummary, sections: chat.showSections };
                return newMsgs;
            });
        }, 2200);

        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
    }, [chats]);

    useEffect(() => {
        const timer1 = setTimeout(() => {
            setMessages([{ role: 'user', text: activeConversation.question }]);
        }, 500);

        const timer2 = setTimeout(() => {
            setMessages(prev => [...prev, { role: 'ai', isThinking: true }]);
        }, 1200);

        const timer3 = setTimeout(() => {
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[newMsgs.length - 1] = { role: 'ai', isThinking: false, text: activeConversation.aiText, summary: activeConversation.aiSummary, sections: activeConversation.showSections };
                return newMsgs;
            });
        }, 2600);

        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="min-h-screen bg-[#060807]">
            <main className="pt-[100px] pb-24 px-6 sm:px-10">
                {/* Native App Window */}
                <div className="mx-auto max-w-[1280px] h-[800px] rounded-2xl border border-white/10 bg-[#212121] shadow-2xl flex overflow-hidden font-sans">
                    
                    {/* Sidebar */}
                    <div className="w-[260px] bg-[#171717] flex-col hidden md:flex shrink-0">
                        <div className="p-3">
                            <div className="flex items-center justify-between hover:bg-[#212121] p-2 rounded-lg cursor-pointer">
                                <div className="flex items-center gap-2 text-white text-[14px] font-medium">
                                    <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center p-1.5 overflow-hidden">
                                        <img src="/logos/chatgpt.png" alt="ChatGPT" className="w-full h-full object-contain" />
                                    </div>
                                    Nouvelle discussion
                                </div>
                                <PenSquare className="w-4 h-4 text-white/50" />
                            </div>
                        </div>

                        <div className="px-3 space-y-1 mt-2">
                            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#212121] cursor-pointer text-white/80 text-[14px]">
                                <Search className="w-4 h-4" /> Rechercher dans les chats
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#212121] cursor-pointer text-white/80 text-[14px]">
                                <Compass className="w-4 h-4" /> Explorer les GPTs
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 mt-6 space-y-6 clean-scroll">
                            <div>
                                <div className="text-[12px] font-semibold text-white/40 px-2 mb-2">Projets</div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#212121] cursor-pointer text-white/80 text-[13px]">
                                        <Plus className="w-4 h-4" /> New project
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#212121] cursor-pointer text-white/80 text-[13px] truncate">
                                        <LayoutGrid className="w-4 h-4 shrink-0" /> Audit SEO Montréal
                                    </div>
                                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#212121] cursor-pointer text-white/80 text-[13px] truncate">
                                        <LayoutGrid className="w-4 h-4 shrink-0" /> Optimisation Fiche Google
                                    </div>
                                </div>
                            </div>

                            <div>
                                <div className="text-[12px] font-semibold text-white/40 px-2 mb-2">Récents</div>
                                <div className="space-y-1">
                                    {chats.map((chat) => (
                                        <div
                                            key={chat.id}
                                            onClick={() => loadConversation(chat.id)}
                                            className={`p-2 rounded-lg cursor-pointer text-[13px] truncate transition-colors ${
                                                activeChat === chat.id
                                                    ? 'bg-[#212121] text-white font-medium'
                                                    : 'text-white/80 hover:bg-[#212121]'
                                            }`}
                                        >
                                            {chat.label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-3 mt-auto">
                            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#212121] cursor-pointer">
                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                    <img src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" className="w-full h-full object-cover" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white text-[14px] font-medium truncate">Trouvable</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col relative bg-[#212121]">
                        
                        {/* Header */}
                        <div className="flex h-14 items-center justify-between px-4 shrink-0 z-10 absolute top-0 left-0 right-0">
                            <div className="flex items-center gap-2 text-[15px] font-medium text-white/80 hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg cursor-pointer">
                                ChatGPT <ChevronDown className="w-4 h-4" />
                            </div>
                            <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-sm">
                                <img src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" className="w-full h-full object-cover" />
                            </div>
                        </div>

                        {/* Centered Input State vs Chat State */}
                        <div className="flex-1 overflow-hidden relative flex flex-col">
                            {messages.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center p-4">
                                    <div className="w-full max-w-[768px]">
                                        <div className="relative flex items-center bg-[#2f2f2f] rounded-[24px] px-4 py-3 border border-white/5 shadow-inner min-h-[56px]">
                                            <Plus className="w-5 h-5 text-white/40 mr-2" />
                                            <div className="w-full text-white/40 text-[16px] bg-transparent outline-none cursor-text px-2">
                                                Posez n'importe quelle question
                                            </div>
                                            <div className="absolute right-3 w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center pointer-events-none">
                                                <ArrowUp className="w-4 h-4" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 overflow-y-auto px-4 pt-20 pb-32 sm:px-8 space-y-8 clean-scroll">
                                        <AnimatePresence mode="wait">
                                            <motion.div
                                                key={animKey}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="space-y-8"
                                            >
                                                {messages.map((msg, idx) => (
                                                    <motion.div 
                                                        key={idx} 
                                                        initial={{ opacity: 0, y: 10 }} 
                                                        animate={{ opacity: 1, y: 0 }} 
                                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        {msg.role === 'user' ? (
                                                            <div className="bg-[#2f2f2f] text-[#ececec] px-5 py-3.5 rounded-[24px] text-[15px] max-w-[80%] leading-relaxed font-medium">
                                                                {msg.text}
                                                            </div>
                                                        ) : (
                                                            <div className="flex gap-4 max-w-full lg:max-w-[85%]">
                                                                <div className="w-8 h-8 rounded-full border border-white/10 bg-white flex items-center justify-center shrink-0 mt-1 overflow-hidden p-1.5">
                                                                    <img src="/logos/chatgpt.png" alt="ChatGPT" className="w-full h-full object-contain" />
                                                                </div>
                                                                <div className="text-[#ececec] text-[15px] leading-[1.7] space-y-6 pt-1.5 flex-1">
                                                                    {msg.isThinking ? (
                                                                        <AiThinking />
                                                                    ) : (
                                                                        <>
                                                                            <p className="font-medium text-white"><TypewriterText text={msg.text} speed={8} /></p>
                                                                            <p className="text-white/80"><TypewriterText text={msg.summary} delay={(msg.text?.length || 0) * 8 + 200} speed={8} /></p>
                                                                            
                                                                            {msg.sections && (
                                                                                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.4 }} className="grid gap-4 sm:grid-cols-2 mt-6">
                                                                                    <div className="rounded-xl border border-white/5 bg-[#2f2f2f]/50 p-5">
                                                                                        <div className="flex items-center gap-2 text-[#ff6b6b] mb-3 font-semibold text-sm">
                                                                                            <AlertTriangle className="w-4 h-4" /> Ce qui bloque
                                                                                        </div>
                                                                                        <ul className="space-y-2 text-[13px] text-white/70">
                                                                                            {page.problems.map((p, i) => (
                                                                                                <motion.li 
                                                                                                    key={i} 
                                                                                                    initial={{ opacity: 0, x: -5 }} 
                                                                                                    animate={{ opacity: 1, x: 0 }} 
                                                                                                    transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.6 + i * 0.1 }}
                                                                                                    className="flex gap-2"
                                                                                                >
                                                                                                    <span className="text-white/20">⬢</span> {p}
                                                                                                </motion.li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                    <div className="rounded-xl border border-white/5 bg-[#2f2f2f]/50 p-5">
                                                                                        <div className="flex items-center gap-2 text-[#10a37f] mb-3 font-semibold text-sm">
                                                                                            <CheckCircle2 className="w-4 h-4" /> Ce que nous corrigeons
                                                                                        </div>
                                                                                        <ul className="space-y-2 text-[13px] text-white/70">
                                                                                            {page.corrections.map((p, i) => (
                                                                                                <motion.li 
                                                                                                    key={i} 
                                                                                                    initial={{ opacity: 0, x: -5 }} 
                                                                                                    animate={{ opacity: 1, x: 0 }} 
                                                                                                    transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.8 + i * 0.1 }}
                                                                                                    className="flex gap-2"
                                                                                                >
                                                                                                    <span className="text-[#10a37f]/50">⬢</span> {p}
                                                                                                </motion.li>
                                                                                            ))}
                                                                                        </ul>
                                                                                    </div>
                                                                                    <div className="rounded-xl border border-white/5 bg-[#2f2f2f]/50 p-5 sm:col-span-2">
                                                                                        <div className="flex items-center gap-2 text-[#3b82f6] mb-3 font-semibold text-sm">
                                                                                            <PackageOpen className="w-4 h-4" /> Livrables
                                                                                        </div>
                                                                                        <ul className="grid sm:grid-cols-2 gap-2 text-[13px] text-white/70">
                                                                                            {page.deliverables.map((p, i) => (
                                                                                                <motion.li 
                                                                                                    key={i} 
                                                                                                    initial={{ opacity: 0, x: -5 }} 
                                                                                                    animate={{ opacity: 1, x: 0 }} 
                                                                                                    transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 1.0 + i * 0.1 }}
                                                                                                    className="flex gap-2"
                                                                                                >
                                                                                                    <span className="text-[#3b82f6]/50">⬢</span> {p}
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
                                    <div className="p-4 sm:p-6 shrink-0 bg-[#212121]">
                                        <div className="max-w-[768px] mx-auto relative flex items-center bg-[#2f2f2f] rounded-[24px] px-4 py-3 border border-white/5 shadow-inner">
                                            <Plus className="w-5 h-5 text-white/40 mr-2" />
                                            <div className="w-full text-white/40 text-[15px] bg-transparent outline-none cursor-text px-2">
                                                Posez n'importe quelle question
                                            </div>
                                            <div className="absolute right-3 w-8 h-8 bg-white/20 text-white rounded-full flex items-center justify-center pointer-events-none">
                                                <ArrowUp className="w-4 h-4" />
                                            </div>
                                        </div>
                                        <div className="text-center mt-3 text-[11px] text-white/30">
                                            ChatGPT can make mistakes. Check important info.
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                    </div>
                </div>
                
                {/* Regular content appended below the "app" */}
                {trustBrief}
                <div className="mt-20">
                    <section className="px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="teal" heading="Questions fréquentes" /></section>
                    <section className="border-t border-white/5 px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="teal" heading="Plateformes connexes" /></section>

                </div>
            </main>
        </div>
    );
}

