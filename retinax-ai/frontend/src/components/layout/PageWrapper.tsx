import { motion } from "framer-motion";
import type { ReactNode } from "react";

import { cx } from "@/utils";

interface Props {
  children: ReactNode;
  className?: string;
  /** When true, removes the default top padding (used by Landing's full-bleed hero). */
  fullBleed?: boolean;
}

export default function PageWrapper({ children, className, fullBleed = false }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cx("min-h-screen", !fullBleed && "pt-20 pb-16", className)}
    >
      {children}
    </motion.div>
  );
}
