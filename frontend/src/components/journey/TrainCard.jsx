import React from 'react';
import {
  MapPin, Hash, Train, Armchair, Route, ArrowRight, Gauge
} from 'lucide-react';

const TYPE_COLORS = {
  'Rajdhani':     'from-red-500 to-rose-600',
  'Shatabdi':     'from-blue-500 to-indigo-600',
  'Duronto':      'from-purple-500 to-violet-600',
  'Garib Rath':   'from-emerald-500 to-green-600',
  'Vande Bharat': 'from-orange-500 to-amber-600',
  'Superfast':    'from-sky-500 to-cyan-600',
  'Mail/Express': 'from-slate-500 to-gray-600',
};

const AVAIL_STYLE = {
  'Available': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'RAC':       'bg-amber-100 text-amber-700 border border-amber-200',
  'Waitlist':  'bg-rose-100 text-rose-700 border border-rose-200',
};

export default function TrainCard({ train, index, onViewRoute }) {
  const gradient = TYPE_COLORS[train.trainType] || TYPE_COLORS['Mail/Express'];
  const availStyle = AVAIL_STYLE[train.seatAvailability] || AVAIL_STYLE['Available'];

  return (
    <div
      className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-railway-300 shadow-sm hover:shadow-xl hover:shadow-railway-500/10 transition-all duration-300 overflow-hidden animate-slide-up"
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
    >
      {/* Top accent bar */}
      <div className={`h-1 bg-gradient-to-r ${gradient}`} />

      <div className="p-6">
        {/* Header row */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-railway-50 rounded-xl flex items-center justify-center group-hover:bg-railway-100 transition-colors">
              <Train className="w-5 h-5 text-railway-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg leading-tight tracking-tight">
                {train.trainName}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <Hash className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-sm text-slate-500 font-medium">{train.trainNumber}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-lg text-xs font-bold tracking-wide text-white bg-gradient-to-r ${gradient}`}>
              {train.trainType}
            </span>
            <span className={`px-3 py-1 rounded-lg text-xs font-bold tracking-wide ${availStyle}`}>
              {train.seatAvailability}
            </span>
          </div>
        </div>

        {/* Journey timeline */}
        <div className="flex items-center gap-4 mb-5 p-4 bg-slate-50 rounded-xl">
          <div className="flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full ring-4 ring-emerald-500/20" />
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Departure</span>
            </div>
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{train.departureTime}</p>
            <p className="text-sm text-slate-600 font-medium mt-0.5">{train.source}</p>
          </div>

          <div className="flex flex-col items-center gap-1 px-2">
            <div className="flex items-center gap-1">
              <div className="w-8 h-px bg-slate-300" />
              <ArrowRight className="w-4 h-4 text-railway-500 group-hover:animate-train-move" />
              <div className="w-8 h-px bg-slate-300" />
            </div>
            <div className="flex items-center gap-1">
              <Gauge className="w-3 h-3 text-slate-400" />
              <span className="text-xs text-slate-500 font-semibold">{train.duration}</span>
            </div>
          </div>

          <div className="flex-1 text-right">
            <div className="flex items-center gap-1.5 mb-1 justify-end">
              <span className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Arrival</span>
              <div className="w-2.5 h-2.5 bg-rose-500 rounded-full ring-4 ring-rose-500/20" />
            </div>
            <p className="text-2xl font-extrabold text-slate-800 tracking-tight">{train.arrivalTime}</p>
            <p className="text-sm text-slate-600 font-medium mt-0.5">{train.destination}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">
                Platform <strong className="text-slate-800">{train.platform}</strong>
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Armchair className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">
                <strong className={
                  train.seatAvailability === 'Available' ? 'text-emerald-600' :
                  train.seatAvailability === 'RAC' ? 'text-amber-600' : 'text-rose-600'
                }>{train.seatAvailability}</strong>
              </span>
            </div>
          </div>
          <button
            onClick={() => onViewRoute(train)}
            className="flex items-center gap-2 px-4 py-2 bg-railway-50 hover:bg-railway-100 text-railway-700 rounded-xl text-sm font-semibold transition-all hover:shadow-md hover:-translate-y-0.5 duration-200"
          >
            <Route className="w-4 h-4" />
            View Route
          </button>
        </div>
      </div>
    </div>
  );
}
