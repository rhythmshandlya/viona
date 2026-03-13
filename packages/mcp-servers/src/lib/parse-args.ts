/**
 * Parse --workspace argument from process.argv.
 * Falls back to process.cwd() if not provided.
 */
export function parseWorkspace(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--workspace");
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : process.cwd();
}
