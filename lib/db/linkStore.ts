// LinkStore backed by the service-role client: the /r/<code> route is public
// (no session), so it reads drafts and writes clicks without RLS.
import type { LinkStore } from "@/lib/links";
import type { ServiceSupabase } from "./scoutStore";

export function createLinkStore(supabase: ServiceSupabase): LinkStore {
  return {
    async findByCode(code) {
      const { data, error } = await supabase
        .from("drafts")
        .select("id, project_id, venue_id, utm_url")
        .eq("short_code", code)
        .maybeSingle();
      if (error) throw new Error(`findByCode failed (code ${code}): ${error.message}`);
      if (!data?.utm_url) return null;
      return { draftId: data.id, projectId: data.project_id, venueId: data.venue_id, utmUrl: data.utm_url };
    },
    async insertClick(click) {
      const { error } = await supabase.from("clicks").insert(click);
      if (error) throw new Error(`insertClick failed (draft ${click.draft_id}): ${error.message}`);
    },
  };
}
