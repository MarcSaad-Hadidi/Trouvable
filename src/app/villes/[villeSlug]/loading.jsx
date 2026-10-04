export default function Loading() {
    return (
        <div className="min-h-screen bg-[#080808]">
            <div className="mx-auto max-w-5xl px-6 pt-32 pb-20 animate-pulse">
                <div className="h-10 w-64 rounded bg-white/5 mb-4" />
                <div className="h-5 w-96 rounded bg-white/5 mb-12" />
                <div className="grid gap-6 md:grid-cols-2">
                    <div className="h-48 rounded-2xl bg-white/5" />
                    <div className="h-48 rounded-2xl bg-white/5" />
                </div>
            </div>
        </div>
    );
}
