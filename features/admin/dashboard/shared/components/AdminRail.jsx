'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import { 
    LayoutDashboard, 
    FolderClosed, 
    Search, 
    Globe2, 
    Bot, 
    Settings
} from 'lucide-react';
import { cn } from '@/features/admin/dashboard/shared/components/command';

const RAIL_ITEMS = [
    { id: 'portfolio', label: 'Portefeuille', icon: LayoutDashboard, root: '/admin' },
    { id: 'dossier', label: 'Dossier', icon: FolderClosed, world: 'dossier' },
    { id: 'seo', label: 'SEO Ops', icon: Search, world: 'seo' },
    { id: 'geo', label: 'GEO Ops', icon: Globe2, world: 'geo' },
    { id: 'agent', label: 'Agent Ops', icon: Bot, world: 'agent' },
];

export default function AdminRail({ devBypass }) {
    const pathname = usePathname();

    const clientId = useMemo(() => {
        const match = pathname?.match(/\/admin\/clients\/([^/]+)/);
        const id = match ? match[1] : null;
        if (id === 'new' || id === 'create' || id === 'onboarding') return null;
        return id;
    }, [pathname]);

    const activeContext = useMemo(() => {
        if (!pathname) return 'portfolio';
        if (pathname === '/admin' || pathname.startsWith('/admin/clients') && !clientId) return 'portfolio';
        if (pathname.includes('/seo/')) return 'seo';
        if (pathname.includes('/geo/') || pathname.endsWith('/geo')) return 'geo';
        if (pathname.includes('/agent/')) return 'agent';
        return 'dossier'; // Default if client selected but no specific world
    }, [pathname, clientId]);

    return (
        <nav className="fixed left-0 top-0 bottom-0 z-40 flex w-[var(--rail-w)] flex-col items-center border-r border-white/[0.05] bg-[#080808] py-4">
            {/* Logo */}
            <Link
                href="/admin"
                className="group flex h-10 w-10 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#7c6aef]/20 to-[#6366f1]/10 border border-[#7c6aef]/15 transition-all hover:bg-[#7c6aef]/20 hover:border-[#7c6aef]/30"
                aria-label="Trouvable"
            >
                <Image src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" width={16} height={16} className="h-4 w-4 object-contain opacity-90 group-hover:opacity-100" />
            </Link>

            {/* Primary Nav */}
            <div className="mt-8 flex flex-col gap-2 w-full px-2">
                {RAIL_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeContext === item.id;
                    const isClientContext = !!item.world;
                    const isDisabled = isClientContext && !clientId;
                    
                    const href = isClientContext 
                        ? (clientId ? `/admin/clients/${clientId}/${item.world === 'dossier' ? 'dossier' : item.world}` : '#')
                        : item.root;

                    return (
                        <Link
                            key={item.id}
                            href={href}
                            className={cn(
                                "group relative flex h-10 w-full items-center justify-center rounded-[8px] transition-all",
                                isDisabled ? "opacity-30 cursor-not-allowed pointer-events-none" : "hover:bg-white/[0.04]",
                                isActive && "bg-white/[0.04]"
                            )}
                            aria-label={item.label}
                            aria-disabled={isDisabled}
                        >
                            {/* Accent Background (Active) */}
                            {isActive && (
                                <div className={cn(
                                    "absolute inset-0 rounded-[8px] opacity-10",
                                    item.id === 'seo' ? "bg-[#6b9cc5]" :
                                    item.id === 'geo' ? "bg-[#7c6aef]" :
                                    item.id === 'agent' ? "bg-[#d4874a]" : "bg-white"
                                )} />
                            )}
                            
                            {/* Active Indicator Line */}
                            {isActive && (
                                <div className={cn(
                                    "absolute left-[-8px] top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full",
                                    item.id === 'seo' ? "bg-[#6b9cc5]" :
                                    item.id === 'geo' ? "bg-[#7c6aef]" :
                                    item.id === 'agent' ? "bg-[#d4874a]" : "bg-white"
                                )} />
                            )}

                            <Icon className={cn(
                                "relative z-10 h-[18px] w-[18px] transition-colors",
                                isActive 
                                    ? (
                                        item.id === 'seo' ? "text-[#6b9cc5]" :
                                        item.id === 'geo' ? "text-[#7c6aef]" :
                                        item.id === 'agent' ? "text-[#d4874a]" : "text-white"
                                      )
                                    : "text-white/40 group-hover:text-white/80"
                            )} strokeWidth={1.5} />

                            {/* Tooltip */}
                            <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 rounded-md border border-white/[0.08] bg-[#131319] px-2.5 py-1.5 text-[11px] font-semibold text-white/90 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 z-50 whitespace-nowrap">
                                {item.label}
                            </div>
                        </Link>
                    );
                })}
            </div>

            {/* Bottom Actions */}
            <div className="mt-auto flex flex-col gap-2 w-full px-2">
                <button
                    className="group relative flex h-10 w-full items-center justify-center rounded-[8px] transition-all hover:bg-white/[0.04] text-white/40 hover:text-white/80"
                    aria-label="Paramètres"
                >
                    <Settings className="h-[18px] w-[18px]" strokeWidth={1.5} />
                    <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 rounded-md border border-white/[0.08] bg-[#131319] px-2.5 py-1.5 text-[11px] font-semibold text-white/90 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 z-50 whitespace-nowrap">
                        Paramètres
                    </div>
                </button>
                
                <button
                    className="group relative flex h-10 w-full items-center justify-center rounded-[8px] transition-all hover:bg-white/[0.04] text-white/40 hover:text-white/80"
                    aria-label="Profil"
                >
                    <div className="h-[22px] w-[22px] rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold text-white/70">
                        {devBypass ? 'OP' : 'A'}
                    </div>
                    <div className="pointer-events-none absolute left-14 top-1/2 -translate-y-1/2 rounded-md border border-white/[0.08] bg-[#131319] px-2.5 py-1.5 text-[11px] font-semibold text-white/90 opacity-0 shadow-xl transition-opacity group-hover:opacity-100 z-50 whitespace-nowrap">
                        Mon Profil
                    </div>
                </button>
            </div>
        </nav>
    );
}
