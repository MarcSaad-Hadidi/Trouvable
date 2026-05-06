'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useTransition, useState } from 'react';

export default function SearchBar() {
    const searchParams = useSearchParams();
    const pathname = usePathname();
    const { replace } = useRouter();
    const [isPending, startTransition] = useTransition();

    // Controlled value for the input, initialized with the URL param
    const [query, setQuery] = useState(searchParams.get('q') || '');

    const handleSearch = (e) => {
        e.preventDefault();

        const params = new URLSearchParams(searchParams);
        params.set('page', '1'); // Reset to page 1 on new search

        // Strict client-side sanitize for q: keep only letters, numbers, spaces, and dashes
        const sanitizedQuery = query.trim().replace(/[^a-zA-Z0-9 éèàùâêîôûç-]/g, '');

        if (sanitizedQuery) {
            params.set('q', sanitizedQuery);
        } else {
            params.delete('q');
            setQuery(''); // Reset visual input to the sanitized empty state if it was malformed
        }

        startTransition(() => {
            replace(`${pathname}?${params.toString()}`);
        });
    };

    return (
        <form onSubmit={handleSearch} className="flex gap-2 relative">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher nom ou slug..."
                className="pl-9 pr-4 py-2 bg-[#161616] border border-white/10 rounded-lg text-sm w-64 text-white placeholder:text-white/30 focus:ring-[#5b73ff] focus:border-[#5b73ff] outline-none"
            />
            {/* Search icon */}
            <svg
                className="absolute left-3 top-2.5 h-4 w-4 text-white/30"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>

            <button
                type="submit"
                disabled={isPending}
                className="px-4 py-2 bg-white text-black rounded-lg text-sm font-bold hover:bg-[#d6d6d6] disabled:opacity-50 transition-colors"
            >
                {isPending ? 'Recherche...' : 'Chercher'}
            </button>
        </form>
    );
}
