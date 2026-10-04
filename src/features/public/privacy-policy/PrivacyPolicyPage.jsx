import React from 'react';
import Navbar from '@/features/public/shared/Navbar';
import SiteFooter from '@/features/public/shared/SiteFooter';

export const metadata = {
    title: 'Conditions et politique de confidentialité | Trouvable',
    description: 'Règles de confidentialité et données Google de Trouvable.app',
};

export default function CguPage() {
    return (
        <div className="min-h-screen bg-[#080808] font-[Inter] text-[#f0f0f0] antialiased">
            <Navbar />
            <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(52,211,153,0.04)_0%,rgba(91,115,255,0.04)_50%,transparent_70%),linear-gradient(to_bottom,#080808,#080808)]" />

            <main className="relative mt-[58px] px-6 py-20 sm:px-10 lg:py-28 mx-auto max-w-3xl">
                <div className="mb-14">
                    <h1 className="text-[clamp(32px,5vw,56px)] font-bold tracking-[-0.04em] mb-4">
                        Politique de Confidentialité & CGU
                    </h1>
                    <p className="text-[17px] text-[#a0a0a0]">
                        Dernière mise à jour : {new Date().toLocaleDateString('fr-FR')}
                    </p>
                </div>

                <div className="space-y-12 text-[15px] leading-[1.7] text-[#a0a0a0]">
                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-[-0.02em]">1. Collecte des données</h2>
                        <p>
                            Dans le cadre de l&#39;utilisation de l&#39;application Trouvable.app (ci-après
                            &quot;l&#39;Application&quot;), nous sommes amenés à collecter certaines données afin de
                            fournir nos services d&#39;audit et de suivi de performances locales.
                        </p>
                        <p>
                            Nous collectons l&#39;adresse email de connexion (via le service externe Clerk) afin
                            d&#39;assurer la sécurisation et l&#39;accès personnalisé aux portails de mesures.
                        </p>
                    </section>

                    <section className="space-y-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.02] p-6 lg:p-8">
                        <h2 className="text-xl font-bold text-white tracking-[-0.02em]">
                            2. Accès aux données Google (Google Search Console)
                        </h2>
                        <p className="text-[#a0a0a0]">
                            L&#39;Application Trouvable propose une intégration optionnelle avec{' '}
                            <strong>Google Search Console</strong> permettant la synchronisation automatique des
                            performances organiques de votre site web.
                        </p>
                        <ul className="list-inside list-disc space-y-2 text-[#a0a0a0]">
                            <li>
                                <strong>Finalité :</strong> Les données (Requêtes, Clics, Impressions, Positions) sont
                                lues uniquement dans le but de s&#39;afficher sur votre tableau de bord personnel.
                            </li>
                            <li>
                                <strong>Type d&#39;accès :</strong> L&#39;Application ne requiert qu&#39;un accès{' '}
                                <strong>en lecture seule</strong> via la portée (scope){' '}
                                <code>https://www.googleapis.com/auth/webmasters.readonly</code>.
                            </li>
                            <li>
                                <strong>Stockage :</strong> Les jetons d&#39;accès (access & refresh tokens) fournis par
                                l&#39;API Google OAuth sont chiffrés et conservés de manière sécurisée dans notre base
                                de données. Ils sont exclusivement utilisés pour les routines de lecture en arrière-plan
                                autorisées par le client.
                            </li>
                            <li>
                                <strong>Partage :</strong> Sous aucun prétexte, nous ne partageons, ne revendons ni ne
                                transférons vos données issues de la Search Console à des tiers.
                            </li>
                        </ul>
                        <p className="mt-3 text-[#a0a0a0]">
                            Cette utilisation respecte scrupuleusement la politique d&#39;utilisation des données API de
                            Google.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-xl font-bold text-white tracking-[-0.02em]">3. Vos droits</h2>
                        <p>
                            Conformément à la Loi sur la protection des renseignements personnels dans le secteur privé
                            (Loi 25) du Québec et à la LPRPDE fédérale, vous disposez d&#39;un droit d&#39;accès, de
                            rectification, et de suppression de vos données personnelles.
                        </p>
                        <p>
                            Vous pouvez à tout moment révoquer l&#39;accès à vos données Google Search Console de deux
                            façons :
                        </p>
                        <ul className="list-inside list-disc space-y-1">
                            <li>
                                Directement en contactant l&#39;administrateur afin de supprimer le connecteur côté
                                Trouvable.
                            </li>
                            <li>
                                En vous rendant sur la page de sécurité de votre compte Google, section{' '}
                                <em>&quot;Applications tierces ayant accès à votre compte&quot;</em>, et en révoquant
                                Trouvable de la liste.
                            </li>
                        </ul>
                    </section>
                </div>
            </main>

            <SiteFooter />
        </div>
    );
}
