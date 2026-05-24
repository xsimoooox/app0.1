import React from 'react';
import { PhoneIncoming } from 'lucide-react';

const calls = [
  { id: '1', name: 'Amina Moussaoui', when: 'Hier - 14:32', duration: '4 min 12 sec', status: 'Reçu' },
  { id: '2', name: 'Karim Meziane', when: 'Mardi - 09:18', duration: '2 min 45 sec', status: 'Reçu' },
  { id: '3', name: 'Sara Lahlou', when: '12 mai - 18:05', duration: '1 min 06 sec', status: 'Manqué' },
];

export default function EntendantHistorique() {
  return (
    <div className="w-full max-w-md mx-auto min-h-screen bg-[#f5f5f5] text-[#111111] px-4 pt-5 pb-[88px] select-none animate-fade-in">
      <header className="mb-5">
        <h1 className="text-[15px] font-extrabold">Historique</h1>
        <p className="text-[10px] text-[#777777] font-semibold mt-1">Appels LSF reçus</p>
      </header>

      <div className="space-y-2">
        {calls.map((call) => (
          <div key={call.id} className="rounded-[12px] border border-[#e5e5e5] bg-[#fafafa] p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-[10px] bg-[#e8f5e9] text-[#4ade80] flex items-center justify-center shrink-0">
              <PhoneIncoming size={18} strokeWidth={2.1} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold truncate">{call.name}</p>
              <p className="text-[9px] text-[#777777] font-semibold mt-0.5">{call.when} - {call.duration}</p>
            </div>
            <span className={`text-[8px] font-black uppercase ${call.status === 'Manqué' ? 'text-[#ef4444]' : 'text-[#4ade80]'}`}>
              {call.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
