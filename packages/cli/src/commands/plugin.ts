/**
 * Plugin CLI commands — scaffold, validate, and package xClaw plugins.
 *
 * Usage:
 *   xclaw plugin create <name>    Create a new plugin scaffold
 *   xclaw plugin validate [dir]   Validate plugin structure
 *   xclaw plugin pack [dir]       Package plugin for distribution
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const PLUGIN_TEMPLATE_FILES: Record<string, string | ((name: string) => string)> = {
  'package.json': (name: string) => JSON.stringify({
    name: `@xclaw-plugins/${name}`,
    version: '0.1.0',
    description: `xClaw plugin: ${name}`,
    type: 'module',
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc -b',
      dev: 'tsc -b --watch',
    },
    xclaw: {
      type: 'plugin',
      skills: [],
      pages: [],
    },
    dependencies: {
      '@xclaw-ai/core': '*',
      '@xclaw-ai/shared': '*',
    },
  }, null, 2),

  'tsconfig.json': () => JSON.stringify({
    extends: '../../../tsconfig.json',
    compilerOptions: {
      outDir: './dist',
      rootDir: './src',
      composite: true,
    },
    include: ['src'],
  }, null, 2),

  'src/index.ts': (name: string) => `// ${name} plugin entry point
export const plugin = {
  id: '${name}',
  name: '${name}',
  version: '0.1.0',
  skills: [],
  pages: [],
};

export default plugin;
`,

  'README.md': (name: string) => `# ${name}

xClaw plugin.

## Installation

Add to your xClaw setup:

\`\`\`json
{
  "plugins": ["@xclaw-plugins/${name}"]
}
\`\`\`

## Development

\`\`\`bash
npm run dev
\`\`\`
`,
};

export function pluginCreate(name: string, targetDir?: string) {
  if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error('❌ Plugin name must be lowercase alphanumeric with hyphens (e.g., my-plugin)');
    process.exit(1);
  }

  const dir = targetDir ?? path.join(process.cwd(), 'plugins', name);

  if (fs.existsSync(dir)) {
    console.error(`❌ Directory already exists: ${dir}`);
    process.exit(1);
  }

  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });

  for (const [file, generatorOrFn] of Object.entries(PLUGIN_TEMPLATE_FILES)) {
    const content = typeof generatorOrFn === 'function' ? generatorOrFn(name) : generatorOrFn;
    const filePath = path.join(dir, file);
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  console.log(`✅ Plugin scaffolded at ${dir}`);
  console.log(`   cd ${dir} && npm install && npm run dev`);
}

export function pluginValidate(dir: string) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    console.error('❌ No package.json found');
    process.exit(1);
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  const errors: string[] = [];

  if (!pkg.name) errors.push('Missing "name" in package.json');
  if (!pkg.version) errors.push('Missing "version" in package.json');
  if (!pkg.xclaw) errors.push('Missing "xclaw" field in package.json');
  if (pkg.type !== 'module') errors.push('"type" must be "module"');

  const srcIndex = path.join(dir, 'src', 'index.ts');
  if (!fs.existsSync(srcIndex)) errors.push('Missing src/index.ts entry point');

  if (errors.length > 0) {
    console.error('❌ Validation failed:');
    errors.forEach((e) => console.error(`   - ${e}`));
    process.exit(1);
  }

  console.log('✅ Plugin is valid');
}

export function pluginPack(dir: string) {
  const distDir = path.join(dir, 'dist');
  if (!fs.existsSync(distDir)) {
    console.error('❌ No dist/ directory. Run "npm run build" first.');
    process.exit(1);
  }

  pluginValidate(dir);
  console.log('✅ Plugin is ready for distribution');
  console.log('   Publish with: npm publish');
}
