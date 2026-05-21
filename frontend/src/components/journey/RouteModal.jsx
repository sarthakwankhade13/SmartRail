import React from 'react';
import { X, Clock } from 'lucide-react';

export default function RouteModal({ train, onClose }) {
  if (!train) return null;
  const stops = train.stops || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-railway-800 to-railway-950 p-6">
          <button onClick={onClose} className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-lg flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-white" />
          </button>
          <h3 className="text-lg font-bold text-white">{train.trainName}</h3>
          <p className="text-railway-300 text-sm mt-1">#{train.trainNumber} &middot; {train.source} → {train.destination}</p>
        </div>

        {/* Timeline */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="relative">
            {stops.map((stop, i) => {
              const isFirst = i === 0;
              const isLast = i === stops.length - 1;
              return (
                <div key={stop.id || i} className="flex gap-4 pb-6 last:pb-0 animate-slide-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
                  {/* Timeline line + dot */}
                  <div className="flex flex-col items-center">
                    <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${isFirst ? 'bg-emerald-500 border-emerald-500 ring-4 ring-emerald-500/20' : isLast ? 'bg-rose-500 border-rose-500 ring-4 ring-rose-500/20' : 'bg-white border-railway-400'}`} />
                    {!isLast && <div className="w-0.5 flex-1 bg-gradient-to-b from-railway-300 to-railway-200 mt-1" />}
                  </div>
                  {/* Stop info */}
                  <div className={`flex-1 -mt-0.5 pb-2 ${isFirst || isLast ? '' : 'opacity-90'}`}>
                    <div className="flex items-center justify-between">
                      <h4 className={`font-semibold ${isFirst || isLast ? 'text-slate-800 text-base' : 'text-slate-700 text-sm'}`}>{stop.stationName}</h4>
                      {stop.haltTime && (
                        <span className="flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                          <Clock className="w-3 h-3" /> {stop.haltTime}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 mt-1 text-xs text-slate-500">
                      {stop.arrival && <span>Arr: <strong className="text-slate-700">{stop.arrival}</strong></span>}
                      {stop.departure && <span>Dep: <strong className="text-slate-700">{stop.departure}</strong></span>}
                      {isFirst && <span className="text-emerald-600 font-semibold">Origin</span>}
                      {isLast && <span className="text-rose-600 font-semibold">Destination</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {stops.length === 0 && (
            <p className="text-center text-slate-400 py-8">No stop information available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
