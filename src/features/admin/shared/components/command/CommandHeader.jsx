import { COMMAND_TEXT, cn } from './tokens';

export default function CommandHeader({
    brand = null,
    eyebrow = null,
    title,
    subtitle = null,
    meta = null,
    actions = null,
}) {
    return (
        <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-4xl">
                {brand ? <div className="mb-4">{brand}</div> : null}
                {eyebrow ? <div className={COMMAND_TEXT.eyebrow}>{eyebrow}</div> : null}
                <h1 className={cn(COMMAND_TEXT.title, eyebrow && 'mt-3')}>{title}</h1>
                {subtitle ? <p className={cn(COMMAND_TEXT.subtitle, 'mt-3 max-w-3xl')}>{subtitle}</p> : null}
                {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">{actions}</div> : null}
        </section>
    );
}
