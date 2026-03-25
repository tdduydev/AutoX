// ============================================================
// @xclaw-ai/doc-mcp — MCP Server for Dev Documentation
// ============================================================
//
// Exposes developer documentation knowledge base as MCP tools.
// VS Code AI agents (Copilot, Claude, etc.) connect to this
// server to retrieve project documentation, coding conventions,
// architecture decisions, and code examples during development.
//

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { DocStore } from './doc-store.js';

export interface DocMcpServerOptions {
    /** Path to the dev-docs directory */
    docsRoot: string;
    /** Server name */
    name?: string;
    /** Server version */
    version?: string;
}

export function createDocMcpServer(options: DocMcpServerOptions): McpServer {
    const {
        docsRoot,
        name = 'xclaw-dev-docs',
        version = '1.0.0',
    } = options;

    const store = new DocStore(docsRoot);
    store.loadAll();

    const server = new McpServer({ name, version });

    // ─── Tool: search_docs ──────────────────────────────────
    server.tool(
        'search_docs',
        'Search the xClaw developer documentation knowledge base. Use this to find coding conventions, architecture patterns, API documentation, code examples, and troubleshooting guides. Returns matched documents with relevance scores and snippets.',
        {
            query: z.string().describe(
                'Search query — can be keywords, questions, or topics. Examples: "gateway route pattern", "drizzle schema", "MCP integration", "ESM import convention"',
            ),
            limit: z.number().optional().default(5).describe('Maximum number of results to return (default: 5)'),
        },
        async ({ query, limit }) => {
            store.loadAll(); // Reload to pick up any changes
            const results = store.search(query, limit);

            if (results.length === 0) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: `No documentation found for "${query}". Try different keywords or use list_doc_categories to browse available topics.`,
                    }],
                };
            }

            const formatted = results.map((r, i) => [
                `## ${i + 1}. ${r.doc.title}`,
                `**Category:** ${r.doc.category} | **Score:** ${r.score} | **Tags:** ${r.doc.tags.join(', ') || 'none'}`,
                `**Path:** ${r.doc.filePath}`,
                '',
                r.snippet,
                '',
            ].join('\n')).join('\n---\n\n');

            return {
                content: [{
                    type: 'text' as const,
                    text: `Found ${results.length} document(s) for "${query}":\n\n${formatted}`,
                }],
            };
        },
    );

    // ─── Tool: get_doc ──────────────────────────────────────
    server.tool(
        'get_doc',
        'Retrieve the full content of a specific documentation page by its ID or path. Use after search_docs to get complete documentation.',
        {
            id: z.string().describe(
                'Document ID (path without extension). Example: "conventions/typescript", "architecture/overview"',
            ),
        },
        async ({ id }) => {
            store.loadAll();
            const doc = store.getDoc(id);

            if (!doc) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: `Document "${id}" not found. Use search_docs or list_doc_categories to find available documents.`,
                    }],
                };
            }

            return {
                content: [{
                    type: 'text' as const,
                    text: [
                        `# ${doc.title}`,
                        `> Category: ${doc.category} | Tags: ${doc.tags.join(', ') || 'none'} | Words: ${doc.wordCount}`,
                        '',
                        doc.content,
                    ].join('\n'),
                }],
            };
        },
    );

    // ─── Tool: list_doc_categories ──────────────────────────
    server.tool(
        'list_doc_categories',
        'List all documentation categories and their document counts. Use this to discover what documentation is available before searching.',
        {},
        async () => {
            store.loadAll();
            const stats = store.getStats();
            const categories = store.listCategories();

            const catList = categories.map(cat => {
                const docs = store.listDocs(cat);
                return `- **${cat}/** (${docs.length} docs): ${docs.map(d => d.title).join(', ')}`;
            }).join('\n');

            return {
                content: [{
                    type: 'text' as const,
                    text: [
                        `# xClaw Dev Documentation`,
                        `Total: ${stats.totalDocs} documents | ${stats.totalWords.toLocaleString()} words`,
                        `Tags: ${stats.tags.join(', ') || 'none'}`,
                        '',
                        '## Categories',
                        catList,
                    ].join('\n'),
                }],
            };
        },
    );

    // ─── Tool: list_docs ────────────────────────────────────
    server.tool(
        'list_docs',
        'List all documents in a specific category. Returns titles, IDs, and tags for each document.',
        {
            category: z.string().optional().describe(
                'Category name to filter by. Omit to list all documents. Example: "conventions", "architecture"',
            ),
        },
        async ({ category }) => {
            store.loadAll();
            const docs = store.listDocs(category);

            if (docs.length === 0) {
                return {
                    content: [{
                        type: 'text' as const,
                        text: category
                            ? `No documents in category "${category}". Use list_doc_categories to see available categories.`
                            : 'No documents in the knowledge base. Add Markdown files to the dev-docs directory.',
                    }],
                };
            }

            const list = docs.map(d =>
                `- **${d.title}** (id: \`${d.id}\`) — ${d.category} | ${d.wordCount} words${d.tags.length ? ' | tags: ' + d.tags.join(', ') : ''}`,
            ).join('\n');

            return {
                content: [{
                    type: 'text' as const,
                    text: `${docs.length} document(s)${category ? ` in "${category}"` : ''}:\n\n${list}`,
                }],
            };
        },
    );

    // ─── Resource: docs-overview ────────────────────────────
    server.resource(
        'docs-overview',
        'docs://overview',
        { description: 'Overview of all available developer documentation', mimeType: 'text/markdown' },
        async () => {
            store.loadAll();
            const stats = store.getStats();
            const categories = store.listCategories();

            const overview = [
                '# xClaw Developer Documentation Knowledge Base',
                '',
                `Total documents: ${stats.totalDocs}`,
                `Categories: ${categories.join(', ')}`,
                `Tags: ${stats.tags.join(', ') || 'none'}`,
                '',
                '## How to Use',
                '- **search_docs**: Search by keywords or questions',
                '- **get_doc**: Read full documentation by ID',
                '- **list_doc_categories**: Browse categories',
                '- **list_docs**: List docs in a category',
                '',
                '## Categories',
                ...categories.map(cat => {
                    const docs = store.listDocs(cat);
                    return `\n### ${cat}\n` + docs.map(d => `- ${d.title} (\`${d.id}\`)`).join('\n');
                }),
            ].join('\n');

            return {
                contents: [{
                    uri: 'docs://overview',
                    text: overview,
                    mimeType: 'text/markdown',
                }],
            };
        },
    );

    return server;
}
