// pnpm seed [email]
// Upserts the GlamVault test project for an existing Scout user (sign up in the
// app first). Email comes from the CLI arg or SEED_USER_EMAIL. Idempotent.
import { projectInputSchema, type ProjectInput } from "@/lib/db/projectInput";
import { createServiceSupabase } from "@/lib/db/service";

const USERS_PAGE_SIZE = 200;

const GLAMVAULT: ProjectInput = projectInputSchema.parse({
  name: "GlamVault",
  url: "https://try-glamvault.vercel.app/",
  description:
    "Personal beauty collection manager. Remembers every product you own (brand, shade, where you bought it) so you can check in seconds while shopping and never buy duplicates. Scan a product to add it; collections and wishlist.",
  audience:
    "beauty enthusiasts with growing makeup and skincare collections; shade hunters; people trying to buy less",
  problems: "buying duplicate shades, forgetting what you own, products expiring unused",
  keywords_en: [
    "makeup collection",
    "duplicate lipstick",
    "makeup inventory app",
    "no-buy",
    "low-buy",
    "project pan",
    "shade matching",
  ],
  keywords_es: ["colección de maquillaje", "compré el mismo labial", "app inventario maquillaje"],
  tone: "friendly, honest, a fellow collector; never salesy",
  region: "",
});

type Supabase = ReturnType<typeof createServiceSupabase>;

async function findUserId(supabase: Supabase, email: string): Promise<string> {
  const target = email.toLowerCase();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: USERS_PAGE_SIZE });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const user = data.users.find((u) => u.email?.toLowerCase() === target);
    if (user) return user.id;
    if (data.users.length < USERS_PAGE_SIZE) break;
  }
  throw new Error(`No Scout user with email ${email}. Sign up in the app first.`);
}

async function main() {
  const email = process.argv[2] ?? process.env.SEED_USER_EMAIL;
  if (!email) throw new Error("Pass an email (pnpm seed you@example.com) or set SEED_USER_EMAIL.");

  const supabase = createServiceSupabase();
  const userId = await findUserId(supabase, email);

  const { data: existing, error: findError } = await supabase
    .from("projects")
    .select("id")
    .eq("user_id", userId)
    .eq("name", GLAMVAULT.name)
    .maybeSingle();
  if (findError) throw new Error(`Lookup failed: ${findError.message}`);

  if (existing) {
    const { error } = await supabase.from("projects").update(GLAMVAULT).eq("id", existing.id);
    if (error) throw new Error(`Update failed (project ${existing.id}): ${error.message}`);
    console.log(`Updated GlamVault (${existing.id}) for ${email}`);
  } else {
    const { data, error } = await supabase
      .from("projects")
      .insert({ ...GLAMVAULT, user_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(`Insert failed: ${error.message}`);
    console.log(`Created GlamVault (${data.id}) for ${email}`);
  }
}

main().catch((err: unknown) => {
  console.error("[seed]", err instanceof Error ? err.message : err);
  process.exit(1);
});
