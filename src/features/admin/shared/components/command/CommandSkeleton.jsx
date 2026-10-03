import { COMMAND_SURFACE, COMMAND_SURFACE_SOFT, cn } from './tokens';

function Block({ className }) {
    return <div className={cn('animate-pulse rounded-2xl bg-white/[0.08]', className)} />;
}

export default function CommandSkeleton() {
    return (
        <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-5 px-4 py-5 sm:px-6 lg:gap-6 lg:px-8 lg:py-8">
            <div className="space-y-3">
                <Block className="h-3 w-32" />
                <Block className="h-10 w-[min(32rem,90%)]" />
                <Block className="h-4 w-[min(42rem,95%)]" />
            </div>

            <section className={cn(COMMAND_SURFACE, 'p-5 sm:p-6 lg:p-8')}>
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
                    <div className="space-y-5">
                        <Block className="h-3 w-40" />
                        <Block className="h-10 w-72" />
                        <Block className="h-5 w-80" />
                        <Block className="h-28 w-full" />
                    </div>
                    <div className="grid gap-4">
                        <Block className="h-[270px] w-full" />
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Block className="h-[112px] w-full" />
                            <Block className="h-[112px] w-full" />
                            <Block className="h-[112px] w-full" />
                            <Block className="h-[112px] w-full" />
                        </div>
                    </div>
                </div>
            </section>

            <section className={cn(COMMAND_SURFACE_SOFT, 'p-5 sm:p-6')}>
                <Block className="h-6 w-48" />
                <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <Block key={index} className="h-[168px] w-full" />
                    ))}
                </div>
            </section>
        </div>
    );
}
