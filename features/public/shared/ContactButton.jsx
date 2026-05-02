"use client";
import React from 'react';

export default function ContactButton({ children, className, onClickProp, ...rest }) {
    const {
        'data-agent-action': dataAgentAction = 'open-contact-modal',
        toolname = 'open_contact_form',
        tooldescription = 'Ouvrir le formulaire sécurisé pour demander un cadrage Trouvable.',
        ...buttonProps
    } = rest;

    return (
        <button
            type="button"
            className={`font-sans appearance-none ${className || ''}`}
            data-agent-action={dataAgentAction}
            toolname={toolname}
            tooldescription={tooldescription}
            onClick={(e) => {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('openContactModal'));
            }
            if (onClickProp) onClickProp(e);
        }}
            {...buttonProps}
        >
            {children}
        </button>
    );
}
