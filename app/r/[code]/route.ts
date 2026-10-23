import { NextResponse, type NextRequest } from "next/server";
import { createLinkStore } from "@/lib/db/linkStore";
import { createServiceSupabase } from "@/lib/db/service";
import { resolveShortLink } from "@/lib/links";

export async function GET(request: NextRequest, { params }: RouteContext<"/r/[code]">) {
  const { code } = await params;
  const result = await resolveShortLink(
    createLinkStore(createServiceSupabase()),
    code,
    request.headers.get("referer"),
    (err) => console.error("[links] click not recorded", { code, err }),
  );
  if (result.kind === "not_found") return new NextResponse("Link not found.", { status: 404 });
  return NextResponse.redirect(result.url, 302);
}
