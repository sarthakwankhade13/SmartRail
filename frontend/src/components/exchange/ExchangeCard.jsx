import React from 'react';
import { User, Check, X, Shield, ArrowRightLeft } from 'lucide-react';

export default function ExchangeCard({ match, onAccept, onReject, processing }) {
  // Score styling logic
  let scoreColor = 'text-slate-500';
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  
  if (match.match_score >= 10) {
    scoreColor = 'text-emerald-500';
    badgeColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
  } else if (match.match_score >= 5) {
    scoreColor = 'text-amber-500';
    badgeColor = 'bg-amber-100 text-amber-700 border-amber-200';
  }

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:shadow-railway-500/10 transition-all duration-300 animate-slide-up">
      <div className="flex justify-between items-start mb-6">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-railway-100 to-railway-200 rounded-full flex items-center justify-center">
            <User className="w-6 h-6 text-railway-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg leading-tight">{match.passenger_name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-slate-500">{match.gender}, {match.age} yrs</span>
              {match.age > 60 && (
                <span className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  <Shield className="w-3 h-3" /> Senior
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className={`flex flex-col items-end`}>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Match Score</span>
          <div className={`px-3 py-1 rounded-xl border font-bold text-lg ${badgeColor}`}>
            +{match.match_score} pts
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl mb-6">
        <div className="flex-1">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-1">They Have</p>
          <p className="font-bold text-slate-700">{match.current_seat_type}</p>
          <p className="text-sm text-slate-500">Coach {match.coach}, Seat {match.current_seat}</p>
        </div>
        
        <div className="flex items-center justify-center w-10 h-10 bg-white rounded-full shadow-sm border border-slate-100">
          <ArrowRightLeft className="w-5 h-5 text-railway-500" />
        </div>
        
        <div className="flex-1 text-right">
          <p className="text-xs font-semibold text-slate-400 uppercase mb-1">They Want</p>
          <p className="font-bold text-slate-700">{match.requested_seat_type}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => onReject(match.request_id)}
          disabled={processing}
          className="flex-1 py-2.5 rounded-xl border-2 border-slate-200 text-slate-600 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-colors flex justify-center items-center gap-2 disabled:opacity-50"
        >
          <X className="w-4 h-4" /> Reject
        </button>
        <button
          onClick={() => onAccept(match.request_id)}
          disabled={processing}
          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-semibold shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all flex justify-center items-center gap-2 disabled:opacity-50"
        >
          <Check className="w-4 h-4" /> Accept Swap
        </button>
      </div>
    </div>
  );
}
