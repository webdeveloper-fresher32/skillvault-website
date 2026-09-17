'use client';

import React, { useEffect, useState } from 'react';

export default function TopScrollProgress() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const scrollHeight =
        document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
      setScrollProgress(Math.min(100, Math.max(0, progress)));
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div
      className="fixed top-0 left-0 right-0 h-[3.5px] z-[9999] pointer-events-none transition-[width] duration-75 ease-out"
      style={{
        width: `${scrollProgress}%`,
        background: 'linear-gradient(90deg, #38bdf8, #818cf8, #a855f7)',
        boxShadow: '0 0 10px rgba(56, 189, 248, 0.7)',
      }}
      role="progressbar"
      aria-label="Reading Progress"
      aria-valuenow={Math.round(scrollProgress)}
      aria-valuemin={0}
      aria-valuemax={100}
    />
  );
}
