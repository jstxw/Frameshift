import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "@/lib/auth0";
import { supabaseAdmin } from "@/lib/supabase";
import {
  objectExists,
  originalPath,
} from "@/lib/project-storage";

const PROJECT_ID = /^[a-f0-9]{32}$/;

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Supabase Storage is not configured" }, { status: 503 });
  }
  const { projectId } = await params;
  if (!PROJECT_ID.test(projectId)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  const session = await auth0.getSession();
  const { data: project, error: projectError } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 });
  if (project && (!session || project.user_id !== session.user.sub)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const storedOriginal = project?.original_path || originalPath(projectId);
  if (!(await objectExists(storedOriginal))) {
    return NextResponse.json({ error: "Uploaded video was not found" }, { status: 409 });
  }

  if (project) {
    const { error } = await supabaseAdmin
      .from("projects")
      .update({
        original_path: storedOriginal,
        storage_status: "stored",
        status: "stored",
      })
      .eq("project_id", projectId)
      .eq("user_id", project.user_id);
    if (error?.code === "PGRST204") {
      await supabaseAdmin
        .from("projects")
        .update({ status: "stored" })
        .eq("project_id", projectId)
        .eq("user_id", project.user_id);
    }
  }

  return NextResponse.json({
    project_id: projectId,
    stored: true,
    // The editor's resume request hydrates the disposable GPU cache. Keeping
    // that cold-start work out of upload completion lets the browser navigate
    // as soon as durable storage has confirmed the file.
    compute_available: false,
    compute_pending: true,
    compute_error: null,
  });
}
