import React from 'react';

interface PageLoomLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export const PageLoomLogo: React.FC<PageLoomLogoProps> = ({
  className = '',
  size = 38,
  showWordmark = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      {/* Official High-Resolution PageLoom PL Emblem */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform select-none"
      >
        <defs>
          {/* Main Blue Gradient for the 'P' outer loop */}
          <linearGradient
            id="pageloom-gradient-blue"
            x1="20"
            y1="20"
            x2="110"
            y2="45"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="28%" stopColor="#1e3a8a" />
            <stop offset="60%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>

          {/* Shading for folded corner */}
          <linearGradient
            id="pageloom-fold-shade"
            x1="20"
            y1="75"
            x2="40"
            y2="95"
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor="#0f172a" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
        </defs>

        {/* 1. Outer Frame & 'P' Loop (Top right round curve returning inwards) */}
        <path
          d="M 26 76 L 26 26 C 26 18 32 14 42 14 L 74 14 C 94 14 106 24 106 42 C 106 60 94 70 74 70 L 58 70"
          stroke="url(#pageloom-gradient-blue)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 2. Inner 'L' Lettermark (Solid crisp dark navy) */}
        <path
          d="M 44 26 L 44 88 L 86 88"
          stroke="#0f172a"
          strokeWidth="11.5"
          strokeLinecap="square"
          strokeLinejoin="miter"
          fill="none"
        />

        {/* 3. Folded Page Corner (Bottom-Left fold) */}
        <path
          d="M 26 76 C 26 88 32 98 44 98 L 44 76 Z"
          fill="url(#pageloom-fold-shade)"
        />

        {/* 4. Bottom horizontal page baseline */}
        <path
          d="M 44 98 L 68 98"
          stroke="#0f172a"
          strokeWidth="9"
          strokeLinecap="round"
        />
      </svg>

      {/* Optional Wordmark */}
      {showWordmark && (
        <div className="flex flex-col text-right sm:text-left leading-none">
          <div className="text-2xl font-black tracking-tight text-slate-900 font-sans">
            Page<span className="text-[#2563eb]">Loom</span>
          </div>
          <div className="text-[8.5px] font-extrabold tracking-[0.22em] text-slate-500 uppercase mt-1">
            Websites • Automation • Growth
          </div>
        </div>
      )}
    </div>
  );
};
