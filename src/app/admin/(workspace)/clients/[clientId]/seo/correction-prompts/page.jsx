import SeoCorrectionPromptsView from '@/features/admin/seo/SeoCorrectionPromptsView';

export const metadata = {
    title: 'Prompts de correction SEO',
    description: 'Section dediee a la generation de prompts de correction IA a partir des problemes SEO Health.',
};

export default function ClientSeoCorrectionPromptsPage() {
    return <SeoCorrectionPromptsView />;
}

