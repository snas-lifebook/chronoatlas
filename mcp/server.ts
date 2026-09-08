// 크로노아틀라스 MCP 서버(stdio, 읽기 전용 4툴). 실행: node --experimental-strip-types mcp/server.ts [--ds rome]
// Claude Desktop: { "mcpServers": { "chronoatlas": { "command": "node", "args": ["--experimental-strip-types", "<repo>/mcp/server.ts"] } } }
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { join } from 'node:path';
import { openDataset, tools } from './tools.ts';

const ds = process.argv[process.argv.indexOf('--ds') + 1] || 'rome';
const d = openDataset(join(import.meta.dirname, '..'), process.argv.includes('--ds') ? ds : 'rome');
const text = (v: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(v, null, 1) }] });

const server = new McpServer({ name: 'chronoatlas', version: '0.1.0' });
server.registerTool('get_schema', { description: '온톨로지 타입·관계(rel)·의미군·데이터셋 정보. 먼저 한 번 부른다.' }, async () => text(tools.get_schema(d)));
server.registerTool('find_entity', { description: '이름·이명·초성으로 객체 찾기(최대 20). id를 얻는 용도.', inputSchema: { q: z.string(), type: z.string().optional().describe('person|place|event|group|institution|work|period|faction|office') } },
  async ({ q, type }) => text(tools.find_entity(d, q, type)));
server.registerTool('neighbors', { description: '객체의 1홉 관계 + 그 해의 상태. to_year 이하의 관계만(연도 미상 포함). 지도 패널과 같은 목록.', inputSchema: { id: z.string(), from_year: z.number().int().optional(), to_year: z.number().int().optional(), rels: z.array(z.string()).optional() } },
  async ({ id, from_year, to_year, rels }) => text(tools.neighbors(d, id, from_year, to_year, rels)));
server.registerTool('path', { description: '두 객체 사이 최단 관계 경로(무방향, 최대 max_hops).', inputSchema: { a: z.string(), b: z.string(), max_hops: z.number().int().min(1).max(6).optional() } },
  async ({ a, b, max_hops }) => text(tools.path(d, a, b, max_hops ?? 4)));

await server.connect(new StdioServerTransport());
