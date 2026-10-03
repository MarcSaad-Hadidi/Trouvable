"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

const Analytics = dynamic(
    () => import("@vercel/analytics/react").then((mod) => mod.Analytics),
    { ssr: false },
);

const SpeedInsights = dynamic(
    () => import("@vercel/speed-insights/next").then((mod) => mod.SpeedInsights),
    { ssr: false },
);

export default function DeferredVercelTelemetry() {
    const [shouldMount, setShouldMount] = useState(false);

    useEffect(() => {
        const mount = () => setShouldMount(true);

        if ("requestIdleCallback" in window) {
            const idleId = window.requestIdleCallback(mount, { timeout: 5000 });
            return () => window.cancelIdleCallback?.(idleId);
        }

        const timeoutId = window.setTimeout(mount, 4500);
        return () => window.clearTimeout(timeoutId);
    }, []);

    if (!shouldMount) return null;

    return (
        <>
            <Analytics />
            <SpeedInsights />
        </>
    );
}
