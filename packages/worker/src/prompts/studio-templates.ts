import { listTemplates } from '@viona/templates';

export function buildStudioTemplateCatalog(): string {
  const templates = listTemplates({ theme: 'studio' });

  const catalog = templates.map(t =>
    `- **${t.meta.name}** (\`${t.meta.slug}\`): ${t.meta.description} | Tags: ${t.meta.tags.join(', ')}`
  ).join('\n');

  return `
## TEMPLATE LIBRARY (Studio Theme)

You have access to ${templates.length} pre-built templates. For each template, you can retrieve its full source code and copy it into the workspace as a starting point.

**Available templates:**
${catalog}

**How to use templates:**
1. Choose a template that matches the scene's purpose
2. Read its source files from src/.templates/{slug}/
3. Copy the code into the workspace and customize (change data, colors, timing)
4. Templates are 1080x1080 @ 30fps — adapt frame calculations for the video's fps/dimensions
5. Multiple templates can be composed into a single scene (e.g., stat-counter for one section, bar-chart for another)

**When NO template fits:** Create custom visuals but maintain the Studio theme:
- Always include DotGrid SVG background
- Use BACKGROUNDS dark/light color tokens
- Use FONT_PAIRS for typography
- Follow the card-based layout pattern
`;
}
