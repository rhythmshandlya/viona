import * as Minio from 'minio';
import { writeFileSync, readFileSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join, dirname } from 'path';

const WORKSPACE = process.env.WORKSPACE_DIR || '/workspace';

// Track templates forked in this session to prevent duplicate work and infinite recursion.
// NOTE: This Set persists for the lifetime of the process. In the current architecture
// (one container per session), this is correct. If the process is ever reused across
// sessions, call forkedSlugs.clear() at session init.
const forkedSlugs = new Set<string>();

// Shared modules extracted to src/theme/ (one canonical copy, not per-fork)
// Theme libraries: magazine/, blackboard/
// Shared utilities: fonts.ts, use-scale.ts, lib/ (map utilities etc.)
const SHARED_LIB_DIRS = ['magazine', 'blackboard'];
const SHARED_ROOT_FILES = ['fonts', 'use-scale'];

function isSharedLibFile(relativePath: string): boolean {
  return SHARED_LIB_DIRS.some(d => relativePath.startsWith(`${d}/`))
    || SHARED_ROOT_FILES.some(f => relativePath === `${f}.ts`);
}

function isSharedLibImport(importPath: string): boolean {
  return SHARED_LIB_DIRS.some(d => importPath.startsWith(`${d}/`) || importPath === d)
    || SHARED_ROOT_FILES.some(f => importPath === f || importPath === `${f}.ts`);
}

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
  execute: async (input: { slug: string; targetDir?: string; _depth?: number }): Promise<string> => {
    const { slug } = input;
    const log = (msg: string) => console.log(`[fork_template:${slug}] ${msg}`);

    // Depth limit to prevent deeply nested cross-template chains (max 3 levels)
    const depth = input._depth ?? 0;
    if (depth > 3) {
      log(`Skipping — max fork depth (3) reached`);
      return JSON.stringify({ error: `Max fork depth reached for "${slug}". Fork manually if needed.` });
    }

    // Skip if already forked in this session (prevents duplicates + infinite recursion)
    const targetDir = input.targetDir || `src/components/templates/${slug}`;
    const targetPath = join(WORKSPACE, targetDir);
    if (forkedSlugs.has(slug)) {
      log(`Already forked in this session, skipping`);
      return JSON.stringify({ message: `Template "${slug}" already forked to ${targetDir}/.`, skipped: true });
    }
    if (existsSync(join(targetPath, 'index.tsx')) || existsSync(join(targetPath, 'index.ts'))) {
      log(`Already exists on disk at ${targetDir}/, skipping`);
      forkedSlugs.add(slug);
      return JSON.stringify({ message: `Template "${slug}" already exists at ${targetDir}/.`, skipped: true });
    }

    // 1. Get template metadata from API
    if (!API_CALLBACK_URL) {
      log('ERROR: API_CALLBACK_URL not configured');
      return JSON.stringify({ error: 'API_CALLBACK_URL not configured' });
    }

    let templateData: any;
    try {
      const url = `${API_CALLBACK_URL}/templates/${slug}`;
      log(`Fetching metadata from ${url}`);
      const res = await fetch(url);
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        log(`ERROR: API returned ${res.status}: ${body}`);
        if (res.status === 404) {
          return JSON.stringify({ error: `Template "${slug}" not found in registry.` });
        }
        return JSON.stringify({ error: `API returned ${res.status}: ${body}` });
      }
      templateData = await res.json();
    } catch (err: any) {
      log(`ERROR: Failed to fetch metadata: ${err.message}`);
      return JSON.stringify({ error: `Failed to fetch template metadata: ${err.message}` });
    }

    const sourceKey = templateData.sourceKey;
    if (!sourceKey) {
      log(`ERROR: sourceKey is null/empty in API response`);
      return JSON.stringify({ error: `Template "${slug}" has no source files in S3.` });
    }
    log(`sourceKey: ${sourceKey}`);

    // 2. List source files from S3 BEFORE creating any directories
    const minio = getMinioClient();
    const prefix = `templates/${sourceKey}`;
    const files: Array<{ path: string; description: string }> = [];
    let entryPoint = '';

    try {
      const objects: Minio.BucketItem[] = [];
      log(`Listing objects at bucket=${TEMPLATES_BUCKET} prefix=${prefix}`);
      const stream = minio.listObjects(TEMPLATES_BUCKET, prefix, true);
      for await (const obj of stream) {
        if (obj.name) objects.push(obj);
      }

      if (objects.length === 0) {
        log(`ERROR: No source files found at prefix "${prefix}" in bucket "${TEMPLATES_BUCKET}"`);
        return JSON.stringify({
          error: `No source files found at S3 prefix "${prefix}" in bucket "${TEMPLATES_BUCKET}". ` +
                 `Ensure templates:upload has been run and files are in the correct bucket.`,
        });
      }

      log(`Found ${objects.length} objects, downloading to ${targetDir}/`);

      // Only create target directory AFTER confirming files exist
      mkdirSync(targetPath, { recursive: true });

      for (const obj of objects) {
        // Strip the prefix to get relative path (remove leading slash)
        const relativePath = obj.name!.replace(prefix, '').replace(/^\//, '');
        if (!relativePath) continue;

        // Skip register.ts — it's part of the template package's build system
        // and imports ./registry + ./types which don't exist in the sandbox workspace
        if (relativePath === 'register.ts') continue;

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

        // Redirect shared library files to src/theme/ (single canonical copy)
        // instead of bundling them into each fork directory
        if (isSharedLibFile(relativePath)) {
          const themePath = join(WORKSPACE, 'src', 'theme', relativePath);
          if (!existsSync(themePath)) {
            mkdirSync(dirname(themePath), { recursive: true });
            writeFileSync(themePath, isTextFile ? rawBuffer.toString('utf-8') : rawBuffer);
          }
          continue;
        }

        const localPath = join(targetPath, relativePath);
        mkdirSync(dirname(localPath), { recursive: true });

        if (isTextFile) {
          const content = rawBuffer.toString('utf-8');
          // Rewrite deep relative imports:
          // - Shared lib imports (magazine/, blackboard/, fonts) → point to src/theme/
          // - Other ../../+ imports → relative to fork root (cross-template deps)
          const fileDepth = relativePath.split('/').length - 1;
          const prefixForDepth = fileDepth === 0 ? './' : '../'.repeat(fileDepth);

          // Path from this file to src/theme/: go up to src/, then into theme/
          const targetParts = targetDir.split('/');
          const srcIdx = targetParts.indexOf('src');
          const levelsToSrc = (srcIdx >= 0 ? targetParts.length - srcIdx - 1 : 3) + fileDepth;
          const themePrefix = '../'.repeat(levelsToSrc) + 'theme/';

          const rewritten = content
            .replace(/from\s+['"](?:\.\.\/){2,}([^'"]+)['"]/g, (_match, importPath) => {
              if (isSharedLibImport(importPath)) {
                return `from '${themePrefix}${importPath}'`;
              }
              return `from '${prefixForDepth}${importPath}'`;
            })
            .replace(/import\s+['"](?:\.\.\/){2,}([^'"]+)['"]/g, (_match, importPath) => {
              if (isSharedLibImport(importPath)) {
                return `import '${themePrefix}${importPath}'`;
              }
              return `import '${prefixForDepth}${importPath}'`;
            });
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
          entryPoint = `${targetDir}/${relativePath}`;
        }

        files.push({
          path: `${targetDir}/${relativePath}`,
          description: desc,
        });
      }

      log(`Successfully forked ${files.length} files to ${targetDir}/`);
      forkedSlugs.add(slug);

      // -- File completeness verification --
      const hasEntry = files.some(f =>
        f.path.endsWith('/index.tsx') || f.path.endsWith('/index.ts') ||
        f.path === `${targetDir}/index.tsx` || f.path === `${targetDir}/index.ts`
      );
      if (!hasEntry) {
        log(`WARNING: No index.tsx/index.ts found in forked template — template may not be usable as entry point`);
      }

      // -- Cross-template dependency resolution --
      // Scan text files for imports referencing sibling template directories (../other-slug/)
      const crossTemplateDeps = new Set<string>();
      const textExtsForScan = ['.ts', '.tsx', '.js', '.jsx'];
      for (const file of files) {
        if (!textExtsForScan.some(ext => file.path.endsWith(ext))) continue;
        try {
          const filePath = join(WORKSPACE, file.path);
          const content = readFileSync(filePath, 'utf-8');
          // Match: from '../some-slug/...' or import '../some-slug/...'
          const importMatches = content.matchAll(/(?:from|import)\s+['"]\.\.\/([a-z][\w-]*)\//g);
          for (const match of importMatches) {
            const depSlug = match[1];
            // Ignore self-references and common non-template directories
            const NON_TEMPLATE_DIRS = ['magazine', 'blackboard', 'theme', 'fonts', 'use-scale', 'node_modules', 'components', 'constants', 'scenes', 'utils', 'shared', 'lib', 'styles', 'assets'];
            if (depSlug === slug || NON_TEMPLATE_DIRS.includes(depSlug)) continue;
            crossTemplateDeps.add(depSlug);
          }
        } catch {
          // Skip files that can't be read
        }
      }

      if (crossTemplateDeps.size > 0) {
        log(`Detected cross-template dependencies: ${[...crossTemplateDeps].join(', ')}`);
        for (const depSlug of crossTemplateDeps) {
          if (forkedSlugs.has(depSlug)) {
            log(`Dependency "${depSlug}" already forked, skipping`);
            continue;
          }
          log(`Auto-forking dependency: ${depSlug}`);
          try {
            await forkTemplateTool.execute({ slug: depSlug, _depth: depth + 1 });
          } catch (depErr: any) {
            log(`WARNING: Failed to auto-fork dependency "${depSlug}": ${depErr.message}`);
          }
        }
      }

    } catch (err: any) {
      log(`ERROR: S3 download failed: ${err.message}`);
      // Clean up empty directory on failure
      try { rmSync(targetPath, { recursive: true, force: true }); } catch {}
      return JSON.stringify({
        error: `Failed to download source files from S3: ${err.message}. Build from scratch instead.`,
      });
    }

    // 3. Install external dependencies if declared
    const deps: Record<string, string> | null = templateData.dependencies;
    if (deps && Object.keys(deps).length > 0) {
      const { execSync } = await import('child_process');
      const pkgs = Object.entries(deps).map(([name, version]) => `${name}@${version}`);
      log(`Installing dependencies: ${pkgs.join(', ')}`);
      try {
        execSync(`npm install --no-save ${pkgs.join(' ')}`, {
          cwd: WORKSPACE,
          stdio: 'pipe',
          timeout: 60_000,
        });
        log(`Dependencies installed successfully`);
      } catch (installErr: any) {
        log(`WARN: Dependency install failed: ${installErr.message}. Template may not compile.`);
      }
    }

    return JSON.stringify({
      files,
      entryPoint: entryPoint || files[0]?.path || '',
      propsSchema: templateData.propsSchema || {},
      dependencies: deps || {},
      sharedLibrary: 'src/theme/',
      message: `Forked "${slug}" to ${targetDir}/. Shared library extracted to src/theme/. Template imports already point there.`,
    }, null, 2);
  },
};

export const allTemplateTools = [browseTemplatesTool, forkTemplateTool];
export const templateBrowseTools = [browseTemplatesTool];
