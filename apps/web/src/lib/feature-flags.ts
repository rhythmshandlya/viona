/**
 * Returns true when the new asset system (PR-A1/A2/B) should be active in the UI.
 * Reads NEXT_PUBLIC_ASSET_SYSTEM_V2 at runtime. Next.js inlines NEXT_PUBLIC_* at build time.
 */
export function isAssetSystemV2(): boolean {
  return process.env.NEXT_PUBLIC_ASSET_SYSTEM_V2 === 'true';
}
