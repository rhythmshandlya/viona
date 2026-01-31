# Claude Max Provider Integration

**Date:** 2026-01-31
**Status:** Approved

## Overview

Add support for Claude Max subscription as an LLM provider alongside OpenRouter. This enables:
- **Cost savings** - Flat monthly rate vs per-token pricing
- **Model quality** - Use Claude Opus 4.5 for code generation
- **Flexibility** - Switch providers via environment variable

## Architecture

```
LLM_PROVIDER=claude-max                    LLM_PROVIDER=openrouter
        │                                          │
        ▼                                          ▼
┌─────────────────┐                    ┌─────────────────────┐
│ claude-max-api  │                    │   OpenRouter API    │
│ localhost:3456  │                    │ openrouter.ai/api   │
└────────┬────────┘                    └──────────┬──────────┘
         │                                        │
         ▼                                        ▼
┌─────────────────┐                    ┌─────────────────────┐
│  Claude Code    │                    │   Gemini 3 Pro/     │
│  (Max sub)      │                    │   Flash via OR      │
└─────────────────┘                    └─────────────────────┘
```

## Configuration

### Environment Variables

```bash
# Provider selection (required)
LLM_PROVIDER=claude-max    # or "openrouter" (default)

# Claude Max settings
CLAUDE_MAX_PROXY_URL=http://localhost:3456/v1
CLAUDE_MAX_MODEL=claude-opus-4           # Code generation
CLAUDE_MAX_MODEL_FLASH=claude-haiku-4    # Evaluation

# OpenRouter settings (existing)
OPENROUTER_API_KEY=sk-or-...
```

### Model Mapping

| Use Case | Claude Max | OpenRouter |
|----------|------------|------------|
| Code Generation | `claude-opus-4` | `google/gemini-3-pro-preview` |
| Evaluation | `claude-haiku-4` | `google/gemini-3-flash-preview` |

## File Changes

### 1. `packages/worker/src/config.ts`

Add LLM provider configuration:

```typescript
llm: {
  provider: (process.env.LLM_PROVIDER || 'openrouter') as 'claude-max' | 'openrouter',

  claudeMax: {
    proxyUrl: process.env.CLAUDE_MAX_PROXY_URL || 'http://localhost:3456/v1',
    model: process.env.CLAUDE_MAX_MODEL || 'claude-opus-4',
    modelFlash: process.env.CLAUDE_MAX_MODEL_FLASH || 'claude-haiku-4',
    apiKey: 'not-needed',
  },

  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: 'google/gemini-3-pro-preview',
    modelFlash: 'google/gemini-3-flash-preview',
  },
}
```

### 2. `packages/worker/src/processors/generate-visuals.ts`

Replace `LLM_MODELS` and `LLM_CONFIG` with provider-aware config:

```typescript
function getLLMConfig() {
  const provider = config.llm.provider;

  if (provider === 'claude-max') {
    return {
      provider: 'claude-max',
      baseUrl: config.llm.claudeMax.proxyUrl,
      apiKey: config.llm.claudeMax.apiKey,
      model: config.llm.claudeMax.model,
      modelFlash: config.llm.claudeMax.modelFlash,
      temperature: 1.0,
    };
  }

  return {
    provider: 'openrouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: process.env.OPENROUTER_API_KEY,
    model: config.llm.openrouter.model,
    modelFlash: config.llm.openrouter.modelFlash,
    temperature: 1.0,
  };
}
```

Add `--base-url` and `--api-key` to spawn arguments.

### 3. `visual_generator.py` (both versions)

Add arguments:
```python
parser.add_argument("--base-url", help="LLM API base URL")
parser.add_argument("--api-key", default="not-needed", help="API key")
```

Update LLM initialization:
```python
generator_llm = LLM(
    model=args.model,
    api_key=SecretStr(args.api_key),
    api_base=args.base_url,
    temperature=args.temperature,
    usage_id="code-generation",
)
```

Remove `get_model_name()` function - no longer needed.

## Setup Instructions

### One-time Setup

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code
claude login

# Install proxy
npm install -g claude-max-api-proxy

# Verify
claude-max-api &
curl http://localhost:3456/health
```

### Running

```bash
# With Claude Max (proxy must be running)
claude-max-api &
LLM_PROVIDER=claude-max pnpm --filter @reelify/worker dev

# With OpenRouter (default)
LLM_PROVIDER=openrouter pnpm --filter @reelify/worker dev
```

### Docker

Use `host.docker.internal` to reach host's proxy:
```bash
CLAUDE_MAX_PROXY_URL=http://host.docker.internal:3456/v1
```

## Error Handling

Optional health check before job starts:
```typescript
if (config.llm.provider === 'claude-max') {
  try {
    await fetch(`${config.llm.claudeMax.proxyUrl.replace('/v1', '')}/health`);
  } catch {
    throw new Error('Claude Max proxy not running. Start with: claude-max-api');
  }
}
```

## Not Changed

- Docker image (proxy on host)
- Prompts (model-agnostic)
- Frontend
