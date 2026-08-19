"use client";

export default function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      {/* Stats skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900/50 border border-white/5 rounded-2xl p-4 animate-pulse"
          >
            <div className="h-3 w-16 bg-gray-800 rounded mb-2" />
            <div className="h-6 w-20 bg-gray-800 rounded" />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="bg-gray-900/50 border border-white/5 rounded-2xl p-4 animate-pulse">
        <div className="h-10 bg-gray-800 rounded-xl mb-3" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-8 w-20 bg-gray-800 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Card grid skeleton */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-900/50 border border-white/5 rounded-2xl overflow-hidden animate-pulse"
          >
            <div className="aspect-[3/4] bg-gray-800" />
            <div className="p-3">
              <div className="h-4 w-3/4 bg-gray-800 rounded mb-2" />
              <div className="h-3 w-1/2 bg-gray-800 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
