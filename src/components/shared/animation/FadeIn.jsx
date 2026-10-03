"use client";

import { motion } from "framer-motion";

export default function FadeIn({ children, className, delay = 0, direction = "up", once = true, ...props }) {
  const offsets = { up: [24, 0], down: [-24, 0], left: [0, 24], right: [0, -24] };
  const [y, x] = offsets[direction] || offsets.up;

  return (
    <motion.div
      initial={{ opacity: 0, y, x }}
      whileInView={{ opacity: 1, y: 0, x: 0 }}
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
}
