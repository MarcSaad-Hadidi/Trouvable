import Image from 'next/image';
import Link from 'next/link';

import '@/features/auth/sign-in-shell.css';

export default function SignInShell({
    children,
    description = null,
    footer,
    ariaLabel = 'Trouvable, retour au site public',
}) {
    return (
        <div className="admin-sign-in-page relative flex min-h-dvh flex-col overflow-x-hidden bg-[#050505]">
            <div className="pointer-events-none absolute inset-0" aria-hidden>
                <div className="absolute left-[-10%] top-[-20%] h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(91,115,255,0.08),transparent_70%)]" />
                <div className="absolute bottom-[-20%] right-[-10%] h-[500px] w-[500px] bg-[radial-gradient(circle,rgba(147,51,234,0.06),transparent_70%)]" />
            </div>

            <main className="relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center px-4 py-8">
                <div className="w-full min-w-0 max-w-[420px] rounded-2xl border border-white/[0.1] bg-[#0a0a0a] px-6 pb-6 pt-7 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:px-7">
                    <div className="mb-6 flex flex-col items-center text-center">
                        <Link
                            href="/"
                            className="inline-flex items-center justify-center gap-3 rounded-xl outline-none transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[#5b73ff]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0a]"
                            aria-label={ariaLabel}
                        >
                            <Image
                                src="/logos/trouvable_logo_blanc1.png"
                                alt=""
                                width={40}
                                height={40}
                                sizes="40px"
                                className="h-10 w-10 shrink-0 object-contain"
                            />
                            <span className="text-[1.35rem] font-bold leading-none tracking-[-0.03em] text-white">
                                Trouvable
                            </span>
                        </Link>

                        {description ? <p className="mt-4 text-sm text-zinc-400">{description}</p> : null}
                    </div>

                    <div className="w-full min-w-0">{children}</div>
                </div>
            </main>

            <footer className="relative z-10 shrink-0 px-4 pb-8 pt-2 text-center text-[12px] leading-relaxed text-zinc-400 md:text-[13px]">
                {footer}
            </footer>
        </div>
    );
}
