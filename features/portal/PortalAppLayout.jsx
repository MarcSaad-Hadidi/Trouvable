import Link from 'next/link';
import Image from 'next/image';
import { SignOutButton } from '@clerk/nextjs';
import { currentUser } from '@clerk/nextjs/server';

export const metadata = {
    robots: { index: false, follow: false },
};

function getPrimaryEmail(user) {
    const primary = user?.emailAddresses?.find(
        (emailAddress) => emailAddress.id === user?.primaryEmailAddressId
    )?.emailAddress;

    return primary || user?.emailAddresses?.[0]?.emailAddress || '';
}

export default async function PortalAppLayout({ children }) {
    const user = await currentUser();
    const userEmail = getPrimaryEmail(user);

    return (
        <div className="relative min-h-screen bg-[#06070a] text-white">
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 opacity-90"
                style={{
                    background:
                        'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(91,115,255,0.08), transparent 60%), ' +
                        'radial-gradient(ellipse 60% 40% at 50% 110%, rgba(167,139,250,0.05), transparent 60%)',
                }}
            />

            <div className="relative mx-auto flex min-h-screen max-w-[1180px] flex-col px-5 sm:px-8 lg:px-12">
                <header className="flex items-center justify-between border-b border-white/[0.07] py-6">
                    <Link href="/portal" className="flex items-center gap-3">
                        <Image
                            src="/logos/trouvable_logo_blanc1.png"
                            alt=""
                            width={36}
                            height={36}
                            sizes="36px"
                            className="h-9 w-9 rounded-md border border-white/[0.08] bg-white/[0.03] p-1"
                        />
                        <div className="flex flex-col leading-none">
                            <span className="font-display text-[15px] font-semibold tracking-[-0.02em]">
                                Trouvable
                            </span>
                            <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.20em] text-white/35">
                                Espace de restitution
                            </span>
                        </div>
                    </Link>

                    <div className="flex items-center gap-3">
                        {userEmail ? (
                            <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-white/35 sm:inline">
                                {userEmail}
                            </span>
                        ) : null}
                        <SignOutButton redirectUrl="/espace">
                            <button
                                type="button"
                                className="inline-flex items-center rounded-full border border-white/[0.10] bg-white/[0.025] px-4 py-1.5 text-[12px] font-semibold text-white/55 transition hover:border-white/[0.18] hover:bg-white/[0.06] hover:text-white"
                            >
                                Se déconnecter
                            </button>
                        </SignOutButton>
                    </div>
                </header>

                <main className="flex-1 py-10 lg:py-14">{children}</main>

                <footer className="border-t border-white/[0.05] py-6 font-mono text-[10px] uppercase tracking-[0.20em] text-white/25">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <span>© Trouvable · Restitution confidentielle</span>
                        <span>Lecture seule · Aucune action exécutée depuis cet espace</span>
                    </div>
                </footer>
            </div>
        </div>
    );
}
