"use client";

import { useRouter } from "next/navigation";

export function EmptyState() {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-20 h-20 rounded-2xl bg-[#111827] flex items-center justify-center mb-6">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#F43F5E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <polygon points="10 8 16 12 10 16 10 8" fill="#F43F5E" stroke="none" />
        </svg>
      </div>
      <h2 className="text-2xl font-[550] text-[#171717] mb-2">No projects yet</h2>
      <p className="text-[#6B7280] text-base mb-8 max-w-xs">
        Upload a video to get started. Your projects will appear here.
      </p>
      <button
        onClick={() => router.push("/")}
        className="bg-[#F43F5E] hover:bg-[#E11D48] text-white font-semibold text-base px-7 py-3 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
      >
        Start a new project
      </button>
    </div>
  );
}
