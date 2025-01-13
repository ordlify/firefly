import { Hono } from "hono";
import { cors } from "hono/cors";

/**
 * Environment variables required by the application
 */
interface Env {
  BUCKET: R2Bucket; // R2 bucket for storing redirects
  AUTH_TOKEN: string; // Authentication token for protected endpoints
  FALLBACK_404: string; // URL to redirect to when slug not found
}

/**
 * Redirect data structure stored in R2
 */
interface RedirectData {
  slug: string;
  redirectTo: string;
  createdAt: number;
  meta?: Record<string, any>;
}

const app = new Hono<{ Bindings: Env }>();

// Enable CORS for all routes
app.use("/*", cors());

/**
 * Root path handler - redirects to FALLBACK_404 if configured
 */
app.get("/", (c) => {
  if (c.env.FALLBACK_404) {
    return new Response(null, {
      status: 302,
      headers: { Location: c.env.FALLBACK_404 },
    });
  }
  return c.json({ error: "Not found" }, 404);
});

/**
 * Create new redirect
 * Protected by AUTH_TOKEN
 * Generates random slug if not provided
 */
app.post("/api/create", async (c) => {
  const authHeader = c.req.header("Authorization");

  if (!authHeader || authHeader !== `Bearer ${c.env.AUTH_TOKEN}`) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json<Omit<RedirectData, "createdAt">>();

  if (!body.redirectTo) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  // Auto-generate slug if not provided
  if (!body.slug) {
    let slug;
    let attempts = 0;
    const maxAttempts = 5;

    do {
      slug = generateRandomSlug();
      const existing = await c.env.BUCKET.get(slug);
      if (!existing) {
        body.slug = slug;
        break;
      }
      attempts++;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return c.json({ error: "Could not generate unique slug" }, 500);
    }
  }

  const redirectData: RedirectData = {
    ...body,
    createdAt: Date.now(),
  };

  await c.env.BUCKET.put(body.slug, JSON.stringify(redirectData));
  return c.json({ success: true, data: redirectData });
});

/**
 * Handle redirect requests
 * Returns 302 redirect to target URL or FALLBACK_404 if not found
 */
app.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const redirectObj = await c.env.BUCKET.get(slug);

  if (!redirectObj) {
    if (c.env.FALLBACK_404) {
      return new Response(null, {
        status: 302,
        headers: { Location: `${c.env.FALLBACK_404}/${slug}` },
      });
    }
    return c.json({ error: "Not found" }, 404);
  }

  const redirectData: RedirectData = JSON.parse(await redirectObj.text());
  return new Response(null, {
    status: 302,
    headers: { Location: redirectData.redirectTo },
  });
});

/**
 * Debug endpoint - returns redirect information
 * If authenticated, returns full data including meta
 * If not authenticated, returns only basic info
 */
app.get("/:slug/debug", async (c) => {
  const slug = c.req.param("slug");
  const redirectObj = await c.env.BUCKET.get(slug);

  if (!redirectObj) {
    return c.json({ error: "Not found" }, 404);
  }

  const redirectData: RedirectData = JSON.parse(await redirectObj.text());
  const authHeader = c.req.header("Authorization");
  const isAuthenticated = authHeader === `Bearer ${c.env.AUTH_TOKEN}`;

  // Return different data based on authentication
  if (isAuthenticated) {
    // Return full data for authenticated requests
    return c.json({
      success: true,
      data: redirectData,
    });
  }

  // Return limited data for public requests
  return c.json({
    success: true,
    data: {
      slug: redirectData.slug,
      redirectTo: redirectData.redirectTo,
      createdAt: redirectData.createdAt,
    },
  });
});

/**
 * Generate a random slug of specified length
 * @param length Length of the slug (default: 4)
 * @returns Random string of lowercase letters and numbers
 */
function generateRandomSlug(length: number = 4): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
}

export default app;
