'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { Search, ArrowRight, FileText, MapPin, Briefcase, Zap, Command } from 'lucide-react';

function normalizeQuery(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

function scoreEntry(entry, normalizedQuery) {
    if (!normalizedQuery) return 0;
    const haystack = normalizeQuery(`${entry.title} ${entry.description} ${entry.keywords || ''} ${entry.href}`);
    if (!haystack.includes(normalizedQuery)) return 0;
    if (normalizeQuery(entry.title).includes(normalizedQuery)) return 3;
    if (normalizeQuery(entry.href).includes(normalizedQuery)) return 2;
    return 1;
}

export default function SearchClient({ index, initialQuery = '' }) {
    const [query, setQuery] = useState(initialQuery);

    const normalizedQuery = normalizeQuery(query);

    const matches = useMemo(() => {
        if (!normalizedQuery) return [];
        return index
            .map((entry) => ({ entry, score: scoreEntry(entry, normalizedQuery) }))
            .filter((entry) => entry.score > 0)
            .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title));
    }, [index, normalizedQuery]);

    // Bento grid recommendations for empty state (use static pages)
    const recommendations = index.filter(item => item.isStatic).slice(0, 6);

    const getIcon = (href) => {
        if (href.startsWith('/villes')) return <MapPin className="h-5 w-5 text-emerald-400" />;
        if (href.startsWith('/expertises')) return <Briefcase className="h-5 w-5 text-amber-400" />;
        if (href.startsWith('/services') || href.startsWith('/offres')) return <Zap className="h-5 w-5 text-indigo-400" />;
        return <FileText className="h-5 w-5 text-blue-400" />;
    };

    return (
        <div className="mx-auto w-full max-w-[1000px] pt-10">
            {/* Logo Link to Home */}
            <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mb-8 flex justify-center"
            >
                <Link href="/" className="group flex items-center gap-4 text-2xl sm:text-[28px] font-bold tracking-[-0.03em] text-white transition hover:opacity-80">
                    <Image
                        src="/logos/trouvable_logo_blanc1.png"
                        alt="Logo Trouvable"
                        width={32}
                        height={32}
                        sizes="32px"
                        className="h-[28px] w-[28px] sm:h-[32px] sm:w-[32px] object-contain group-hover:opacity-80 transition-opacity"
                        priority
                    />
                    Trouvable
                </Link>
            </motion.div>

            {/* Header Section with Kinetic Typography */}
            <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="mb-12 text-center"
            >
                <div className="inline-flex items-center gap-2 rounded-full border border-white/5 bg-white/5 px-4 py-1.5 text-xs font-medium text-white/70 backdrop-blur-md mb-6">
                    <Command className="h-3.5 w-3.5" />
                    <span>Recherche Intelligente</span>
                </div>
                <h1 className="text-[clamp(32px,5vw,64px)] font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-white via-white/90 to-white/30 pb-2">
                    Que cherchez-vous ?
                </h1>
                <p className="mt-4 text-lg text-white/50 max-w-2xl mx-auto">
                    Explorez notre documentation, nos services, nos expertises sectorielles et nos villes couvertes par l'intelligence Trouvable.
                </p>
            </motion.div>

            {/* Premium Search Input */}
            <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="relative z-20 group"
            >
                <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-blue-500/20 via-indigo-500/20 to-purple-500/20 opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100" />
                <div className="relative flex items-center overflow-hidden rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl transition-colors focus-within:border-white/30 focus-within:bg-black/60 shadow-[0_0_40px_-15px_rgba(255,255,255,0.05)]">
                    <label htmlFor="site-search" className="sr-only">
                        Rechercher dans les pages publiques Trouvable
                    </label>
                    <div className="pl-6 pr-2">
                        <Search className="h-6 w-6 text-white/40 transition-colors group-focus-within:text-white" />
                    </div>
                    <input
                        id="site-search"
                        name="q"
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Ex. : méthode, Montréal, avocat, services..."
                        aria-label="Rechercher dans les pages publiques Trouvable"
                        toolname="search_site"
                        tooldescription="Rechercher une page publique Trouvable à partir d'une requête."
                        toolparamdescription="Requête de recherche publique à envoyer à Trouvable."
                        className="w-full bg-transparent py-6 px-4 text-lg text-white placeholder:text-white/30 focus:outline-none"
                        autoFocus
                    />
                    {query && (
                        <button 
                            onClick={() => setQuery('')}
                            className="mr-6 text-xs font-medium text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-md bg-white/5 hover:bg-white/10"
                            aria-label="Effacer la recherche"
                            toolname="clear_site_search"
                            tooldescription="Vider la requête de recherche publique."
                        >
                            EFFACER
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Results Area */}
            <div className="mt-12 min-h-[400px]">
                <AnimatePresence mode="wait">
                    {normalizedQuery && matches.length > 0 ? (
                        <motion.div
                            key="results"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4"
                        >
                            <div className="flex items-center justify-between px-2 mb-6">
                                <h2 className="text-sm font-semibold text-white/50 uppercase tracking-widest">
                                    {matches.length} résultat{matches.length > 1 ? 's' : ''} trouvé{matches.length > 1 ? 's' : ''}
                                </h2>
                            </div>
                            <div className="grid gap-3">
                                {matches.map(({ entry }, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        key={entry.href}
                                    >
                                        <Link 
                                            href={entry.href}
                                            className="group relative flex items-center gap-4 sm:gap-6 rounded-xl border border-white/5 bg-white/[0.02] p-4 sm:p-5 transition-all hover:bg-white/[0.05] hover:border-white/10 hover:shadow-[0_0_30px_-10px_rgba(255,255,255,0.05)] overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out" />
                                            
                                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10 group-hover:bg-white/10 group-hover:ring-white/20 transition-all">
                                                {getIcon(entry.href)}
                                            </div>
                                            
                                            <div className="flex-1 min-w-0">
                                                <h3 className="text-[17px] font-semibold text-white/90 group-hover:text-white transition-colors truncate">
                                                    {entry.title}
                                                </h3>
                                                <p className="mt-1 text-sm text-[#a0a0a0] line-clamp-1 sm:line-clamp-2">
                                                    {entry.description}
                                                </p>
                                                <p className="mt-2 text-[11px] text-white/30 hidden sm:block">
                                                    {entry.href}
                                                </p>
                                            </div>
                                            
                                            <div className="shrink-0 text-white/20 group-hover:text-white/60 group-hover:translate-x-1 transition-all">
                                                <ArrowRight className="h-5 w-5" />
                                            </div>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    ) : normalizedQuery && matches.length === 0 ? (
                        <motion.div
                            key="no-results"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center py-20 text-center"
                        >
                            <div className="h-20 w-20 rounded-full bg-white/5 flex items-center justify-center mb-6 ring-1 ring-white/10">
                                <Search className="h-8 w-8 text-white/20" />
                            </div>
                            <h3 className="text-xl font-medium text-white">Aucun résultat</h3>
                            <p className="mt-2 text-[#a0a0a0] max-w-md">
                                La recherche "{query}" n'a donné aucun résultat. Essayez d'élargir votre requête ou naviguez via les recommandations ci-dessous.
                            </p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="recommendations"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="mt-8"
                        >
                            <div className="flex items-center gap-3 mb-8 px-2">
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#7b8fff]/70">Explorer l'écosystème</span>
                                <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {recommendations.map((entry, i) => (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 + (i * 0.1) }}
                                        key={entry.href}
                                    >
                                        <Link
                                            href={entry.href}
                                            className="block h-full group relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.02] p-6 transition-all hover:bg-white/[0.04] hover:border-white/10"
                                        >
                                            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowRight className="h-4 w-4 text-white/40" />
                                            </div>
                                            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-[#7b8fff] ring-1 ring-white/10 group-hover:bg-[#7b8fff]/20 group-hover:text-[#7b8fff] transition-all">
                                                {getIcon(entry.href)}
                                            </div>
                                            <h3 className="text-[15px] font-semibold text-[#b8c5ff] group-hover:text-white transition-colors">
                                                {entry.title}
                                            </h3>
                                            <p className="mt-2 text-[13px] leading-[1.6] text-[#a0a0a0] line-clamp-3 group-hover:text-white/70 transition-colors">
                                                {entry.description}
                                            </p>
                                        </Link>
                                    </motion.div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
