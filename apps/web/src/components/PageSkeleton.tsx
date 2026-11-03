import React from 'react';

interface PageSkeletonProps {
  title?: string;
}

export const PageSkeleton: React.FC<PageSkeletonProps> = ({ title = 'Loading...' }) => {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="h-7 w-56 bg-[#F1F5F9] rounded-xl" />
          <div className="h-4 w-72 bg-[#F5F2F0] rounded-lg mt-2" />
        </div>
        <div className="h-10 w-36 bg-[#F1F5F9] rounded-xl self-start" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-[#E2E8F0]/60 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 bg-[#F5F2F0] rounded" />
              <div className="w-8 h-8 rounded-xl bg-[#F1F5F9]" />
            </div>
            <div className="h-7 w-14 bg-[#F1F5F9] rounded-lg" />
          </div>
        ))}
      </div>

      {/* Main Table / Content Skeleton */}
      <div className="bg-white border border-[#E2E8F0]/60 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-[#F1F5F9]">
          <div className="h-9 w-64 bg-[#F5F2F0] rounded-xl" />
          <div className="h-8 w-24 bg-[#F5F2F0] rounded-lg" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div key={row} className="flex items-center gap-4 py-2 border-b border-[#FAF8F5]">
              <div className="w-9 h-9 rounded-full bg-[#F1F5F9]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-44 bg-[#F1F5F9] rounded" />
                <div className="h-3 w-32 bg-[#F5F2F0] rounded" />
              </div>
              <div className="h-4 w-24 bg-[#F5F2F0] rounded" />
              <div className="h-6 w-16 bg-[#F1F5F9] rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

