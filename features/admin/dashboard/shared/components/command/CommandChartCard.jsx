import { COMMAND_SURFACE_SOFT, COMMAND_TEXT, cn } from './tokens';

export function CommandChartCard({
    eyebrow = 'Tendance',
    title,
    subtitle = null,
    description = null,
    action = null,
    legend = null,
    empty = null,
    children,
    className = '',
    contentClassName = '',
}) {
    const resolvedDescription = description ?? subtitle;

    return (
        <section className={cn(COMMAND_SURFACE_SOFT, 'overflow-hidden p-5 sm:p-6', className)}>
            <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                        <div className={COMMAND_TEXT.eyebrow}>{eyebrow}</div>
                        <div className="mt-3 text-[22px] font-semibold tracking-[-0.03em] text-white">{title}</div>
                        {resolvedDescription ? (
                            <p className="mt-2 text-[13px] leading-relaxed text-white/[0.62]">{resolvedDescription}</p>
                        ) : null}
                    </div>
                    {action ? <div className="flex shrink-0 items-center lg:justify-end">{action}</div> : null}
                </div>

                {legend ? <div>{legend}</div> : null}
            </div>

            <div
                className={cn(
                    'mt-6 overflow-hidden rounded-[26px] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(16,20,28,0.76)_0%,rgba(10,13,20,0.94)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_18px_42px_rgba(0,0,0,0.2)]',
                    contentClassName,
                )}
            >
                <div className="bg-[radial-gradient(circle_at_top_left,rgba(96,165,250,0.08),transparent_38%),radial-gradient(circle_at_top_right,rgba(167,139,250,0.08),transparent_42%)] p-4 sm:p-5">
                    {empty || children}
                </div>
            </div>
        </section>
    );
}

export default CommandChartCard;
