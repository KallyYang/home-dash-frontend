"use client";

import { motion, type Variants } from "framer-motion";
import { usePathname } from "next/navigation";
import { Children, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const container: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 10, filter: "blur(2px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.32,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
    },
  },
};

export function StaggerContainer({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  return (
    <motion.div
      key={pathname}
      variants={container}
      initial="hidden"
      animate="show"
      className={cn(className)}
    >
      {Children.map(children, (child, i) => (
        <motion.div
          key={i}
          variants={item}
          className="will-change-[opacity,transform,filter]"
        >
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}
