export const COMMAND_EASE = [0.22, 1, 0.36, 1];

export const commandStagger = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.08,
            delayChildren: 0.04,
        },
    },
};

export const commandFadeUp = {
    hidden: { opacity: 0, y: 18 },
    visible: {
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.48,
            ease: COMMAND_EASE,
        },
    },
};

export const commandFade = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            duration: 0.3,
            ease: COMMAND_EASE,
        },
    },
};

export const commandDrawer = {
    hidden: { opacity: 0, x: 32 },
    visible: {
        opacity: 1,
        x: 0,
        transition: {
            duration: 0.32,
            ease: COMMAND_EASE,
        },
    },
    exit: {
        opacity: 0,
        x: 32,
        transition: {
            duration: 0.22,
            ease: COMMAND_EASE,
        },
    },
};
