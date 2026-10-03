import { SITE_LAST_MODIFIED_ISO, SITE_URL } from '@/lib/site-config';

function escapeXml(value = '') {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export const runtime = 'nodejs';

export function GET() {
    const items = [
        {
            title: 'Etudes de cas Trouvable',
            description: 'Vue d ensemble des retours d experience et du cadre de lecture des mandats.',
            url: `${SITE_URL}/etudes-de-cas`,
            pubDate: SITE_LAST_MODIFIED_ISO,
        },
        {
            title: 'Dossier-type Trouvable',
            description: 'Structure representative d un dossier d execution avec donnees anonymisees.',
            url: `${SITE_URL}/etudes-de-cas/dossier-type`,
            pubDate: SITE_LAST_MODIFIED_ISO,
        },
    ];

    const itemXml = items
        .map((item) => `
    <item>
      <title>${escapeXml(item.title)}</title>
      <description>${escapeXml(item.description)}</description>
      <link>${escapeXml(item.url)}</link>
      <guid>${escapeXml(item.url)}</guid>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
    </item>`)
        .join('\n');

    const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Trouvable - Etudes de cas</title>
    <link>${SITE_URL}</link>
    <description>Flux des contenus de type etude de cas et dossier-type.</description>
    <language>fr-ca</language>
    <lastBuildDate>${new Date(SITE_LAST_MODIFIED_ISO).toUTCString()}</lastBuildDate>
${itemXml}
  </channel>
</rss>
`;

    return new Response(body, {
        status: 200,
        headers: {
            'Content-Type': 'application/rss+xml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600',
            'Last-Modified': new Date(SITE_LAST_MODIFIED_ISO).toUTCString(),
        },
    });
}
