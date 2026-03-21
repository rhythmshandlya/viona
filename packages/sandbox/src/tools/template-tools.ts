import * as Minio from 'minio';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';
const API_CALLBACK_URL = process.env.API_CALLBACK_URL;

function getMinioClient(): Minio.Client {
  return new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY || '',
    secretKey: process.env.MINIO_SECRET_KEY || '',
  });
}

const TEMPLATES_BUCKET = process.env.MINIO_BUCKET || 'viona';

// -- browse_templates ----------------------------------------------------------

export const browseTemplatesTool = {
  name: 'browse_templates',
  description:
    'Browse the template registry. Returns metadata, prop schemas, and theme context. ' +
    'Use to discover available templates before building from scratch.',
  input_schema: {
    type: 'object' as const,
    properties: {
      theme: { type: 'string', description: 'Filter by theme slug' },
      type: { type: 'string', enum: ['scene', 'element'], description: 'Filter by template type' },
      category: { type: 'string', description: 'Filter by category' },
      search: { type: 'string', description: 'Fuzzy search name/description/tags' },
    },
  },
  execute: async (input: {
    theme?: string;
    type?: string;
    category?: string;
    search?: string;
  }): Promise<string> => {
    if (!API_CALLBACK_URL) {
      return JSON.stringify({ error: 'API_CALLBACK_URL not configured, template registry unavailable' });
    }

    const params = new URLSearchParams();
    if (input.theme) params.set('theme', input.theme);
    if (input.type) params.set('type', input.type);
    if (input.category) params.set('category', input.category);
    if (input.search) params.set('search', input.search);
    if (input.theme) params.set('includeThemeContext', 'true');
    params.set('limit', '50');

    try {
      const url = `${API_CALLBACK_URL}/templates?${params.toString()}`;
      const res = await fetch(url);
      if (!res.ok) {
        return JSON.stringify({ error: `API returned ${res.status}: ${await res.text()}` });
      }
      const data = await res.json();
      return JSON.stringify(data, null, 2);
    } catch (err: any) {
      return JSON.stringify({
        error: `Template registry unavailable: ${err.message}. Proceed without templates.`,
      });
    }
  },
};

// -- fork_template -------------------------------------------------------------

export const forkTemplateTool = {
  name: 'fork_template',
  description:
    'Fork a template into the workspace. Copies source files from S3 so you can read, ' +
    'modify, and use the code. The forked code is yours — adapt it freely.',
  input_schema: {
    type: 'object' as const,
    properties: {
      slug: { type: 'string', description: 'Template slug to fork' },
      targetDir: {
        type: 'string',
        description: 'Where to copy files (default: src/components/templates/{slug}/)',
      },
    },
    required: ['slug'],
  },
  execute: async (input: { slug: string; targetDir?: string }): Promise<string> => {
    const { slug } = input;

    // 1. Get template metadata from API
    if (!API_CALLBACK_URL) {
      return JSON.stringify({ error: 'API_CALLBACK_URL not configured' });
    }

    let templateData: any;
    try {
      const res = await fetch(`${API_CALLBACK_URL}/templates/${slug}`);
      if (!res.ok) {
        if (res.status === 404) {
          return JSON.stringify({ error: `Template "${slug}" not found in registry.` });
        }
        return JSON.stringify({ error: `API returned ${res.status}` });
      }
      templateData = await res.json();
    } catch (err: any) {
      return JSON.stringify({ error: `Failed to fetch template metadata: ${err.message}` });
    }

    const sourceKey = templateData.sourceKey;
    if (!sourceKey) {
      return JSON.stringify({ error: `Template "${slug}" has no source files in S3.` });
    }

    // 2. Download source files from S3
    const targetDir = input.targetDir || `src/components/templates/${slug}`;
    const targetPath = join(WORKSPACE, targetDir);
    mkdirSync(targetPath, { recursive: true });

    const minio = getMinioClient();
    const prefix = `templates/${sourceKey}`;
    const files: Array<{ path: string; description: string }> = [];
    let entryPoint = '';

    try {
      const objects: Minio.BucketItem[] = [];
      const stream = minio.listObjects(TEMPLATES_BUCKET, prefix, true);
      for await (const obj of stream) {
        if (obj.name) objects.push(obj);
      }

      if (objects.length === 0) {
        return JSON.stringify({ error: `No source files found at S3 prefix "${prefix}".` });
      }

      for (const obj of objects) {
        // Strip the prefix to get relative path
        const relativePath = obj.name!.replace(prefix, '');
        if (!relativePath || relativePath === '/') continue;

        const localPath = join(targetPath, relativePath);
        mkdirSync(dirname(localPath), { recursive: true });

        // Download file
        const dataStream = await minio.getObject(TEMPLATES_BUCKET, obj.name!);
        const chunks: Buffer[] = [];
        for await (const chunk of dataStream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        const rawBuffer = Buffer.concat(chunks);

        // Check if file is a text file (skip binary assets like images)
        const textExts = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.svg'];
        const isTextFile = textExts.some(ext => relativePath.endsWith(ext));

        if (isTextFile) {
          const content = rawBuffer.toString('utf-8');
          // Rewrite ../../ imports to local paths
          const rewritten = content
            .replace(/from\s+['"]\.\.\/\.\.\/([^'"]+)['"]/g, `from './$1'`)
            .replace(/import\s+['"]\.\.\/\.\.\/([^'"]+)['"]/g, `import './$1'`);
          writeFileSync(localPath, rewritten, 'utf-8');
        } else {
          // Write binary files as-is
          writeFileSync(localPath, rawBuffer);
        }

        const desc = relativePath.endsWith('index.tsx')
          ? 'Main component (entry point)'
          : relativePath.endsWith('schema.ts')
            ? 'Props schema (Zod)'
            : relativePath.endsWith('meta.json')
              ? 'Template metadata'
              : relativePath.endsWith('constants.ts')
                ? 'Style constants'
                : 'Component file';

        if (relativePath.endsWith('index.tsx') || relativePath.endsWith('index.ts')) {
          entryPoint = `${targetDir}${relativePath}`;
        }

        files.push({
          path: `${targetDir}${relativePath}`,
          description: desc,
        });
      }
    } catch (err: any) {
      return JSON.stringify({
        error: `Failed to download source files from S3: ${err.message}. Build from scratch instead.`,
      });
    }

    return JSON.stringify({
      files,
      entryPoint: entryPoint || files[0]?.path || '',
      propsSchema: templateData.propsSchema || {},
      message: `Forked "${slug}" to ${targetDir}/. Read the files and modify as needed.`,
    }, null, 2);
  },
};

export const allTemplateTools = [browseTemplatesTool, forkTemplateTool];
export const templateBrowseTools = [browseTemplatesTool];
