#!/usr/bin/env node
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

function parseArgs(argv) {
  const args = { port: 12088, dir: 'dist', host: '127.0.0.1' }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--port' && argv[i + 1]) args.port = Number(argv[++i])
    else if (a === '--dir' && argv[i + 1]) args.dir = argv[++i]
    else if (a === '--host' && argv[i + 1]) args.host = argv[++i]
  }
  return args
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

const { port, dir, host } = parseArgs(process.argv.slice(2))
const root = path.resolve(process.cwd(), dir)

if (!fs.existsSync(root)) {
  console.error(`[preview:h5] directory not found: ${root}`)
  process.exit(1)
}

// Taro 某些配置组合下不会生成 index.html（尤其当 outputRoot 不是默认 dist 时）。
// 这里兜底生成一个最小 index.html，指向 app.*.css + app.*.js (+ taro runtime chunk).
function ensureIndexHtml() {
  const indexPath = path.join(root, 'index.html')
  try {
    const cssDir = path.join(root, 'css')
    const jsDir = path.join(root, 'js')
    const css = fs.existsSync(cssDir)
      ? (fs.readdirSync(cssDir).find((f) => /^app\..+\.css$/.test(f)) || '')
      : ''
    const appJs = fs.existsSync(jsDir)
      ? (fs.readdirSync(jsDir).find((f) => /^app\..+\.js$/.test(f)) || '')
      : ''
    // 运行时 chunk 不是固定文件名，按“纯数字 chunk + 文件体积最大”挑选更稳妥。
    // 之前直接 find() 可能拿到错误 chunk，导致 H5 空白页。
    const runtimeJs = (() => {
      if (!fs.existsSync(jsDir)) return ''
      const candidates = fs.readdirSync(jsDir).filter((f) => /^\d+\..+\.js$/.test(f))
      if (!candidates.length) return ''
      const sorted = candidates.sort((a, b) => {
        const sa = fs.statSync(path.join(jsDir, a)).size
        const sb = fs.statSync(path.join(jsDir, b)).size
        return sb - sa
      })
      return sorted[0] || ''
    })()

    const lines = [
      '<!doctype html>',
      '<html lang="zh-CN">',
      '  <head>',
      '    <meta charset="utf-8" />',
      '    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />',
      '    <title>Longarch Miniapp H5</title>',
      css ? `    <link rel="stylesheet" href="./css/${css}" />` : '',
      '  </head>',
      '  <body>',
      '    <div id="app"></div>',
      runtimeJs ? `    <script src="./js/${runtimeJs}"></script>` : '',
      appJs ? `    <script src="./js/${appJs}"></script>` : '',
      '  </body>',
      '</html>',
      '',
    ].filter(Boolean)

    fs.writeFileSync(indexPath, lines.join('\n'), 'utf8')
    console.log(`[preview:h5] wrote index.html: ${indexPath}`)
  } catch (e) {
    console.warn('[preview:h5] failed to generate index.html', e)
  }
}

ensureIndexHtml()

function resolveFile(reqPath) {
  const pathname = decodeURIComponent(url.parse(reqPath).pathname || '/')
  const cleaned = pathname.replace(/^\/+/, '')
  let filePath = path.resolve(root, cleaned)
  if (!filePath.startsWith(root)) return null
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html')
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(root, 'index.html')
  }
  return filePath
}

const server = http.createServer((req, res) => {
  const filePath = resolveFile(req.url || '/')
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Forbidden')
    return
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Not Found')
      return
    }
    const ext = path.extname(filePath).toLowerCase()
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    })
    res.end(data)
  })
})

server.listen(port, host, () => {
  console.log(`[preview:h5] serving ${root}`)
  console.log(`[preview:h5] http://${host}:${port}`)
})

