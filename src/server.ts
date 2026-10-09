import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { getSupabasePublishableKey, getSupabaseUrl } from "./integrations/supabase/env";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

type PublicSupabaseConfig = {
  url: string;
  publishableKey: string;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

function getEnvironmentValue(env: unknown, key: string): string | undefined {
  if (env && typeof env === "object") {
    const value = Reflect.get(env, key);
    if (typeof value === "string" && value.length > 0) return value;
  }
  const value = process.env[key];
  return value || undefined;
}

function getPublicSupabaseConfig(env: unknown): PublicSupabaseConfig | null {
  const read = (key: string) => getEnvironmentValue(env, key);
  const url = getSupabaseUrl(read);
  const publishableKey = getSupabasePublishableKey(read);
  return url && publishableKey ? { url, publishableKey } : null;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

async function injectPublicSupabaseConfig(
  response: Response,
  config: PublicSupabaseConfig | null,
): Promise<Response> {
  if (!config || !(response.headers.get("content-type") ?? "").includes("text/html")) {
    return response;
  }

  const html = await response.text();
  const headTag = /<head(?:\s[^>]*)?>/i;
  if (!headTag.test(html)) {
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    headers.delete("content-encoding");
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const configTags = [
    `<meta name="capex-supabase-url" content="${escapeHtmlAttribute(config.url)}">`,
    `<meta name="capex-supabase-publishable-key" content="${escapeHtmlAttribute(config.publishableKey)}">`,
  ].join("");
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.delete("content-encoding");
  headers.delete("etag");

  return new Response(
    html.replace(headTag, (head) => `${head}${configTags}`),
    {
      status: response.status,
      statusText: response.statusText,
      headers,
    },
  );
}

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m as { default?: ServerEntry }).default ?? (m as unknown as ServerEntry),
    );
  }
  return serverEntryPromise;
}

function brandedErrorResponse(): Response {
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isCatastrophicSsrErrorBody(body: string, responseStatus: number): boolean {
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return false;
  }

  if (!payload || Array.isArray(payload) || typeof payload !== "object") {
    return false;
  }

  const fields = payload as Record<string, unknown>;
  const expectedKeys = new Set(["message", "status", "unhandled"]);
  if (!Object.keys(fields).every((key) => expectedKeys.has(key))) {
    return false;
  }

  return (
    fields.unhandled === true &&
    fields.message === "HTTPError" &&
    (fields.status === undefined || fields.status === responseStatus)
  );
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isCatastrophicSsrErrorBody(body, response.status)) {
    return response;
  }

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return brandedErrorResponse();
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      const normalized = await normalizeCatastrophicSsrResponse(response);
      return await injectPublicSupabaseConfig(normalized, getPublicSupabaseConfig(env));
    } catch (error) {
      console.error(error);
      return brandedErrorResponse();
    }
  },
};
