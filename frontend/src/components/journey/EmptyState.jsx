import React from 'react';
import { SearchX, ArrowRight } from 'lucide-react';

export default function EmptyState({ hasSearched }) {
  if (!hasSearched) {
    return (
      <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="w-24 h-24 bg-gradient-to-br from-railway-100 to-railway-200 rounded-full flex items-center justify-center mb-6">
          <ArrowRight className="w-10 h-10 text-railway-500" />
        </div>
        <h3 className="text-xl font-semibold text-slate-700 mb-2">
          Plan Your Journey
        </h3>
        <p className="text-slate-500 text-center max-w-md leading-relaxed">
          Enter your source and destination stations above to discover available trains, timings, and route details.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 animate-fade-in">
      <div className="w-24 h-24 bg-gradient-to-br from-rose-100 to-orange-100 rounded-full flex items-center justify-center mb-6">
        <SearchX className="w-10 h-10 text-rose-400" />
      </div>
      <h3 className="text-xl font-semibold text-slate-700 mb-2">
        No Trains Found
      </h3>
      <p className="text-slate-500 text-center max-w-md leading-relaxed">
        We couldn't find any trains for this route. Try different stations or check the spelling.
      </p>
      <div className="mt-6 flex flex-wrap gap-2 justify-center">
        {['Delhi → Mumbai', 'Mumbai → Pune', 'Delhi → Varanasi'].map((suggestion) => (
          <span
            key={suggestion}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-full text-sm font-medium hover:bg-railway-100 hover:text-railway-700 transition-colors cursor-pointer"
          >
            Try: {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}
