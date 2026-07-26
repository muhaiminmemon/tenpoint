import { NextResponse } from "next/server";
import { APP_NAME } from "@/lib/brand";

// Never cached: a health check that can be served from a cache tells the
// platform the process is alive long after it stopped being alive.
export const dynamic = "force-dynamic";

/**
 * Liveness probe for Railway's health check.
 *
 * Deliberately shallow — it does not touch the database. The health check
 * decides whether to restart the container and whether to route traffic to it,
 * and neither of those helps when Postgres is the thing that's down: restarting
 * the app in a loop during a database blip turns a recoverable outage into a
 * crash loop. This answers "is the server up and serving?", which is the only
 * question the platform can act on.
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    name: APP_NAME,
    time: new Date().toISOString(),
  });
}
