import { ImageResponse } from 'next/og'
import SocialImage from '@/features/public/shared/SocialImage'

export const runtime = 'edge'

export const alt = 'Trouvable | Firme de visibilité Google et réponses IA'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
    return new ImageResponse(<SocialImage />, { ...size })
}
