"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Project } from "@/lib/supabase";
import { ProjectCard } from "./ProjectCard";
import { EmptyState } from "./EmptyState";

export function DashboardGrid({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const router = useRouter();

  function handleDelete(projectId: string) {
    setProjects((p) => p.filter((proj) => proj.project_id !== projectId));
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-[550] text-[#171717]">Your Projects</h1>
        <button
          onClick={() => router.push("/")}
          className="bg-[#F43F5E] hover:bg-[#E11D48] text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] flex items-center gap-2"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Project
        </button>
      </div>

      {projects.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {projects.map((project) => (
            <ProjectCard key={project.project_id} project={project} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
