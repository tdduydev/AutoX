---
description: "Use when creating or modifying TypeScript files, adding new packages, or fixing import/build issues in xClaw monorepo"
applyTo: "**/*.ts"
---
# TypeScript & Monorepo Instructions

## ESM Requirements

- All packages use `"type": "module"` — never use CommonJS
- Relative imports MUST use `.js` extension: `import { Foo } from './foo.js'`
- tsconfig: `module: "NodeNext"`, `moduleResolution: "NodeNext"`, `target: "ES2022"`

## Package Dependencies

- Foundation types live in `@xclaw-ai/shared` — import with `import type { ... } from '@xclaw-ai/shared'`
- Each package tsconfig declares `references` to sibling dependencies
- Barrel exports: every package has `src/index.ts` re-exporting public API

## Gateway Routes (Hono)

```typescript
app.get('/api/resource', async (c) => {
  try {
    const tenantId = c.get('tenantId');
    // ... logic
    return c.json({ ok: true, data });
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : 'Failed' }, 500);
  }
});
```

## Adding a New Package

1. Create `packages/<name>/package.json` with `"name": "@xclaw-ai/<name>"`, `"type": "module"`
2. Create `packages/<name>/tsconfig.json` extending root, add `references` to dependency packages
3. Add `"packages/<name>"` to root `package.json` workspaces array
4. Add `@xclaw-ai/<name>` dependency + tsconfig reference to consuming packages

## Web Frontend

- React + Tailwind (Vite) at `packages/web/`
- State: Zustand stores in `packages/web/src/stores/`
- Icons: `lucide-react`
- Dark theme: `bg-dark-800/900`, `border-dark-700`, `text-slate-300/400/500`
