import { serve } from '@hono/node-server';
import everstake from './everstake/route';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import * as path from 'node:path';
import { readFileSync } from 'node:fs';
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
var mime = require('mime-types');

const app = new OpenAPIHono();

app.use(
  '/*',
  cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Accept-Encoding', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
    exposeHeaders: [],
    maxAge: 600,
    credentials: true,
  }),
);

// <--Actions-->
app.route('/api/everstake/stake', everstake);
// </--Actions-->

app.doc('/doc', {
  info: {
    title: 'An API',
    version: 'v1',
  },
  openapi: '3.1.0',
});

app.get(
  '/swagger-ui',
  swaggerUI({
    url: '/doc',
  }),
);

app.get('/actions.json', async (c) => {
  const [payload, mime_type] = loadFile('actions.json');
  return new Response(payload, {
    headers: {
      'content-type': mime_type,
    },
    status: 200,
  });
});

// Download File
const downloadFileRoute = createRoute({
  method: 'get',
  path: '/static/{file}',
  summary: 'static files',
  tags: ['Static'],
  request: {
    params: z.object({
      file: z.string().openapi({
        param: {
          name: 'file',
          in: 'path',
        },
        type: 'string',
        example: 'file.jpg',
      }),
    }),
  },
  responses: {
    200: {
      content: {
        'image/png': {
          schema: z.any().openapi({
            type: 'object',
            format: 'binary',
          }),
        },
      },
      description: 'Return file, contentType can be image/png or image/jpeg',
    },
  },
});

// disable ts check because hono openapi cannot validate raw response
// @ts-ignore: Unreachable code error
app.openapi(downloadFileRoute, async (c) => {
  const file = c.req.param('file');
  const [payload, mime_type] = loadFile(file);
  return new Response(payload, {
    headers: {
      'content-type': mime_type,
    },
    status: 200,
  });
});

function loadFile(file: string): [Buffer, string] {
  const payload = readFileSync(path.join('./static', file));
  const mime_type = mime.lookup(path.join('./static', file));
  return [payload, mime_type];
}

const port = 3000;
console.log(
  `Server is running on port ${port}
Visit http://localhost:${port}/swagger-ui to explore existing actions
Visit https://actions.dialect.to to unfurl action into a Blink
`,
);

serve({
  fetch: app.fetch,
  port,
});
