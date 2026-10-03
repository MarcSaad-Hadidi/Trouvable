'use client';

import { SignOutButton, UserButton } from '@clerk/nextjs';

export default function AdminSidebarAuthPanel() {
    return (
        <>
            <div className="flex items-center gap-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] px-3 py-2 mt-1">
                <UserButton
                    afterSignOutUrl="/espace"
                    appearance={{ elements: { avatarBox: 'w-[22px] h-[22px]' } }}
                />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-semibold text-white/35 tracking-[0.04em] uppercase">Opérateur</div>
                </div>
            </div>

            <SignOutButton redirectUrl="/espace">
                <button
                    type="button"
                    className="w-full rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2 text-center text-[11px] font-semibold text-white/35 transition hover:bg-white/[0.06] hover:text-white/60 hover:border-white/[0.10]"
                >
                    Déconnexion
                </button>
            </SignOutButton>
        </>
    );
}
