import React from 'react';
import { Train } from 'lucide-react';

export default function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
      <div className="relative">
        {/* Outer ring */}
        <div className="w-20 h-20 border-4 border-railway-200 rounded-full animate-spin"
             style={{ borderTopColor: '#1766f5' }} />
        {/* Train icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <Train className="w-8 h-8 text-railway-600 animate-train-move" />
        </div>
      </div>
      <p className="mt-6 text-lg font-medium text-slate-500 tracking-wide">
        Finding the best trains for you...
      </p>
      <div className="flex gap-1 mt-3">
        <span className="w-2 h-2 bg-railway-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-2 h-2 bg-railway-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
        <span className="w-2 h-2 bg-railway-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
}
