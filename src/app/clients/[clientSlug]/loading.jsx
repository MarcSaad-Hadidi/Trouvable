export default function Loading() {
    return (
        <div className="min-h-screen bg-[#080808]">
            <div className="mx-auto max-w-4xl px-6 pt-32 pb-20 animate-pulse">
                <div className="h-8 w-48 rounded bg-white/5 mb-4" />
                <div className="h-5 w-80 rounded bg-white/5 mb-10" />
                <div className="space-y-4">
                    <div className="h-4 w-full rounded bg-white/5" />
                    <div className="h-4 w-3/4 rounded bg-white/5" />
                    <div className="h-4 w-5/6 rounded bg-white/5" />
                </div>
            </div>
        </div>
    );
}
