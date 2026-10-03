'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function Toast({ message, type = 'success', onClose, duration = 5000 }) {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onClose, 300); // Wait for fade out animation
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, onClose]);

    return (
        <div className={`fixed bottom-6 right-6 z-50 transform transition-all duration-300 flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
            } ${type === 'success'
                ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-300'
                : 'bg-red-400/10 border-red-400/20 text-red-300'
            }`}>
            {type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <AlertCircle className="w-5 h-5 text-red-400" />}
            <p className="text-sm font-medium">{message}</p>
            <button onClick={() => { setIsVisible(false); setTimeout(onClose, 300); }} className="ml-2 hover:bg-white/10 p-1 rounded-full transition-colors">
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
