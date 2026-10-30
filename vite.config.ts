import { defineConfig } from 'vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'save-room1-file',
      configureServer(server) {
        server.middlewares.use('/api/save-room1', (req, res) => {
          if (req.method === 'POST') {
            let body = ''
            req.on('data', (chunk: Buffer) => {
              body += chunk.toString()
            })
            req.on('end', () => {
              try {
                const parsed = JSON.parse(body)
                const content = typeof parsed.content === 'string' ? parsed.content : ''
                const filePath = path.resolve(__dirname, 'src/game/content/room1.ts')
                fs.writeFileSync(filePath, content, 'utf-8')
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, path: filePath }))
              } catch (err: unknown) {
                const message = err instanceof Error ? err.message : String(err)
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: message }))
              }
            })
            return
          }
          res.writeHead(405)
          res.end()
        })
      },
    },
  ],
})
