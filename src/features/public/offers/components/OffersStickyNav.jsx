"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, ShieldCheck, TrendingUp } from "lucide-react";

const ITEMS = [
  { id: "cartographie-strategique", label: "Cartographie", icon: Search, accent: "#5b73ff" },
  { id: "mandat-implementation", label: "Implémentation", icon: ShieldCheck, accent: "#34d399" },
  { id: "pilotage-continu", label: "Pilotage", icon: TrendingUp, accent: "#a78bfa" },
];

export default function OffersStickyNav() {
  const [activeId, setActiveId] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observers = [];
    ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActiveId(id); },
        { rootMargin: "-35% 0px -35% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    });

    const onScroll = () => setVisible(window.scrollY > 650);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observers.forEach((o) => o.disconnect());
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.25 }}
          className="fixed top-[60px] inset-x-0 z-40 flex justify-center px-4 pt-2 pointer-events-none"
        >
          <div className="pointer-events-auto flex items-center gap-1 rounded-2xl border border-white/10 bg-[#0a0a0a]/92 px-2 py-1.5 backdrop-blur-xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
            {ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeId === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => document.getElementById(item.id)?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  className={`relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-[13px] font-medium transition-colors duration-200 ${isActive ? "text-white" : "text-white/40 hover:text-white/65"}`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="stickyPill"
                      className="absolute inset-0 rounded-xl"
                      style={{ backgroundColor: `${item.accent}10`, border: `1px solid ${item.accent}25` }}
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5" style={isActive ? { color: item.accent } : undefined} />
                  <span className="relative z-10 hidden sm:inline">{item.label}</span>
                </button>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
