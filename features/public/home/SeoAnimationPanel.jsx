"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { SITE_URL } from "@/lib/site-config";

function useCycleClock(cycleMs) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = performance.now();
    let raf = 0;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      setElapsed((performance.now() - startedAt) % cycleMs);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [cycleMs]);

  return elapsed;
}

function getTypedSlice(text, elapsed, startMs, typeDurationMs) {
  if (elapsed < startMs) return "";
  if (elapsed >= startMs + typeDurationMs) return text;
  const progress = (elapsed - startMs) / typeDurationMs;
  const chars = Math.max(0, Math.floor(progress * text.length));
  return text.slice(0, chars);
}

function inWindow(elapsed, startMs, endMs) {
  return elapsed >= startMs && elapsed < endMs;
}

function smoothstep(edge0, edge1, x) {
  if (edge1 <= edge0) return x >= edge1 ? 1 : 0;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Fondu début/fin de boucle — à appliquer au contenu (texte / cartes), pas au chrome du mock. */
function cycleEdgeOpacity(elapsed, cycleMs, fadeInMs, fadeOutMs) {
  return smoothstep(0, fadeInMs, elapsed) * (1 - smoothstep(cycleMs - fadeOutMs, cycleMs, elapsed));
}

export default function SeoAnimationPanel() {
  const cycleMs = 8800;
  const elapsed = useCycleClock(cycleMs);
  const fadeInMs = 420;
  const fadeOutMs = 680;
  const edge = cycleEdgeOpacity(elapsed, cycleMs, fadeInMs, fadeOutMs);

  const queryStart = 250;
  const queryDuration = 2350;
  const mainResultStart = queryStart + queryDuration + 260;
  const skeletonStart = mainResultStart + 650;
  const mainRevealMs = 900;
  const skeletonRevealMs = 900;

  const typedSeoQuery = getTypedSlice(
    "Meilleur expert SEO Quebec",
    elapsed,
    queryStart,
    queryDuration
  );
  const showCaret = inWindow(elapsed, queryStart, mainResultStart);

  const mainReveal = smoothstep(mainResultStart, mainResultStart + mainRevealMs, elapsed);
  const skeletonReveal = smoothstep(skeletonStart, skeletonStart + skeletonRevealMs, elapsed);
  const mainOpacity = edge * mainReveal;
  const mainOffsetY = 8 * (1 - mainReveal);
  const skeletonOpacity = edge * skeletonReveal;
  const skeletonOffsetY = 10 * (1 - skeletonReveal);

  return (
    <div className="relative mb-8 flex h-[320px] w-full flex-col overflow-hidden border border-white/[0.04] bg-[#202124] p-5 shadow-inner" style={{ borderRadius: "1.5rem", fontFamily: "Arial, sans-serif" }}>
      <div className="mb-6 mt-1 flex w-full items-center gap-4 px-1">
        <div className="flex shrink-0 items-center text-[21px] font-bold tracking-[-0.02em]">
          <span className="text-[#4285F4]">G</span>
          <span className="text-[#EA4335]">o</span>
          <span className="text-[#FBBC05]">o</span>
          <span className="text-[#4285F4]">g</span>
          <span className="text-[#34A853]">l</span>
          <span className="text-[#EA4335]">e</span>
        </div>
        <div className="flex h-11 min-w-0 flex-1 items-center rounded-full border border-[#6b7076] bg-[#1f2328] px-4 shadow-[0_1px_8px_rgba(0,0,0,0.35)]">
          <div
            className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[14px] font-medium leading-none text-[#f1f3f4]"
            style={{ opacity: edge }}
          >
            {typedSeoQuery}
            {showCaret && <span className="ml-0.5 inline-block animate-pulse text-[#c9d7ff]/80">|</span>}
          </div>
          <div className="ml-3 flex shrink-0 items-center border-l border-[#6b7076] pl-3 text-[#9cc0ff]">
            <Search className="h-[15px] w-[15px]" />
          </div>
        </div>
      </div>

      <div className="px-2 flex flex-col gap-6">
        <div
          style={{
            opacity: mainOpacity,
            transform: `translateY(${mainOffsetY}px)`,
          }}
        >
          <Link
            href={SITE_URL}
            target="_blank"
            className="relative z-50 group pointer-events-auto"
          >
            <div className="flex items-center gap-3 text-[12px] text-[#bdc1c6] mb-1.5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#303134] overflow-hidden">
                <Image src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" width={14} height={14} sizes="14px" className="h-[14px] w-[14px] object-contain opacity-90" />
              </div>
              <div className="flex flex-col leading-[1.2]">
                <span className="font-normal text-[#dadce0]">Trouvable</span>
                <span className="text-[#bdc1c6]">{SITE_URL.replace(/^https:\/\//, "")}</span>
              </div>
            </div>
            <div className="text-[17.5px] font-normal text-[#8ab4f8] group-hover:underline cursor-pointer leading-[1.25] mb-1.5">
              Trouvable, firme de visibilité Google et réponses IA
            </div>
            <div className="text-[13px] text-[#bdc1c6] leading-[1.58] line-clamp-2">
              Mandats d&apos;exécution : signal public clair sur Google et cohérent face aux modèles conversationnels.
            </div>
          </Link>
        </div>

        <div
          style={{
            opacity: skeletonOpacity,
            transform: `translateY(${skeletonOffsetY}px)`,
          }}
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="h-7 w-7 rounded-full bg-[#303134]" />
            <div className="flex flex-col gap-1.5 w-32">
              <div className="h-1.5 w-16 bg-[#303134] rounded-sm" />
              <div className="h-1.5 w-24 bg-[#303134] rounded-sm" />
            </div>
          </div>
          <div className="h-3 w-64 bg-[#3c4043] rounded-sm mb-2" />
          <div className="h-2 w-full bg-[#303134] rounded-sm mb-1.5" />
          <div className="h-2 w-4/5 bg-[#303134] rounded-sm" />
        </div>
      </div>
    </div>
  );
}
