'use client';

import { useTransition, useState } from 'react';
import { togglePublishAction } from './actions';
import Toast from '@/features/admin/shared/components/Toast';

const PUBLISH_ALLOWED_STATES = new Set(['active', 'paused']);

export default function PublishToggle({ id, isPublished, lifecycleStatus }) {
    const [isPending, startTransition] = useTransition();
    const [toast, setToast] = useState(null);

    const currentLifecycle = lifecycleStatus || 'prospect';
    const canPublish = PUBLISH_ALLOWED_STATES.has(currentLifecycle);

    const handleToggle = () => {
        if (!canPublish && !isPublished) return;
        startTransition(async () => {
            const result = await togglePublishAction(id, isPublished);
            if (result?.error) {
                setToast({ message: result.error, type: 'error' });
            } else if (result?.success) {
                setToast({ message: `Profil ${!isPublished ? 'publié' : 'mis en brouillon'} !`, type: 'success' });
            }
        });
    };

    // Allow unpublishing from any state, block publishing from non-active/paused
    const isBlocked = !canPublish && !isPublished;

    return (
        <div className="relative">
            <button
                type="button"
                onClick={handleToggle}
                disabled={isPending || isBlocked}
                title={isBlocked ? `Publication bloquée : le mandat est en état « ${currentLifecycle} »` : undefined}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border ${isPublished
                    ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20 hover:bg-emerald-400/20'
                    : isBlocked
                        ? 'bg-white/[0.02] text-white/20 border-white/[0.05] cursor-not-allowed'
                        : 'bg-white/[0.04] text-white/40 border-white/10 hover:bg-white/[0.08]'
                    } ${isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {isPending ? '...' : isPublished ? 'Publié' : 'Brouillon'}
            </button>

            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
