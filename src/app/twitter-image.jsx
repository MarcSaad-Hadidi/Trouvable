import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const alt = 'Trouvable | Firme de visibilité Google et réponses IA'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function TwitterImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    width: '100%',
                    height: '100%',
                    backgroundColor: '#080808',
                    padding: '60px 80px',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '32px',
                    }}
                >
                    <div
                        style={{
                            fontSize: 72,
                            fontWeight: 800,
                            color: '#f0f0f0',
                            letterSpacing: '-0.04em',
                            lineHeight: 1.1,
                            textAlign: 'center',
                        }}
                    >
                        Trouvable
                    </div>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                        }}
                    >
                        <div style={{ width: 40, height: 2, backgroundColor: '#5b73ff' }} />
                        <div
                            style={{
                                fontSize: 22,
                                fontWeight: 600,
                                color: '#7b8fff',
                                letterSpacing: '0.12em',
                                textTransform: 'uppercase',
                            }}
                        >
                            Firme de visibilité
                        </div>
                        <div style={{ width: 40, height: 2, backgroundColor: '#5b73ff' }} />
                    </div>
                    <div
                        style={{
                            fontSize: 28,
                            color: '#a0a0a0',
                            textAlign: 'center',
                            lineHeight: 1.5,
                            maxWidth: 800,
                        }}
                    >
                        Visibilité organique Google et crédibilité dans les réponses IA.
                        Vous déléguez, nous exécutons.
                    </div>
                </div>
                <div
                    style={{
                        position: 'absolute',
                        bottom: 40,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: 16,
                        color: '#555',
                    }}
                >
                    <span>trouvable.app</span>
                </div>
            </div>
        ),
        { ...size }
    )
}
