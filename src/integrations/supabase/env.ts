// Resolves Supabase settings from the runtime environment.
//
// Platforms name these variables differently: Lovable Cloud uses
// SUPABASE_PUBLISHABLE_KEY, while MainDeploy injects SUPABASE_ANON_KEY for the
// Supabase instance it provisions. A stale key from another project may also be
// present, so each key is checked against SUPABASE_URL before being used.

type EnvReader = (name: string) => string | undefined;

const ANON_KEY_NAMES = ["SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEY"];
const SERVICE_ROLE_KEY_NAMES = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_KEY"];

function processEnv(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name] || undefined;
}

/** Project ref inside a legacy JWT key; null when the JWT has none; undefined when not a JWT. */
function jwtProjectRef(key: string): string | null | undefined {
  const parts = key.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    return typeof payload.ref === "string" ? payload.ref : null;
  } catch {
    return undefined;
  }
}

/** Whether the key can belong to the Supabase instance at `url`. */
function keyMatchesUrl(url: string, key: string): boolean {
  const ref = jwtProjectRef(key);
  if (ref === undefined) return true;
  const hostedRef = /^https:\/\/([a-z0-9]+)\.supabase\.co(?:\/|$)/i.exec(url)?.[1];
  // Hosted keys carry the project ref; self-hosted instances issue keys without one.
  return hostedRef ? ref === hostedRef : ref === null;
}

function pickKey(url: string | undefined, names: string[], read: EnvReader): string | undefined {
  const keys = names.map(read).filter((key): key is string => Boolean(key));
  if (!url) return keys[0];
  return keys.find((key) => keyMatchesUrl(url, key)) ?? keys[0];
}

export function getSupabaseUrl(read: EnvReader = processEnv): string | undefined {
  return read("SUPABASE_URL");
}

export function getSupabasePublishableKey(read: EnvReader = processEnv): string | undefined {
  return pickKey(getSupabaseUrl(read), ANON_KEY_NAMES, read);
}

export function getSupabaseServiceRoleKey(read: EnvReader = processEnv): string | undefined {
  return pickKey(getSupabaseUrl(read), SERVICE_ROLE_KEY_NAMES, read);
}
