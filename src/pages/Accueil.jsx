import React from 'react';

export default function Accueil() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center animate-fade-in">
      <div className="w-full max-w-sm p-8 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/40">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 mb-6 shadow-inner">
          <svg className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2 font-display">
          ACCUEIL
        </h1>
        <p className="text-sm text-slate-500 font-medium leading-relaxed">
          Traduction de la Langue des Signes en temps réel.
        </p>
      </div>
    </div>
  );
}
