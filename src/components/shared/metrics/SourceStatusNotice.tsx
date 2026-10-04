type SourceStatusNoticeProps = {
    status?: string | null;
    errors?: Array<{ source: string; message: string }>;
    domain?: 'SEO' | 'GEO' | 'AGENT';
};
export default function SourceStatusNotice({ status, errors = [], domain = 'SEO' }: SourceStatusNoticeProps) {
    if (status !== 'partial' && status !== 'unavailable') return null;
    return (
        <div role="status" className="rounded-[18px] border border-amber-300/25 bg-amber-400/[0.08] px-4 py-3 text-[12px] text-amber-100/90">
            <p className="font-semibold">{status === 'partial' ? 'Données '+domain+' partielles' : 'Sources '+domain+' indisponibles'}</p>
            <p className="mt-1">Certains indicateurs ne sont pas disponibles. Les valeurs connues restent affichées.</p>
            {errors.length > 0 ? (
                <ul className="mt-2 space-y-1">{errors.map((error) => <li key={error.source}>{error.message}</li>)}</ul>
            ) : null}
        </div>
    );
}
