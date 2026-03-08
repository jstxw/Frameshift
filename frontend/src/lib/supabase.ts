import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type Project = {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  thumbnail_url: string | null;
  status: string;
  last_frame: number;
  created_at: string;
  updated_at: string;
};
