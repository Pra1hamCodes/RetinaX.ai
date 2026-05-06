import type { HTMLAttributes } from "react";

import { cx } from "@/utils";

export default function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cx(
        "rounded-xl border border-[#1F1F1F] bg-[#0F0F0F] p-6 shadow-sm",
        className,
      )}
    />
  );
}
