import react from '@vitejs/plugin-react'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

const ANNOTATIONS = resolve(__dirname, 'plans/annotations.json')

// Éditeur de carte (/editeur.html, en local seulement) : lit et enregistre plans/annotations.json.
function annotations(): Plugin {
  return {
    name: 'annotations-carte',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__annotations', (req, res) => {
        if (req.method === 'PUT') {
          let corps = ''
          req.on('data', (morceau) => (corps += morceau))
          req.on('end', () => {
            try {
              JSON.parse(corps)
            } catch {
              res.statusCode = 400
              res.end('JSON invalide')
              return
            }
            mkdirSync(dirname(ANNOTATIONS), { recursive: true })
            writeFileSync(ANNOTATIONS, corps + '\n')
            res.end('ok')
          })
          return
        }
        res.setHeader('Content-Type', 'application/json')
        res.end(existsSync(ANNOTATIONS) ? readFileSync(ANNOTATIONS) : '{"annotations":[]}')
      })
    },
  }
}

// BASE_PATH : sous-dossier du site en ligne (ex : /ile/ sur GitHub Pages). Vide en local.
export default defineConfig({
  base: process.env.BASE_PATH ? `${process.env.BASE_PATH}/` : '/',
  plugins: [react(), annotations()],
})
