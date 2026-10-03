'use client';

import Image from 'next/image';

export const AI_MODELS = [
    { id: 'chatgpt', name: 'ChatGPT', shortName: 'GPT', color: '#10a37f', logo: '/logos/chatgpt.png' },
    { id: 'gemini', name: 'Gemini', shortName: 'Gem', color: '#4285f4', logo: '/logos/gemini.png' },
    { id: 'claude', name: 'Claude', shortName: 'Cl', color: '#D97757', logo: '/logos/claude.png' },
    { id: 'perplexity', name: 'Perplexity', shortName: 'Px', color: '#20B8CD', logo: '/logos/perplexity.webp' },
    { id: 'copilot', name: 'Copilot', shortName: 'Co', color: '#0ea5e9', logo: '/logos/copilot.png' },
];

export function AIModelLogo({ modelId, size = 22, className = '' }) {
    const model = AI_MODELS.find((m) => m.id === modelId);
    if (!model) return null;

    return (
        <div className={`flex items-center justify-center flex-shrink-0 ${className}`} style={{ width: size, height: size }}>
            <Image
                src={model.logo}
                alt={model.name}
                width={size}
                height={size}
                sizes={`${size}px`}
                className="object-contain rounded-md"
            />
        </div>
    );
}
