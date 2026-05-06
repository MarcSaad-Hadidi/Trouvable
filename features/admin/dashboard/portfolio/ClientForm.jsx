'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { saveClientProfileAction } from '@/lib/actions/saveClientProfile';
import Toast from '@/features/admin/dashboard/shared/components/Toast';
import Link from 'next/link';
import { Sparkles, Activity } from 'lucide-react';

function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '');
}

export default function ClientForm({ initialData = null }) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState(null);
    const [toast, setToast] = useState(null);

    const isEditMode = !!initialData?.id;

    const [formData, setFormData] = useState({
        id: initialData?.id || null,
        client_name: initialData?.client_name || '',
        client_slug: initialData?.client_slug || '',
        website_url: initialData?.website_url || '',
        business_type: initialData?.business_type || '',
        seo_title: initialData?.seo_title || '',
        seo_description: initialData?.seo_description || '',
        is_published: initialData?.is_published || false,
        social_profiles: initialData?.social_profiles || [],
        address: initialData?.address || { street: '', city: '', region: '', postalCode: '', country: '' },
        geo_faqs: initialData?.geo_faqs || [],
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;
        setFormData(prev => {
            const up = { ...prev, [name]: newValue };
            if (name === 'client_name' && (!isEditMode || !prev.client_slug)) {
                up.client_slug = slugify(newValue);
            }
            if (name === 'client_slug') {
                up.client_slug = slugify(newValue);
            }
            return up;
        });
    };

    const handleAddressChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, address: { ...prev.address, [name]: value } }));
    };

    const addSocialProfile = () => {
        setFormData(prev => ({ ...prev, social_profiles: [...prev.social_profiles, ''] }));
    };
    const updateSocialProfile = (index, value) => {
        setFormData(prev => {
            const arr = [...prev.social_profiles];
            arr[index] = value;
            return { ...prev, social_profiles: arr };
        });
    };
    const removeSocialProfile = (index) => {
        setFormData(prev => ({ ...prev, social_profiles: prev.social_profiles.filter((_, i) => i !== index) }));
    };

    const addFaq = () => {
        setFormData(prev => ({ ...prev, geo_faqs: [...prev.geo_faqs, { question: '', answer: '' }] }));
    };
    const updateFaq = (index, field, value) => {
        setFormData(prev => {
            const arr = [...prev.geo_faqs];
            arr[index] = { ...arr[index], [field]: value };
            return { ...prev, geo_faqs: arr };
        });
    };
    const removeFaq = (index) => {
        setFormData(prev => ({ ...prev, geo_faqs: prev.geo_faqs.filter((_, i) => i !== index) }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        setError(null);
        const payload = {
            ...formData,
            social_profiles: formData.social_profiles.map(p => p.trim()).filter(Boolean),
            geo_faqs: formData.geo_faqs.map(f => ({ question: f.question.trim(), answer: f.answer.trim() })).filter(f => f.question && f.answer),
        };
        startTransition(async () => {
            const result = await saveClientProfileAction(payload);
            if (result?.error) {
                setError(result.error);
                setToast({ message: result.error, type: 'error' });
            } else if (result?.success) {
                setToast({ message: isEditMode ? 'Profil mis à jour avec succès !' : 'Profil créé avec succès !', type: 'success' });
                setTimeout(() => { router.push('/admin/clients'); }, 1500);
            }
        });
    };

    const inputClass = "w-full px-4 py-2 bg-[#161616] border border-white/10 rounded-lg text-white placeholder:text-white/25 focus:ring-[#5b73ff] focus:border-[#5b73ff] outline-none text-sm";
    const inputSmClass = "w-full px-3 py-2 text-sm bg-[#161616] border border-white/10 rounded-lg text-white placeholder:text-white/25 focus:ring-[#5b73ff] focus:border-[#5b73ff] outline-none";
    const labelClass = "block text-sm font-medium text-[#a0a0a0] mb-1";
    const sectionTitle = "text-lg font-semibold text-white border-b border-white/10 pb-2";
    const clientIdSegment = formData.id ? encodeURIComponent(String(formData.id)) : '';

    return (
        <div className="relative">
            {isEditMode && (
                <div className="mb-6 flex flex-wrap justify-end gap-4">
                    <Link
                        href={`/admin/clients/${clientIdSegment}/seo/health`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg text-sm font-bold text-[#a0a0a0] hover:bg-white/[0.06] transition-colors"
                    >
                        <Activity size={16} className="text-[#7b8fff]" /> Santé SEO
                    </Link>
                    <Link
                        href={`/admin/clients/${clientIdSegment}/portal`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-[#0f0f0f] border border-white/10 rounded-lg text-sm font-bold text-[#a0a0a0] hover:bg-white/[0.06] transition-colors"
                    >
                        Portail client
                    </Link>
                    <Link
                        href={`/admin/clients/${clientIdSegment}/dossier`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-transparent rounded-lg text-sm font-bold text-black hover:bg-[#d6d6d6] transition-colors"
                    >
                        <Sparkles size={16} /> Ouvrir le Cockpit
                    </Link>
                </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-8 bg-[#0f0f0f] p-6 md:p-8 rounded-2xl border border-white/10">
                {error && (
                    <div className="p-4 bg-red-400/10 border border-red-400/20 text-red-300 rounded-lg text-sm font-medium">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 1. Informations Principales */}
                    <div className="space-y-4 md:col-span-2">
                        <h3 className={sectionTitle}>Informations Principales</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>Nom du Client *</label>
                                <input required type="text" name="client_name" value={formData.client_name} onChange={handleChange} className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Slug (URL) *</label>
                                <input required type="text" name="client_slug" value={formData.client_slug} onChange={handleChange} className={inputClass + " font-mono"} />
                                <p className="text-xs text-white/25 mt-1">Généré automatiquement. Minuscules et tirets uniquement.</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className={labelClass}>URL du Site Web *</label>
                                <input required type="url" name="website_url" value={formData.website_url} onChange={handleChange} placeholder="https://..." className={inputClass} />
                            </div>
                            <div>
                                <label className={labelClass}>Type d'Entreprise (Schema.org)</label>
                                <input type="text" name="business_type" value={formData.business_type} onChange={handleChange} placeholder="ex: agence, logiciel rh, restaurant..." className={inputClass} />
                                <p className="text-[11px] text-white/30 mt-1.5 leading-relaxed max-w-xl">
                                    Champ utile mais partiel : les prompts et le moteur s’appuient aussi sur l’audit, les services et la description. Évitez les valeurs trop génériques (ex. LocalBusiness seul) et préférez un libellé métier concret.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 2. SEO */}
                    <div className="space-y-4 md:col-span-2">
                        <h3 className={sectionTitle + " mt-4"}>Meta SEO (Optionnel)</h3>
                        <div>
                            <label className={labelClass}>SEO Title</label>
                            <input type="text" name="seo_title" value={formData.seo_title} onChange={handleChange} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>SEO Description</label>
                            <textarea name="seo_description" value={formData.seo_description} onChange={handleChange} rows="2" className={inputClass + " resize-none"}></textarea>
                        </div>
                    </div>

                    {/* 3. Données Structurées */}
                    <div className="space-y-6 md:col-span-2">
                        <h3 className={sectionTitle + " mt-4"}>Données Structurées (AEO / GEO)</h3>

                        {/* Address */}
                        <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.07]">
                            <h4 className="font-medium text-white mb-3">Adresse Physique (Optionnel)</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <input type="text" name="street" value={formData.address.street || ''} onChange={handleAddressChange} placeholder="Rue (Ex: 123 rue Principale)" className={inputSmClass} />
                                <input type="text" name="city" value={formData.address.city || ''} onChange={handleAddressChange} placeholder="Ville (Ex: Montréal)" className={inputSmClass} />
                                <div className="grid grid-cols-2 gap-2">
                                    <input type="text" name="region" value={formData.address.region || ''} onChange={handleAddressChange} placeholder="Région (Ex: QC)" className={inputSmClass} />
                                    <input type="text" name="postalCode" value={formData.address.postalCode || ''} onChange={handleAddressChange} placeholder="Code Postal" className={inputSmClass} />
                                </div>
                                <input type="text" name="country" value={formData.address.country || ''} onChange={handleAddressChange} placeholder="Pays (Ex: Canada)" className={inputSmClass} />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Social Profiles */}
                            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.07]">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-medium text-white">Profils Sociaux (URLs)</h4>
                                    <button type="button" onClick={addSocialProfile} className="text-[#7b8fff] text-sm font-semibold hover:text-white border border-[#5b73ff]/30 px-2 py-0.5 rounded transition-colors hover:bg-[#5b73ff]/10">+ Ajouter</button>
                                </div>
                                <div className="space-y-2">
                                    {formData.social_profiles.length === 0 && <p className="text-xs text-white/25 italic">Aucun profil lié.</p>}
                                    {formData.social_profiles.map((sp, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input type="url" value={sp} onChange={(e) => updateSocialProfile(i, e.target.value)} placeholder="https://facebook.com/..." className={inputSmClass} />
                                            <button type="button" onClick={() => removeSocialProfile(i)} className="text-red-400 hover:bg-red-400/10 px-2 rounded transition-colors text-lg" title="Supprimer">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* FAQs */}
                            <div className="bg-white/[0.02] p-4 rounded-xl border border-white/[0.07]">
                                <div className="flex justify-between items-center mb-3">
                                    <h4 className="font-medium text-white">FAQs (Schema.org)</h4>
                                    <button type="button" onClick={addFaq} className="text-[#7b8fff] text-sm font-semibold hover:text-white border border-[#5b73ff]/30 px-2 py-0.5 rounded transition-colors hover:bg-[#5b73ff]/10">+ FAQ</button>
                                </div>
                                <div className="space-y-4">
                                    {formData.geo_faqs.length === 0 && <p className="text-xs text-white/25 italic">Aucune question.</p>}
                                    {formData.geo_faqs.map((faq, i) => (
                                        <div key={i} className="relative border-l-2 border-[#5b73ff] pl-3">
                                            <button type="button" onClick={() => removeFaq(i)} className="absolute -top-1 -right-1 text-red-400 hover:bg-red-400/10 w-6 h-6 flex items-center justify-center rounded transition-colors" title="Supprimer FAQ">×</button>
                                            <div className="space-y-2 pr-4">
                                                <input type="text" value={faq.question} onChange={(e) => updateFaq(i, 'question', e.target.value)} placeholder="Question" className={inputSmClass + " font-medium"} />
                                                <textarea value={faq.answer} onChange={(e) => updateFaq(i, 'answer', e.target.value)} placeholder="Réponse" rows="2" className={inputSmClass + " resize-none"}></textarea>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 4. Statut & Submit */}
                    <div className="md:col-span-2 pt-6 flex items-center justify-between border-t mt-6 border-white/10">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" name="is_published" checked={formData.is_published} onChange={handleChange} className="w-5 h-5 rounded border-white/20 bg-[#161616] text-[#5b73ff] focus:ring-[#5b73ff]" />
                            <span className="font-semibold text-white">Publier immédiatement le profil</span>
                        </label>
                        <button type="submit" disabled={isPending} className="px-6 py-3 bg-white text-black rounded-lg font-bold hover:bg-[#d6d6d6] transition-colors disabled:opacity-50 min-w-[200px]">
                            {isPending ? 'Sauvegarde...' : isEditMode ? 'Mettre à jour' : 'Créer le profil'}
                        </button>
                    </div>
                </div>
            </form>

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
        </div>
    );
}
