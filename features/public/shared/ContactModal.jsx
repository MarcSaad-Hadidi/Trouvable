"use client";
import React, { useState, useRef, useEffect } from 'react';
import { X, Send, CheckCircle2, ArrowRight } from 'lucide-react';
import { Turnstile } from '@marsidev/react-turnstile';

export default function ContactModal() {
    const [isOpen, setIsOpen] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', businessType: '', message: '', honeypot: '' });
    const [formStatus, setFormStatus] = useState('idle');
    const [turnstileToken, setTurnstileToken] = useState(null);
    const [turnstileError, setTurnstileError] = useState('');
    const [turnstileErrorCode, setTurnstileErrorCode] = useState('');
    const [apiError, setApiError] = useState('');
    const [turnstileRenderKey, setTurnstileRenderKey] = useState(0);
    const formRef = useRef();
    const modalRef = useRef();
    const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    const isTurnstileConfigured = Boolean(turnstileSiteKey);

    useEffect(() => {
        const handleOpen = () => setIsOpen(true);
        window.addEventListener('openContactModal', handleOpen);
        return () => window.removeEventListener('openContactModal', handleOpen);
    }, []);

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleClose = () => {
        setFormStatus('idle');
        setTurnstileToken(null);
        setTurnstileError('');
        setTurnstileErrorCode('');
        setApiError('');
        setIsOpen(false);
    };

    const resetTurnstileWidget = () => {
        setTurnstileToken(null);
        setTurnstileError('');
        setTurnstileErrorCode('');
        setTurnstileRenderKey((v) => v + 1);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (formData.honeypot) { setFormStatus('success'); return; }
        if (!isTurnstileConfigured) {
            setTurnstileError("Vérification anti-robot indisponible pour le moment. Merci de réessayer dans quelques instants.");
            return;
        }
        if (!turnstileToken) { alert("Veuillez valider la vérification anti-robot."); return; }

        setFormStatus('loading');
        setTurnstileError('');
        setApiError('');
        try {
            const searchParams = new URLSearchParams(window.location.search);
            const response = await fetch('/api/submit-lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formData.name, email: formData.email, phone: formData.phone || '',
                    businessType: formData.businessType || '', message: formData.message,
                    honeypot: formData.honeypot, turnstileToken,
                    page_path: window.location.pathname,
                    utm_source: searchParams.get('utm_source') || '',
                    utm_medium: searchParams.get('utm_medium') || '',
                    utm_campaign: searchParams.get('utm_campaign') || ''
                }),
            });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || "Erreur lors de l'envoi"); }
            setFormStatus('success');
            setFormData({ name: '', email: '', phone: '', businessType: '', message: '', honeypot: '' });
            setTurnstileToken(null);
            setTurnstileError('');
            setTurnstileErrorCode('');
        } catch (err) {
            console.error('API error:', err);
            setTurnstileToken(null);
            if (String(err?.message || '').toLowerCase().includes('anti-robot')) {
                setTurnstileError("La vérification Cloudflare a expiré ou a échoué. Merci de valider à nouveau.");
            } else {
                setApiError(err?.message || '');
            }
            setFormStatus('error');
        }
    };

    const inputClasses = "w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-[14px] text-white outline-none transition-all duration-200 placeholder:text-white/20 hover:border-white/[0.14] focus:border-[#5b73ff]/50 focus:bg-white/[0.06] focus:ring-1 focus:ring-[#5b73ff]/20";

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-label="Formulaire de contact Trouvable">
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-xl"
                onClick={handleClose}
                onKeyDown={(e) => { if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') handleClose(); }}
                aria-label="Fermer la modale"
                role="button"
                tabIndex={0}
                style={{ animation: 'contactBgIn 0.3s ease' }}
            />

            <div
                ref={modalRef}
                className="relative w-full max-w-[480px] max-h-[92vh] overflow-y-auto rounded-2xl border border-white/[0.08] bg-[#0a0a0a] shadow-[0_32px_100px_rgba(0,0,0,0.8),0_0_0_1px_rgba(255,255,255,0.03)]"
                style={{ animation: 'contactSlideUp 0.4s cubic-bezier(0.16,1,0.3,1)' }}
            >
                <style>{`
                    @keyframes contactBgIn { from { opacity: 0; } to { opacity: 1; } }
                    @keyframes contactSlideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
                    @keyframes contactPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
                `}</style>

                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#5b73ff]/40 to-transparent" />

                {/* Close button */}
                <button
                    onClick={handleClose}
                    className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/40 hover:text-white hover:bg-white/[0.08] transition-all duration-200"
                    aria-label="Fermer"
                    toolname="close_contact_form"
                    tooldescription="Fermer la modale de contact Trouvable."
                >
                    <X size={15} strokeWidth={2.5} />
                </button>

                {formStatus === 'success' ? (
                    <div className="p-10 flex flex-col items-center text-center">
                        <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5" style={{ animation: 'contactPulse 1.5s ease infinite' }}>
                            <CheckCircle2 size={30} className="text-emerald-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2" aria-live="polite">Message envoyé</h3>
                        <p className="text-white/40 text-[14px] leading-relaxed mb-8 max-w-[280px]">
                            Nous avons bien reçu votre demande. Notre équipe vous répondra dans les meilleurs délais.
                        </p>
                        <button
                            onClick={handleClose}
                            className="px-6 py-3 rounded-xl bg-white/[0.06] border border-white/[0.08] text-white/80 text-[13px] font-semibold hover:bg-white/[0.1] transition-all"
                        >
                            Fermer
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div className="px-7 pt-8 pb-5">
                            <div className="flex items-center gap-2.5 mb-3">
                                <div className="w-8 h-8 rounded-lg bg-[#5b73ff]/10 border border-[#5b73ff]/20 flex items-center justify-center">
                                    <Send size={14} className="text-[#5b73ff]" />
                                </div>
                                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#5b73ff]/70">Contact</span>
                            </div>
                            <h2 className="text-[22px] font-bold text-white tracking-[-0.03em] leading-tight">
                                Parlons de votre<br />
                                <span className="bg-gradient-to-r from-[#5b73ff] to-[#9333ea] bg-clip-text text-transparent">visibilité IA</span>
                            </h2>
                            <p className="text-white/35 text-[13px] mt-2 leading-relaxed">
                                Nous vous répondrons dans les meilleurs délais.
                            </p>
                        </div>

                        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent mx-5" />

                        <form
                            ref={formRef}
                            onSubmit={handleSubmit}
                            className="px-7 py-6 space-y-4"
                            data-agent-surface="contact-form"
                            toolname="submit_contact_request"
                            tooldescription="Envoyer une demande de cadrage à Trouvable après validation anti-robot."
                        >
                            {formStatus === 'error' && (
                                <div className="bg-red-500/[0.06] border border-red-500/15 text-red-300/90 rounded-xl px-4 py-3 text-[13px] font-medium leading-relaxed">
                                    {apiError ? (
                                        <>{apiError}</>
                                    ) : (
                                        <>
                                            Une erreur s&apos;est produite. Veuillez réessayer ou nous écrire à{' '}
                                            <span className="font-semibold text-red-300">contact@trouvable.app</span>
                                        </>
                                    )}
                                </div>
                            )}
                            {turnstileError && (
                                <div className="bg-amber-500/[0.08] border border-amber-400/20 text-amber-200 rounded-xl px-4 py-3 text-[13px] font-medium leading-relaxed">
                                    {turnstileError}
                                </div>
                            )}

                            <input id="honeypot" type="hidden" name="honeypot" tabIndex={-1} autoComplete="off" value={formData.honeypot} onChange={handleInputChange} aria-hidden="true" />

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em] mb-1.5" htmlFor="name">
                                        Nom complet <span className="text-[#5b73ff]">*</span>
                                    </label>
                                    <input id="name" type="text" name="name" required autoFocus maxLength={100} autoComplete="name" aria-label="Nom complet" toolparamdescription="Nom complet de la personne qui demande le cadrage." value={formData.name} onChange={handleInputChange} placeholder="Votre nom" className={inputClasses} data-agent-action="contact-name-input" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em] mb-1.5" htmlFor="phone">Téléphone</label>
                                    <input id="phone" type="tel" name="phone" maxLength={20} autoComplete="tel-national" aria-label="Téléphone" toolparamdescription="Numéro de téléphone optionnel pour rappeler la personne." value={formData.phone} onChange={handleInputChange} placeholder="Votre numéro" className={inputClasses} data-agent-action="contact-phone-input" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em] mb-1.5" htmlFor="email">
                                    Courriel <span className="text-[#5b73ff]">*</span>
                                </label>
                                <input id="email" type="email" name="email" required maxLength={100} autoComplete="email" aria-label="Courriel" toolparamdescription="Adresse courriel de réponse pour le cadrage Trouvable." value={formData.email} onChange={handleInputChange} placeholder="votre@courriel.ca" className={inputClasses} data-agent-action="contact-email-input" />
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em] mb-1.5" htmlFor="businessType">Type de commerce</label>
                                <select id="businessType" name="businessType" value={formData.businessType} onChange={handleInputChange} autoComplete="organization-title" aria-label="Type de commerce" toolparamdescription="Catégorie d'entreprise ou de service concernée par la demande." data-agent-action="contact-business-type-select" className={`${inputClasses} appearance-none cursor-pointer [&>option]:bg-[#121212] [&>option]:text-white [&>option]:py-2`} style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffffff40' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center' }}>
                                    <option value="" className="text-white/40">Sélectionner...</option>
                                    <option value="Restaurant / Alimentation">Restaurant / Alimentation</option>
                                    <option value="Hébergement / Tourisme">Hébergement / Tourisme</option>
                                    <option value="Boutique / Commerce de détail">Boutique / Commerce de détail</option>
                                    <option value="Santé / Beauté / Bien-être">Santé / Beauté / Bien-être</option>
                                    <option value="Services professionnels">Services professionnels</option>
                                    <option value="Artisan / Réparation / Auto">Artisan / Réparation / Auto</option>
                                    <option value="Technologie / Agence">Technologie / Agence</option>
                                    <option value="Autre">Autre entreprise locale</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-[11px] font-semibold text-white/40 uppercase tracking-[0.08em] mb-1.5" htmlFor="message">
                                    Message <span className="text-[#5b73ff]">*</span>
                                </label>
                                <textarea id="message" name="message" required minLength={10} maxLength={1000} rows={3} autoComplete="off" aria-label="Message" toolparamdescription="Contexte du site, de l'entreprise, du marché local et des objectifs de visibilité." data-agent-action="contact-message-input" value={formData.message} onChange={handleInputChange} placeholder="Parlez-nous de votre commerce et de vos objectifs..." className={`${inputClasses} resize-none`} />
                                <div className="flex justify-end mt-1">
                                    <span className={`text-[10px] tabular-nums ${formData.message.length >= 900 ? 'text-amber-400/60' : formData.message.length >= 1000 ? 'text-red-400 font-bold' : 'text-white/15'}`}>
                                        {formData.message.length}/1000
                                    </span>
                                </div>
                            </div>

                            <div className="flex justify-center py-1">
                                {isTurnstileConfigured ? (
                                    <Turnstile
                                        key={turnstileRenderKey}
                                        siteKey={turnstileSiteKey}
                                        options={{
                                            retry: 'auto',
                                            retryInterval: 1200,
                                            refreshExpired: 'auto',
                                            refreshTimeout: 'auto',
                                        }}
                                        onSuccess={(token) => {
                                            setTurnstileToken(token);
                                            setTurnstileError('');
                                            setTurnstileErrorCode('');
                                        }}
                                        onError={(errorCode) => {
                                            setTurnstileToken(null);
                                            const code = errorCode ? String(errorCode) : '';
                                            setTurnstileErrorCode(code);
                                            if (code === '110200') {
                                                setTurnstileError("Cloudflare refuse ce domaine pour la clé actuelle. Vérifiez la configuration Turnstile (trouvable.app et www.trouvable.app).");
                                            } else {
                                                setTurnstileError("La vérification Cloudflare n'a pas pu être chargée. Vérifiez votre connexion et réessayez.");
                                            }
                                        }}
                                        onExpire={() => {
                                            setTurnstileToken(null);
                                            setTurnstileError('La vérification anti-robot a expiré. Merci de valider à nouveau.');
                                        }}
                                    />
                                ) : (
                                    <div className="w-full rounded-xl border border-amber-400/20 bg-amber-500/[0.08] px-4 py-3 text-center text-[12px] text-amber-200">
                                        Vérification Cloudflare momentanément indisponible.
                                    </div>
                                )}
                            </div>
                            {turnstileError && isTurnstileConfigured && (
                                <div className="flex items-center justify-center">
                                    <button
                                        type="button"
                                        onClick={resetTurnstileWidget}
                                        className="mt-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[12px] text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                                    >
                                        Recharger la vérification Cloudflare
                                    </button>
                                </div>
                            )}
                            {turnstileErrorCode && (
                                <p className="text-center text-[10px] text-white/20">
                                    Code diagnostic Turnstile: {turnstileErrorCode}
                                </p>
                            )}

                            <button
                                type="submit"
                                disabled={formStatus === 'loading' || !turnstileToken || !isTurnstileConfigured}
                                aria-label="Envoyer le formulaire de contact"
                                data-agent-action="contact-submit"
                                toolname="submit_contact_request"
                                tooldescription="Soumettre la demande de contact Trouvable avec les champs fournis."
                                className="w-full group relative overflow-hidden rounded-xl font-semibold text-[14px] py-3.5 transition-all duration-300 disabled:opacity-30 disabled:cursor-not-allowed"
                                style={{
                                    background: formStatus === 'loading' || !turnstileToken || !isTurnstileConfigured
                                        ? 'rgba(255,255,255,0.04)'
                                        : 'linear-gradient(135deg, #5b73ff, #7c3aed)',
                                    color: formStatus === 'loading' || !turnstileToken || !isTurnstileConfigured ? 'rgba(255,255,255,0.3)' : '#fff',
                                    boxShadow: formStatus === 'loading' || !turnstileToken || !isTurnstileConfigured ? 'none' : '0 4px 20px rgba(91,115,255,0.25), inset 0 1px 0 rgba(255,255,255,0.1)',
                                }}
                            >
                                {formStatus === 'loading' ? (
                                    <span className="flex items-center justify-center gap-2.5">
                                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                                        </svg>
                                        Envoi en cours...
                                    </span>
                                ) : (
                                    <span className="flex items-center justify-center gap-2">
                                        Envoyer le message
                                        <ArrowRight size={15} className="group-hover:translate-x-0.5 transition-transform" />
                                    </span>
                                )}
                            </button>

                            <p className="text-center text-[11px] text-white/15 leading-relaxed pt-1">
                                Vos informations sont confidentielles et ne seront jamais partagées.
                            </p>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
}


