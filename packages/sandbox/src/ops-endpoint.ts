import type { Express, Request, Response } from 'express';
import {
  addTrackTool,
  updateTrackTool,
  removeTrackTool,
  addItemTool,
  updateItemTool,
  removeItemTool,
  splitItemTool,
  updateCaptionPresetTool,
  generateCaptionsTool,
} from './tools/manifest-ops.js';

const toolMap: Record<string, { execute: (input: any) => Promise<string> }> = {
  addTrack: addTrackTool,
  updateTrack: updateTrackTool,
  removeTrack: removeTrackTool,
  addItem: addItemTool,
  updateItem: updateItemTool,
  removeItem: removeItemTool,
  splitItem: splitItemTool,
  updateCaptionPreset: updateCaptionPresetTool,
  updateCaptionStyle: updateCaptionPresetTool, // deprecated alias
  generateCaptions: generateCaptionsTool,
};

export function mountOpsEndpoint(app: Express): void {
  app.post('/ops', async (req: Request, res: Response) => {
    const { tool, input } = req.body;

    if (!tool || typeof tool !== 'string') {
      res.status(400).json({ ok: false, error: 'tool is required' });
      return;
    }

    const t = toolMap[tool];
    if (!t) {
      res.status(400).json({ ok: false, error: `Unknown tool: ${tool}` });
      return;
    }

    const resultStr = await t.execute(input ?? {});

    try {
      const parsed = JSON.parse(resultStr);
      res.json({ ok: true, result: parsed });
    } catch {
      res.status(400).json({ ok: false, error: resultStr });
    }
  });
}
