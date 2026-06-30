"use client";

import { usePathname } from "next/navigation";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const titleBlurVariants: Variants = {
  initial: {
    opacity: 0,
    filter: "blur(14px)",
    y: 8,
    scale: 1.03,
    letterSpacing: "0.04em",
  },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    scale: 1,
    letterSpacing: "0em",
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1],
    },
  },
  exit: {
    opacity: 0,
    filter: "blur(14px)",
    y: -8,
    scale: 0.98,
    letterSpacing: "0.04em",
    transition: {
      duration: 0.35,
      ease: [0.55, 0.06, 0.68, 0.19],
    },
  },
};

const descBlurVariants: Variants = {
  initial: {
    opacity: 0,
    filter: "blur(10px)",
    y: 6,
  },
  animate: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
      delay: 0.08,
    },
  },
  exit: {
    opacity: 0,
    filter: "blur(10px)",
    y: -6,
    transition: {
      duration: 0.3,
      ease: [0.55, 0.06, 0.68, 0.19],
    },
  },
};

export function PageHeader({
  title,
  description,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <div
      className={cn(
        "flex flex-col gap-1",
        className,
      )}
    >
      <div className="relative min-h-[2.5rem]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.h1
            key={`title-${pathname}`}
            variants={titleBlurVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{
              willChange: "filter, transform, opacity",
            }}
            className="text-3xl font-semibold tracking-tight text-foreground"
          >
            {title}
          </motion.h1>
        </AnimatePresence>
      </div>
      {description !== undefined && (
        <div className="relative min-h-[1.25rem]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p
              key={`desc-${pathname}`}
              variants={descBlurVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              style={{
                willChange: "filter, transform, opacity",
              }}
              className="text-muted-foreground"
            >
              {description}
            </motion.p>
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
