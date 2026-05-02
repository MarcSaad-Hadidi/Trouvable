'use client';
import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, Terminal, Search, Mic, Paperclip, CheckCircle2, AlertTriangle, PackageOpen, Image as ImageIcon, PenSquare, Clock, MessageSquare, MoreHorizontal } from 'lucide-react';
import { FaqSection, LinksSection, AiThinking, TypewriterText } from './shared-primitives';

function buildChats(page) {
    return [
        { id: 'main', label: 'Visibilité Copilot', question: 'Comment être visible dans Copilot ?', aiText: page.definition, aiSummary: page.summary, showSections: true },
        { id: 'entities', label: 'Optimisation des entités', question: 'Comment optimiser mes entités pour le Microsoft Graph ?', aiText: 'Copilot s\'appuie massivement sur le Microsoft Graph et l\'écosystème Bing. Pour être reconnu comme une entité fiable, il faut structurer vos données (JSON-LD) avec précision et aligner vos informations sur des sources B2B reconnues comme LinkedIn.', aiSummary: 'La stratégie : créer des pages "Profil d\'entreprise" robustes, utiliser le schéma LocalBusiness ou Organization complet, et s\'assurer que le nom de l\'entreprise est systématiquement associé à son cur d\'expertise dans les titres H1.', showSections: false },
        { id: 'audit', label: 'Audit de présence IA', question: 'Comment vérifier ma présence dans l\'écosystème Bing IA ?', aiText: 'Un audit de présence pour Copilot nécessite d\'analyser les Bing Webmaster Tools avec une optique IA. Il faut vérifier le taux d\'indexation, la présence de blocs "Chat" dans les SERP sur vos requêtes clés, et la manière dont Copilot résume vos pages.', aiSummary: 'Nous regardons 3 indicateurs : la fréquence d\'apparition dans les citations Copilot, la fidélité de l\'extraction d\'informations (Copilot comprend-il vos prix et services ?), et les requêtes conversationnelles qui déclenchent votre marque.', showSections: true },
        { id: 'content', label: 'Stratégie de contenu B2B', question: 'Quel type de contenu B2B est privilégié par Copilot ?', aiText: 'Copilot est souvent utilisé dans un contexte professionnel (Office 365, Edge Entreprise). Il favorise les contenus d\'autorité : rapports d\'industrie, comparaisons de logiciels, méthodologies chiffrées et définitions techniques claires.', aiSummary: 'Pour plaire à Copilot, abandonnez le contenu "inspirant" au profit du contenu "décisionnel". Créez des pages de type "Comment choisir un fournisseur de X" avec des critères objectifs. Copilot adore synthétiser ces listes.', showSections: false },
    ];
}

export default function CopilotPage({ page, trustBrief }) {
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
                newMsgs[newMsgs.length - 1] = { role: 'ai', isThinking: false, text: chat.aiText, summary: chat.aiSummary, sections: chat.showSections };
                return newMsgs;
            });
        }, 2200);

        return () => { clearTimeout(timer1); clearTimeout(timer2); clearTimeout(timer3); };
    }, [chats]);
    
    useEffect(() => {
        const timer1 = setTimeout(() => { setMessages([{ role: 'user', text: activeConversation.question }]); }, 500);
        const timer2 = setTimeout(() => { setMessages(prev => [...prev, { role: 'ai', isThinking: true }]); }, 1200);
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
        <div className="min-h-screen bg-[#060709]">
            <main className="pt-[100px] pb-24 px-6 sm:px-10">
                {/* Native App Window - Copilot Light Mode Web UI */}
                <div className="mx-auto max-w-[1280px] h-[800px] rounded-2xl border border-white/10 bg-[#FFFFFF] shadow-2xl flex overflow-hidden relative font-sans text-[#242424]">
                    
                    {/* Sidebar */}
                    <div className="w-[260px] bg-[#F7F7F8] border-r border-[#E5E5E5] flex-col hidden md:flex shrink-0">
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <img src="/logos/copilot.png" alt="Copilot" className="w-6 h-6 object-contain" />
                                <span className="text-[17px] font-semibold text-[#111111]">Copilot</span>
                            </div>
                            <div className="w-8 h-8 rounded hover:bg-[#EAEAEA] flex items-center justify-center cursor-pointer text-[#424242] transition-colors">
                                <PenSquare className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="px-3 mt-2">
                            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#EAEAEA] cursor-pointer text-[#424242] text-[14px]">
                                <Search className="w-4 h-4" /> Rechercher dans les chats
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto px-3 mt-6 space-y-6 clean-scroll-light text-[13px] text-[#424242]">
                            <div>
                                <div className="flex items-center gap-2 text-[12px] font-semibold text-[#616161] px-2 mb-2">
                                    <Clock className="w-3.5 h-3.5" /> Récents
                                </div>
                                <div className="space-y-0.5">
                                    {chats.map(c => (
                                        <div 
                                            key={c.id}
                                            onClick={() => loadConversation(c.id)}
                                            className={`flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer group ${activeChat === c.id ? 'bg-[#EAEAEA] text-[#111111]' : 'hover:bg-[#EAEAEA] text-[#111111]'} transition-colors`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <MessageSquare className={`w-4 h-4 shrink-0 ${activeChat === c.id ? 'text-[#111111]' : 'text-[#616161]'}`} />
                                                <span className="truncate">{c.label}</span>
                                            </div>
                                            {activeChat === c.id && <MoreHorizontal className="w-4 h-4 text-[#616161]" />}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="p-4 mt-auto border-t border-[#E5E5E5]">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
                                    <img src="/logos/trouvable_logo_noir.png" alt="Trouvable" className="w-full h-full object-cover" />
                                </div>
                                <div className="text-[14px] font-medium text-[#111111]">Trouvable</div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col relative bg-[#FFFFFF]">
                        
                        {/* Chat Area / Empty State */}
                        <div className="flex-1 overflow-y-auto relative flex flex-col clean-scroll-light">
                            {messages.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-8">
                                    <img src="/logos/copilot.png" alt="Copilot" className="w-16 h-16 mb-6 drop-shadow-md object-contain" />
                                    <h1 className="text-[28px] font-semibold text-[#111111] mb-8 tracking-tight">
                                        Hi there, Trouvable. What should we dive into today?
                                    </h1>
                                    
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 max-w-[800px] w-full">
                                        <div className="bg-[#F7F7F8] border border-[#E5E5E5] hover:border-[#D1D1D1] hover:bg-[#F0F0F0] rounded-xl p-4 cursor-pointer transition-all">
                                            <div className="font-medium text-[14px] text-[#111111] mb-1">Auditer ma visibilité IA</div>
                                            <div className="text-[13px] text-[#616161]">0valuer ma présence sur Copilot</div>
                                        </div>
                                        <div className="bg-[#F7F7F8] border border-[#E5E5E5] hover:border-[#D1D1D1] hover:bg-[#F0F0F0] rounded-xl p-4 cursor-pointer transition-all">
                                            <div className="font-medium text-[14px] text-[#111111] mb-1">Rédiger un article</div>
                                            <div className="text-[13px] text-[#616161]">Créer du contenu optimisé SEO</div>
                                        </div>
                                        <div className="bg-[#F7F7F8] border border-[#E5E5E5] hover:border-[#D1D1D1] hover:bg-[#F0F0F0] rounded-xl p-4 cursor-pointer transition-all">
                                            <div className="font-medium text-[14px] text-[#111111] mb-1">Générer des idées</div>
                                            <div className="text-[13px] text-[#616161]">Sujets B2B pour le mois prochain</div>
                                        </div>
                                        <div className="bg-[#F7F7F8] border border-[#E5E5E5] hover:border-[#D1D1D1] hover:bg-[#F0F0F0] rounded-xl p-4 cursor-pointer transition-all">
                                            <div className="font-medium text-[14px] text-[#111111] mb-1">Analyser mes concurrents</div>
                                            <div className="text-[13px] text-[#616161]">Voir qui domine les SERP</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 px-4 pt-8 pb-32 sm:px-12 lg:px-32 space-y-8">
                                    {messages.map((msg, idx) => (
                                        <motion.div 
                                            key={idx} 
                                            initial={{ opacity: 0, y: 10 }} 
                                            animate={{ opacity: 1, y: 0 }} 
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            {msg.role === 'user' ? (
                                                <div className="bg-[#F0F0F0] text-[#111111] px-5 py-3.5 rounded-[20px] text-[15px] max-w-[80%] leading-relaxed font-medium">
                                                    {msg.text}
                                                </div>
                                            ) : (
                                                <div className="flex gap-4 max-w-full lg:max-w-[85%]">
                                                    <div className="w-8 h-8 rounded-full bg-white border border-[#E5E5E5] shadow-sm flex items-center justify-center shrink-0 mt-1 overflow-hidden p-1.5">
                                                        <img src="/logos/copilot.png" alt="Copilot" className="w-full h-full object-contain" />
                                                    </div>
                                                    <div className="text-[#242424] text-[15px] leading-[1.7] space-y-6 pt-1.5 flex-1">
                                                        {msg.isThinking ? (
                                                            <div className="flex items-center gap-2 text-[#616161] font-medium text-[14px]">
                                                                <AiThinking /> Recherche Bing...
                                                            </div>
                                                        ) : (
                                                            <>
                                                                <p className="font-medium text-[#111111]"><TypewriterText text={msg.text} speed={8} /></p>
                                                                <p className="text-[#424242]"><TypewriterText text={msg.summary} delay={(msg.text?.length || 0) * 8 + 200} speed={8} /></p>
                                                                
                                                                {msg.sections && (
                                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.4 }} className="grid gap-4 sm:grid-cols-2 mt-6">
                                                                        <div className="rounded-xl border border-[#E5E5E5] bg-[#F7F7F8] p-5">
                                                                            <div className="flex items-center gap-2 text-[#D32F2F] mb-3 font-semibold text-sm">
                                                                                <AlertTriangle className="w-4 h-4" /> Problèmes détectés
                                                                            </div>
                                                                            <ul className="space-y-2 text-[13px] text-[#616161]">
                                                                                {page.problems.map((p, i) => (
                                                                                    <motion.li 
                                                                                        key={i} 
                                                                                        initial={{ opacity: 0, x: -5 }} 
                                                                                        animate={{ opacity: 1, x: 0 }} 
                                                                                        transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.6 + i * 0.1 }}
                                                                                        className="flex gap-2"
                                                                                    >
                                                                                        <span className="text-[#D32F2F]/50">⬢</span> {p}
                                                                                    </motion.li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                        <div className="rounded-xl border border-[#E5E5E5] bg-[#F7F7F8] p-5">
                                                                            <div className="flex items-center gap-2 text-[#0078D4] mb-3 font-semibold text-sm">
                                                                                <CheckCircle2 className="w-4 h-4" /> Solutions d'optimisation
                                                                            </div>
                                                                            <ul className="space-y-2 text-[13px] text-[#616161]">
                                                                                {page.corrections.map((p, i) => (
                                                                                    <motion.li 
                                                                                        key={i} 
                                                                                        initial={{ opacity: 0, x: -5 }} 
                                                                                        animate={{ opacity: 1, x: 0 }} 
                                                                                        transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 0.8 + i * 0.1 }}
                                                                                        className="flex gap-2"
                                                                                    >
                                                                                        <span className="text-[#0078D4]/50">⬢</span> {p}
                                                                                    </motion.li>
                                                                                ))}
                                                                            </ul>
                                                                        </div>
                                                                        <div className="rounded-xl border border-[#E5E5E5] bg-[#F7F7F8] p-5 sm:col-span-2">
                                                                            <div className="flex items-center gap-2 text-[#00A1F1] mb-3 font-semibold text-sm">
                                                                                <PackageOpen className="w-4 h-4" /> Livrables Trouvable
                                                                            </div>
                                                                            <ul className="grid sm:grid-cols-2 gap-2 text-[13px] text-[#616161]">
                                                                                {page.deliverables.map((p, i) => (
                                                                                    <motion.li 
                                                                                        key={i} 
                                                                                        initial={{ opacity: 0, x: -5 }} 
                                                                                        animate={{ opacity: 1, x: 0 }} 
                                                                                        transition={{ delay: ((msg.text?.length || 0) + (msg.summary?.length || 0)) * 0.008 + 1.0 + i * 0.1 }}
                                                                                        className="flex gap-2"
                                                                                    >
                                                                                        <span className="text-[#00A1F1]/50">⬢</span> {p}
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
                                </div>
                            )}
                        </div>

                        {/* Input Bar */}
                        <div className="px-4 pb-6 pt-2 sm:px-12 lg:px-32 bg-gradient-to-t from-[#FFFFFF] via-[#FFFFFF] to-transparent shrink-0 z-10 w-full absolute bottom-0 left-0 right-0">
                            <div className="max-w-[800px] mx-auto">
                                <div className="relative flex items-center bg-white rounded-full border border-[#D1D1D1] shadow-[0_2px_10px_rgba(0,0,0,0.05)] focus-within:shadow-[0_4px_15px_rgba(0,0,0,0.1)] focus-within:border-[#A1A1A1] transition-all px-4 py-3">
                                    <div className="p-2 hover:bg-[#F0F0F0] rounded-full cursor-pointer text-[#424242] shrink-0">
                                        <Paperclip className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 text-[#424242] text-[15px] bg-transparent outline-none px-3 truncate">
                                        Ask me anything...
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <div className="p-2 hover:bg-[#F0F0F0] rounded-full cursor-pointer text-[#424242]">
                                            <Mic className="w-5 h-5" />
                                        </div>
                                        <div className="w-9 h-9 bg-[#EAEAEA] text-[#A1A1A1] rounded-full flex items-center justify-center pointer-events-none">
                                            <ArrowUp className="w-5 h-5" />
                                        </div>
                                    </div>
                                </div>
                                <div className="text-center mt-3 text-[11px] text-[#616161]">
                                    Copilot can make mistakes. Check important info.
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
                
                {/* Regular content appended below the "app" */}
                {trustBrief}
                <div className="mt-20">
                    <section className="px-6 py-20 sm:px-10"><FaqSection faqs={page.faqs} accent="blue" heading="Questions fréquentes" /></section>
                    <section className="border-t border-white/5 px-6 py-20 sm:px-10"><LinksSection links={page.internalLinks} accent="blue" heading="Documentation connexe" /></section>

                </div>
            </main>
        </div>
    );
}

