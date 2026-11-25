import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let envLoaded = false;

/**
 * Loads .env.local (or .env.local.txt fallback) into process.env when running
 * standalone CLI scripts outside Next.js runtime.
 */
export function ensureEnvLoaded(): void {
  if (envLoaded) return;
  envLoaded = true;

  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }

  const candidates = ['.env.local', '.env.local.txt', '.env'];
  for (const filename of candidates) {
    const filePath = path.join(/*turbopackIgnore: true*/ process.cwd(), filename);
    if (!fs.existsSync(/*turbopackIgnore: true*/ filePath)) continue;
    const raw = fs.readFileSync(/*turbopackIgnore: true*/ filePath, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
    break;
  }
}

export function normalizeSupabaseUrl(rawUrl: string): string {
  return rawUrl
    .trim()
    .replace(/\/rest\/v1\/?$/i, '')
    .replace(/\/+$/, '');
}

let adminClient: SupabaseClient | null = null;
let anonClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  ensureEnvLoaded();
  if (adminClient) return adminClient;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!rawUrl || !serviceKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  }

  adminClient = createClient(normalizeSupabaseUrl(rawUrl), serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return adminClient;
}

export function getSupabaseClient(): SupabaseClient {
  ensureEnvLoaded();
  if (anonClient) return anonClient;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!rawUrl || !anonKey) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in environment.');
  }

  anonClient = createClient(normalizeSupabaseUrl(rawUrl), anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return anonClient;
}
