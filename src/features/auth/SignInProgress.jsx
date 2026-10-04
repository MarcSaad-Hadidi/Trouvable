export default function SignInProgress({ isLoaded, redirectMessage, loadingMessage = 'Chargement…' }) {
    return isLoaded ? (
        <div className="flex min-h-[200px] w-full flex-col items-center justify-center gap-3 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#5b73ff]" />
            <p className="text-sm text-zinc-400">{redirectMessage}</p>
        </div>
    ) : (
        <div
            className="flex min-h-[280px] w-full flex-col items-center justify-center gap-3 rounded-xl bg-white/[0.03]"
            aria-busy="true"
        >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-[#5b73ff]" />
            <p className="text-sm text-zinc-500">{loadingMessage}</p>
        </div>
    );
}
