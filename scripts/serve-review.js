/**
 * data/ 를 http 로 띄우는 최소 정적 서버. 검토 화면 전용.
 *
 * 왜 필요한가: 검토 화면을 `file://` 로 열면 **유튜브 임베드가 오류 153으로 거부한다**
 * (임베드는 http(s) 출처를 요구하는데 로컬 파일은 출처가 없다). localhost 로 띄우면 정상 재생된다.
 *
 * 외부에 열지 않는다 — 127.0.0.1 에만 바인딩한다.
 *
 * 사용법:
 *   node scripts/serve-review.js            → http://127.0.0.1:4321/youtube-review.html
 *   node scripts/serve-review.js --port 5000
 */
const http = require('http')
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const PORT = parseInt(arg('port', '4321'))

const TYPES = { '.html': 'text/html; charset=utf-8', '.json': 'application/json; charset=utf-8', '.js': 'text/javascript; charset=utf-8' }

const server = http.createServer((req, res) => {
    // 검토 화면이 고른 결과를 여기로 보낸다. 브라우저에만 있으면 넘겨받을 방법이 없어서,
    // 내려받기 대신 파일로 바로 떨어지게 한다.
    if (req.method === 'POST' && req.url === '/choices') {
        let body = ''
        req.on('data', c => { body += c; if (body.length > 5e6) req.destroy() })
        req.on('end', () => {
            try {
                const parsed = JSON.parse(body)
                fs.writeFileSync(path.join(DATA_DIR, 'youtube-choices.json'), JSON.stringify(parsed, null, 1))
                console.log(`선택 저장됨: ${parsed.length}건 → data/youtube-choices.json`)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true, count: parsed.length }))
            } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: e.message }))
            }
        })
        return
    }

    const name = decodeURIComponent((req.url || '/').split('?')[0].replace(/^\//, '')) || 'youtube-review.html'
    // data/ 밖으로 못 나가게. 로컬 전용이라도 경로를 그대로 붙이지는 않는다.
    const file = path.join(DATA_DIR, path.basename(name))
    fs.readFile(file, (err, buf) => {
        if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('없음: ' + path.basename(name)) }
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' })
        res.end(buf)
    })
})

server.listen(PORT, '127.0.0.1', () => {
    console.log(`검토 화면: http://127.0.0.1:${PORT}/youtube-review.html`)
    console.log(`적재 검토:  http://127.0.0.1:${PORT}/artist-report.html`)
    console.log(`(Ctrl+C 로 종료)`)
})
