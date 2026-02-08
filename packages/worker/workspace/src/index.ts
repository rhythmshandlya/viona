/**
 * Remotion entry file.
 *
 * Usage:
 *   npx remotion render src/index.ts <composition-id> out/video.mp4
 *   npx remotion bundle src/index.ts --out-dir=out
 */

import { registerRoot } from "remotion";
import { RemotionRoot } from "./Root";

registerRoot(RemotionRoot);
