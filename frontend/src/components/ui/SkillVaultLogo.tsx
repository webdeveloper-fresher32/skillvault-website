import React from 'react';

interface SkillVaultLogoProps {
  size?: number;
  className?: string;
  variant?: 'badge' | 'mark';
}

export function SkillVaultLogo({
  size = 32,
  className = '',
  variant = 'badge',
}: SkillVaultLogoProps) {
  if (variant === 'mark') {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 512 512"
        width={size}
        height={size}
        className={`shrink-0 ${className}`}
        aria-label="SkillVault Logo"
      >
        <defs>
          <linearGradient id="sGradMark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          <linearGradient id="vGradMark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>

          <linearGradient id="coreGradMark" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
        </defs>

        {/* Lower V Foundation Plate */}
        <polygon
          points="92, 235 164, 235 256, 368 348, 235 420, 235 256, 450"
          fill="url(#vGradMark)"
        />

        {/* Upper S Ribbon Plate */}
        <polygon
          points="112, 82 389, 82 389, 164 235, 164 358, 287 358, 358 123, 358 123, 287 276, 287 164, 164 112, 164"
          fill="url(#sGradMark)"
        />

        {/* Center Vault Cryptographic Core */}
        <polygon
          points="256, 235 276, 256 256, 276 236, 256"
          fill="url(#coreGradMark)"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={`shrink-0 ${className}`}
      aria-label="SkillVault Logo"
    >
      <defs>
        {/* Background Gradient */}
        <linearGradient id="svHeaderBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#0f1523" />
          <stop offset="100%" stopColor="#070a10" />
        </linearGradient>

        {/* Border Subtle Rim */}
        <linearGradient id="svHeaderRim" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.06)" />
        </linearGradient>

        {/* S-Ribbon Gradient: Electric Sky to Cobalt */}
        <linearGradient id="sGradBadge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>

        {/* V-Foundation Gradient: Royal Blue to Cobalt */}
        <linearGradient id="vGradBadge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1d4ed8" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>

        {/* Core Diamond: Cyan to Emerald */}
        <linearGradient id="coreGradBadge" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#10b981" />
        </linearGradient>
      </defs>

      {/* Container Squircle */}
      <rect
        x="20"
        y="20"
        width="472"
        height="472"
        rx="116"
        fill="url(#svHeaderBg)"
        stroke="url(#svHeaderRim)"
        strokeWidth="3"
      />
      <rect
        x="26"
        y="26"
        width="460"
        height="460"
        rx="110"
        fill="none"
        stroke="rgba(56,189,248,0.12)"
        strokeWidth="2"
      />

      {/* Monolithic Mark: S + V Geometry */}
      <g id="skillvault-header-mark">
        {/* Lower V Foundation Plate */}
        <polygon
          points="92, 235 164, 235 256, 368 348, 235 420, 235 256, 450"
          fill="url(#vGradBadge)"
        />

        {/* Upper S Ribbon Plate */}
        <polygon
          points="112, 82 389, 82 389, 164 235, 164 358, 287 358, 358 123, 358 123, 287 276, 287 164, 164 112, 164"
          fill="url(#sGradBadge)"
        />

        {/* Center Vault Cryptographic Core */}
        <polygon
          points="256, 235 276, 256 256, 276 236, 256"
          fill="url(#coreGradBadge)"
        />
      </g>
    </svg>
  );
}

export default SkillVaultLogo;
