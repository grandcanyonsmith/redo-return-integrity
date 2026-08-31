import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import type { Plugin } from 'vite'
import type { IncomingMessage, ServerResponse } from 'node:http'

type LambdaResult = {
  statusCode?: number
  headers?: Record<string, string | number | boolean>
  cookies?: string[]
  body?: string
  isBase64Encoded?: boolean
}

type LambdaHandler = (event: Record<string, unknown>) => Promise<LambdaResult>

const readBody = (req: IncomingMessage) => new Promise<Buffer>((resolve, reject) => {
  const chunks: Buffer[] = []
  req.on('data', (chunk: Buffer) => chunks.push(chunk))
  req.on('end', () => resolve(Buffer.concat(chunks)))
  req.on('error', reject)
})

const toLambdaEvent = (req: IncomingMessage, body: Buffer) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.searchParams.toString(),
    cookies: req.headers.cookie ? req.headers.cookie.split('; ') : undefined,
    headers: Object.fromEntries(
      Object.entries(req.headers).map(([name, value]) => [name, Array.isArray(value) ? value.join(',') : value ?? '']),
    ),
    queryStringParameters: Object.fromEntries(url.searchParams),
    requestContext: {
      accountId: 'local',
      apiId: 'local',
      domainName: 'localhost',
      domainPrefix: 'local',
      http: {
        method: req.method ?? 'GET',
        path: url.pathname,
        protocol: 'HTTP/1.1',
        sourceIp: req.socket.remoteAddress ?? '127.0.0.1',
        userAgent: String(req.headers['user-agent'] ?? 'local-dev'),
      },
      requestId: randomUUID(),
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: body.length > 0 ? body.toString('utf8') : undefined,
    isBase64Encoded: false,
  }
}

/** Serves the real Lambda API in-process during `vite dev`, so the workstation
 * runs the full MCP loop locally (in-memory stores, safe-fallback OpenAI, no
 * AWS credentials required). The handler is bundled once per server start with
 * the same flags as the API's production build; restart the dev server to pick
 * up API changes. */
export function localApiPlugin(): Plugin {
  let handlerPromise: Promise<LambdaHandler> | undefined

  const loadHandler = (): Promise<LambdaHandler> => {
    handlerPromise ??= (async () => {
      const dirname = path.dirname(fileURLToPath(import.meta.url))
      const entry = path.resolve(dirname, '../../services/api/src/handler.ts')
      const outfile = path.resolve(dirname, 'node_modules/.cache/local-api/handler.mjs')
      mkdirSync(path.dirname(outfile), { recursive: true })
      await build({
        entryPoints: [entry],
        outfile,
        bundle: true,
        format: 'esm',
        platform: 'node',
        target: 'node22',
        external: ['@aws-sdk/*'],
        logLevel: 'silent',
      })
      const loaded = await import(pathToFileURL(outfile).href) as { createHandler: () => LambdaHandler }
      return loaded.createHandler()
    })()
    return handlerPromise
  }

  const middleware = async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const handler = await loadHandler()
      const body = await readBody(req)
      const result = await handler(toLambdaEvent(req, body))
      res.statusCode = result.statusCode ?? 200
      for (const [name, value] of Object.entries(result.headers ?? {})) res.setHeader(name, String(value))
      if (result.cookies && result.cookies.length > 0) res.setHeader('set-cookie', result.cookies)
      if (result.body) res.end(result.isBase64Encoded ? Buffer.from(result.body, 'base64') : result.body)
      else res.end()
    } catch (error) {
      res.statusCode = 500
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify({ message: 'Local API middleware failed.', detail: error instanceof Error ? error.message : String(error) }))
    }
  }

  return {
    name: 'local-lambda-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith('/api/')) void middleware(req, res)
        else next()
      })
    },
  }
}
