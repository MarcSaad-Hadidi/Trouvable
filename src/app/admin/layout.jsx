export const metadata = {
    robots: { index: false, follow: false },
};

/** Enveloppe legere : la verification admin est dans (workspace)/layout.jsx uniquement (pas sur /admin/sign-in). */
export default function AdminShellLayout({ children }) {
    return children;
}