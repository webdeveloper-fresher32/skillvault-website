import React from 'react';

export default function Loading() {
  return (
    <div className="min-h-[70vh] w-full flex flex-col items-center justify-center relative overflow-hidden">
      {/* Top running laser progress indicator */}
      <div className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-cyan-400 to-indigo-500 animate-pulse z-50 shadow-[0_0_12px_rgba(59,130,246,0.8)]" />

      <div className="flex flex-col items-center gap-4">
        <div className="relative flex h-12 w-12 items-center justify-center">
          <div className="absolute inset-0 rounded-xl bg-blue-500/20 blur-md animate-ping" />
          <div className="h-10 w-10 rounded-xl border-2 border-blue-500/40 border-t-blue-400 animate-spin" />
        </div>
        <div className="text-xs font-mono text-slate-400 tracking-wider animate-pulse">
          SKILLVAULT // SYNCING...
        </div>
      </div>
    </div>
  );
}
