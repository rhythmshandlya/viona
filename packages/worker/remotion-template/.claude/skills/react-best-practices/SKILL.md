---
name: react-best-practices
description: React and Next.js performance optimization patterns from Vercel. Use when writing React components.
user-invocable: false
---

# React Best Practices (from Vercel)

## Critical: Eliminating Waterfalls

### Parallel Data Fetching
- Use Promise.all for independent requests
- Only chain requests when truly dependent
- Prefetch data before navigation

## Critical: Bundle Size Optimization

### Dynamic Imports
- Use dynamic() for heavy components
- Set ssr: false for client-only code
- Add loading states for async components

### Tree-Shakeable Imports
- Import only needed functions (e.g., from lodash-es)
- Avoid import * patterns

## High: Server-Side Performance

### Server Components
- Default to Server Components (no "use client")
- Use unstable_cache for database queries
- Deduplicate requests with React cache()

## Medium: Re-render Optimization

### Memoization
- useMemo for expensive calculations
- useCallback for stable function references
- Split state to minimize re-renders

## Composition Patterns

### Compound Components
- Prefer composition over prop explosion
- Use Context for shared state
- Create explicit variant components
