import { getChatGPTUser } from "@/app/chatgpt-auth";
import {
  CATALOG_TEMPLATE_ID,
  applyCatalogMutation,
  catalogMutationSchema,
  catalogStateSchema,
  catalogSummary,
  createStarterCatalog,
  type CatalogState,
} from "@/lib/catalog-manager";
import { database } from "@/lib/storage";
import { isStudioAdmin } from "@/lib/studio-access";
import { ownerTeams } from "@/lib/team-storage";
import { z } from "zod";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function loadCatalog(owner: string): Promise<{ catalog: CatalogState; starterCreated: boolean }> {
  const db = database();
  const row = await db
    .prepare("SELECT config FROM templates WHERE owner=? AND id=?")
    .bind(owner, CATALOG_TEMPLATE_ID)
    .first<{ config: string }>();
  if (row) return { catalog: catalogStateSchema.parse(JSON.parse(row.config)), starterCreated: false };

  const catalog = createStarterCatalog();
  await db
    .prepare("INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?)")
    .bind(owner, CATALOG_TEMPLATE_ID, JSON.stringify(catalog), catalog.updatedAt)
    .run();
  return { catalog, starterCreated: true };
}

async function saveCatalog(owner: string, catalog: CatalogState) {
  await database()
    .prepare(
      "INSERT INTO templates(owner,id,config,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner,id) DO UPDATE SET config=excluded.config,updated_at=excluded.updated_at",
    )
    .bind(owner, CATALOG_TEMPLATE_ID, JSON.stringify(catalog), catalog.updatedAt)
    .run();
}

async function adminUser() {
  const user = await getChatGPTUser();
  if (!user) return { error: json({ error: "Please sign in to manage the ForgeLinc catalog." }, 401) } as const;
  if (!isStudioAdmin(user)) return { error: json({ error: "Catalog management is reserved for the ForgeLinc administrator." }, 403) } as const;
  return { user } as const;
}

export async function GET() {
  const auth = await adminUser();
  if ("error" in auth) return auth.error;
  try {
    const [{ catalog, starterCreated }, teams] = await Promise.all([loadCatalog(auth.user.userId), ownerTeams(auth.user.userId)]);
    return json({
      catalog,
      summary: catalogSummary(catalog),
      starterCreated,
      teams: teams.map(({ id, name, kind }) => ({ id, name, kind: kind ?? "team" })),
    });
  } catch (error) {
    console.error("catalog load failed", error);
    return json({ error: "We couldn't load the product catalog. Please retry." }, 503);
  }
}

export async function POST(request: Request) {
  const auth = await adminUser();
  if ("error" in auth) return auth.error;
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);

  const text = await request.text();
  if (text.length > 750_000) return json({ error: "Catalog request is too large." }, 413);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json({ error: "Invalid catalog request." }, 400);
  }

  const parsed = catalogMutationSchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Check the highlighted catalog fields and try again.", details: parsed.error.flatten() }, 400);

  try {
    const [{ catalog }, teams] = await Promise.all([loadCatalog(auth.user.userId), ownerTeams(auth.user.userId)]);
    if (parsed.data.expectedRevision !== catalog.revision) {
      return json(
        {
          error: "The catalog changed in another tab. Your latest saved catalog has been reloaded.",
          catalog,
          summary: catalogSummary(catalog),
        },
        409,
      );
    }
    const result = applyCatalogMutation(catalog, parsed.data, new Set(teams.map((team) => team.id)));
    await saveCatalog(auth.user.userId, result.state);
    return json({
      saved: true,
      catalog: result.state,
      summary: catalogSummary(result.state),
      selectedId: result.selectedId,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("catalog validation failed", error.issues);
      return json({ error: "The saved catalog data did not pass validation. No changes were written." }, 409);
    }
    const message = error instanceof Error ? error.message : "We couldn't save that catalog change.";
    const clientError =
      message.includes("Choose") ||
      message.includes("That ") ||
      message.includes("Move or delete") ||
      message.includes("Finish") ||
      message.includes("Set ") ||
      message.includes("Add ") ||
      message.includes("Reduce") ||
      message.includes("Starter") ||
      message.includes("This setup") ||
      message.includes("This collection") ||
      message.includes("The destination");
    if (!clientError) console.error("catalog save failed", error);
    return json({ error: message }, clientError ? 400 : 503);
  }
}
