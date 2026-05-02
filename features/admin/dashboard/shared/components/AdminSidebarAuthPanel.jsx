'use client';

import { SignOutButton, UserButton } from '@clerk/nextjs';

export default function AdminSidebarAuthPanel() {
    return (
        <>
            <div className="mt-1 flex items-center gap-2.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <UserButton
                    afterSignOutUrl="/espace"
                    appearance={{ elements: { avatarBox: 'w-[22px] h-[22px]' } }}
                />
                <div className="min-w-0 flex-1">
                    <div className="truncate text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">Operateur</div>
                </div>
            </div>

            <SignOutButton redirectUrl="/espace">
                <button
                    type="button"
                    className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-center text-[11px] font-semibold text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                >
                    Deconnexion
                </button>
            </SignOutButton>
        </>
    );
}
