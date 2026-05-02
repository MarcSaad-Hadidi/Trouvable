import './globals.css'
import { Inter, Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google'
import WebMcpProvider from '@/components/agent/WebMcpProvider'
import DeferredVercelTelemetry from '@/components/analytics/DeferredVercelTelemetry'
import LazyContactModal from '@/features/public/shared/LazyContactModal'
import { WEBMCP_DECLARATIVE_PAYLOAD } from '@/lib/agent-discovery/mcp-tools'
import { SITE_AI_DISCOVERY_PATHS, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from '@/lib/site-config'
import { withPublicAuthor } from '@/lib/seo/metadata'

const inter = Inter({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-inter',
})

const plusJakartaSans = Plus_Jakarta_Sans({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-plus-jakarta-sans',
})

const jetBrainsMono = JetBrains_Mono({
    subsets: ['latin'],
    display: 'swap',
    variable: '--font-jetbrains-mono',
    weight: ['400', '500', '600', '700'],
})

export const metadata = withPublicAuthor({
    title: 'Trouvable | Firme de visibilité Google et réponses IA',
    description: SITE_DESCRIPTION,
    metadataBase: new URL(SITE_URL),
    alternates: {
        canonical: '/',
    },
    openGraph: {
        title: 'Trouvable | Firme de visibilité Google et réponses IA',
        description: SITE_DESCRIPTION,
        url: '/',
        siteName: SITE_NAME,
        locale: 'fr_CA',
        type: 'website',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'Trouvable | Firme de visibilité Google et réponses IA',
        description: SITE_DESCRIPTION,
    },
    icons: {
        icon: '/icon.png',
        apple: '/apple-icon.png',
    },
})

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    themeColor: '#080808',
}

export default function RootLayout({ children }) {
    return (
        <html lang="fr" className={`${inter.variable} ${plusJakartaSans.variable} ${jetBrainsMono.variable} scroll-smooth`} suppressHydrationWarning>
            <head>
                {/* DNS prefetch for external origins used at runtime */}
                <link rel="dns-prefetch" href="https://clerk-telemetry.com" />
                <link rel="alternate" type="text/markdown" href="/markdown?path=/" />
                <link rel="alternate" type="application/rss+xml" href="/rss.xml" title="Trouvable - Etudes de cas" />
                <link rel="alternate" type="text/plain" href={SITE_AI_DISCOVERY_PATHS.aiTxt} />
                <link rel="alternate" type="text/plain" href={SITE_AI_DISCOVERY_PATHS.llmsTxt} />
                <link rel="alternate" type="application/json" href={SITE_AI_DISCOVERY_PATHS.summaryJson} title="Trouvable AI summary" />
                <link rel="alternate" type="application/json" href={SITE_AI_DISCOVERY_PATHS.serviceJson} title="Trouvable AI services" />
                <link rel="alternate" type="application/json" href={SITE_AI_DISCOVERY_PATHS.webMcp} title="Trouvable WebMCP declaration" />
                <script
                    type="webmcp"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBMCP_DECLARATIVE_PAYLOAD) }}
                />
            </head>
            <body className="font-sans">
                <WebMcpProvider />
                {children}
                <LazyContactModal />
                <DeferredVercelTelemetry />
            </body>
        </html>
    )
}
