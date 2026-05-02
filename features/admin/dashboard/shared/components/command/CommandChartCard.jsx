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
                        <div className="mt-3 text-[22px] font-semibold text-slate-950">{title}</div>
                        {resolvedDescription ? (
                            <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{resolvedDescription}</p>
                        ) : null}
                    </div>
                    {action ? <div className="flex shrink-0 items-center lg:justify-end">{action}</div> : null}
                </div>

                {legend ? <div>{legend}</div> : null}
            </div>

            <div
                className={cn(
                    'mt-6 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_18px_42px_rgba(15,23,42,0.07)]',
                    contentClassName,
                )}
            >
                <div className="bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.06),transparent_38%),radial-gradient(circle_at_top_right,rgba(124,58,237,0.05),transparent_42%)] p-4 sm:p-5">
                    {empty || children}
                </div>
            </div>
        </section>
    );
}

export default CommandChartCard;
