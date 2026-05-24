import React from 'react';

export default function Urgence() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center animate-fade-in">
      <div className="w-full max-w-sm p-8 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/40">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 mb-6 shadow-inner animate-pulse">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2 font-display">
          URGENCE
        </h1>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">
          Accès rapide à la traduction d'urgence LSF.
        </p>
      </div>
    </div>
  );
}
