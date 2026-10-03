import Link from 'next/link';
import Image from 'next/image';

export default function CommandBrandLockup({
    href = '/admin',
    title = 'Trouvable',
    subtitle = 'Commande',
}) {
    return (
        <Link
            href={href}
            className="inline-flex max-w-max items-center gap-2.5 rounded-lg px-1 py-0.5 transition-colors hover:bg-white/[0.03]"
        >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#5b73ff]/15 bg-gradient-to-br from-[#5b73ff]/20 to-[#8b5cf6]/10">
                <Image
                    src="/logos/trouvable_logo_blanc1.png"
                    alt="Trouvable"
                    width={16}
                    height={16}
                    sizes="16px"
                    className="h-4 w-4 object-contain"
                />
            </div>
            <div className="min-w-0">
                <div className="text-[13px] font-bold leading-none tracking-[-0.03em] text-white">{title}</div>
                <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#7b8fff]/60">
                    {subtitle}
                </div>
            </div>
        </Link>
    );
}
