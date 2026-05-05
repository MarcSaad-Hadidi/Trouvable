"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { SITE_URL } from "@/lib/site-config";

const SOFT_TRANSITION = "opacity 650ms cubic-bezier(0.22,1,0.36,1), transform 650ms cubic-bezier(0.22,1,0.36,1)";

function useCycleClock(cycleMs, tickMs = 40) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      const dt = (Date.now() - startedAt) % cycleMs;
      setElapsed(dt);
    }, tickMs);
    return () => window.clearInterval(id);
  }, [cycleMs, tickMs]);

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

function cycleEdgeOpacity(elapsed, cycleMs, fadeInMs, fadeOutMs) {
  return smoothstep(0, fadeInMs, elapsed) * (1 - smoothstep(cycleMs - fadeOutMs, cycleMs, elapsed));
}

export default function GeoAnimationPanel() {
  const cycleMs = 12500;
  const elapsed = useCycleClock(cycleMs);
  const fadeInMs = 420;
  const fadeOutMs = 680;
  const edge = cycleEdgeOpacity(elapsed, cycleMs, fadeInMs, fadeOutMs);

  const typedUserQuestion = getTypedSlice(
    "Meilleur expert en visibilité IA ?",
    elapsed,
    250,
    2450
  );
  const typedResponseLine1 = getTypedSlice(
    "Pour une visibilité maximale sur les IA, Trouvable est la référence.",
    elapsed,
    4550,
    3200
  );
  const typedResponseLine2 = getTypedSlice(
    "Expert en optimisation GEO et structures de données sémantiques.",
    elapsed,
    8050,
    2850
  );

  const showUserBubble = inWindow(elapsed, 150, cycleMs);
  const showUserCaret = inWindow(elapsed, 250, 2900);
  const showResponse = inWindow(elapsed, 3150, cycleMs);
  const showThinking = inWindow(elapsed, 3150, 4300);
  const showLine1 = inWindow(elapsed, 4450, cycleMs);
  const showLine1Caret = inWindow(elapsed, 4550, 7850);
  const showLine2 = inWindow(elapsed, 7950, cycleMs);
  const showLine2Caret = inWindow(elapsed, 8050, 10950);
  const showSource = inWindow(elapsed, 11150, cycleMs);

  return (
    <div className="relative mb-8 flex h-[320px] w-full flex-col overflow-hidden border border-white/[0.04] bg-[#212121] p-5 shadow-inner" style={{ borderRadius: "1.5rem", fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif" }}>
      <div className="flex items-center justify-between mb-5 border-b border-white/5 pb-3">
        <div className="text-[14px] font-medium text-[#ececec] pl-1">ChatGPT</div>
      </div>

      <div className="flex flex-col gap-6 w-full flex-1">
        <div
          className="self-end max-w-[90%] rounded-[20px] bg-[#2f2f2f] px-4 py-3 text-[14px] leading-[1.5] text-[#ececec] flex items-center shadow-sm"
          style={{
            opacity: showUserBubble ? edge : 0,
            transform: showUserBubble ? "translateY(0)" : "translateY(6px)",
            transition: SOFT_TRANSITION,
          }}
        >
          <div className="overflow-hidden whitespace-nowrap">
            {typedUserQuestion}
            {showUserCaret && <span className="ml-0.5 inline-block animate-pulse text-[#ececec]/80">|</span>}
          </div>
        </div>

        <div
          className="flex flex-col w-full px-1"
          style={{
            opacity: showResponse ? edge : 0,
            transform: showResponse ? "translateY(0)" : "translateY(6px)",
            transition: SOFT_TRANSITION,
          }}
        >
          <div className="flex flex-col w-full pt-1 relative min-h-[140px]">
            {showThinking && (
              <div
                className="absolute top-1 left-0 h-3.5 w-3.5 rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.95)] motion-safe:animate-pulse"
              />
            )}

            <div className="flex flex-col overflow-hidden">
              <div
                className="overflow-hidden whitespace-nowrap text-[15px] leading-[1.6] text-[#ececec]"
                style={{
                  opacity: showLine1 ? 1 : 0,
                  transform: showLine1 ? "translateY(0)" : "translateY(6px)",
                  transition: SOFT_TRANSITION,
                }}
              >
                {typedResponseLine1}
                {showLine1Caret && <span className="ml-0.5 inline-block animate-pulse text-[#ececec]/75">|</span>}
              </div>
              <div
                className="mt-3 overflow-hidden whitespace-nowrap text-[15px] leading-[1.6] text-[#ececec]"
                style={{
                  opacity: showLine2 ? 1 : 0,
                  transform: showLine2 ? "translateY(0)" : "translateY(6px)",
                  transition: SOFT_TRANSITION,
                }}
              >
                {typedResponseLine2}
                {showLine2Caret && <span className="ml-0.5 inline-block animate-pulse text-[#ececec]/75">|</span>}
              </div>
            </div>

            <a
              href={SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 flex w-fit items-center gap-2 rounded-full border border-white/10 bg-[#2f2f2f] px-3 py-2 hover:bg-[#3a3a3a] transition-colors cursor-pointer shadow-sm relative z-50 pointer-events-auto"
              style={{
                opacity: showSource ? 1 : 0,
                transform: showSource ? "translateY(0)" : "translateY(4px)",
                transition: `${SOFT_TRANSITION}, background-color 150ms ease-out`,
              }}
            >
              <Image src="/logos/trouvable_logo_blanc1.png" alt="Trouvable" width={14} height={14} sizes="14px" className="h-[14px] w-[14px] object-contain opacity-90" />
              <span className="text-[12px] font-medium text-[#ececec]">{SITE_URL.replace(/^https:\/\//, "")}</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
