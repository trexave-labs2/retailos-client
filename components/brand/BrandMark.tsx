"use client";

import Image from "next/image";

type BrandMarkProps = {
  size?: number;
  className?: string;
};

export default function BrandMark({ size = 48, className = "" }: BrandMarkProps) {
  return (
    <span className={`brand-mark inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }} aria-hidden="true">
      <Image
        src="/brand/logo-light.svg"
        alt=""
        width={size}
        height={size}
        className="brand-mark-light h-full w-full object-contain"
      />
      <Image
        src="/brand/logo-dark.svg"
        alt=""
        width={size}
        height={size}
        priority
        className="brand-mark-dark h-full w-full object-contain"
      />
    </span>
  );
}
