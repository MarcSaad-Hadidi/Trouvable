"use client";

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export default function TopicFaqList({ faqs }) {
    return (
        <div className="space-y-2">
            {faqs.map((faq, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: i * 0.05 }}>
                    <details className="group rounded-xl border border-white/7 bg-white/[0.02] transition hover:border-amber-400/15 [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium text-white/90 outline-none">
                            <span>{faq.question}</span>
                            <ChevronDown className="h-4 w-4 shrink-0 text-white/30 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-5 pb-5 text-[14px] leading-[1.65] text-[#a0a0a0]">
                            <span>{faq.answer}</span>
                        </div>
                    </details>
                </motion.div>
            ))}
        </div>
    );
}
