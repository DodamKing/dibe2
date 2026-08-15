/**
 * 사람이 내린 판단을 artist-youtube.jsonl 에 반영한다. (요청/DB 없음)
 *
 * 1차 필터는 스크립트가 하지만 **거기서 더 못 걸러내는 판단**(영문 제목 대응, 커버 밴드,
 * 반주판, 라이브 여부)은 곡을 하나씩 보고 정한다. 그 결정을 데이터에 다시 얹는 단계다.
 * 규칙을 더 복잡하게 만드는 대신 결정을 파일로 남기므로, 왜 그렇게 정했는지가 사라지지 않는다.
 *
 * 입력 두 개, 뒤가 이긴다:
 *   docs/artist-import-decisions.json  검토하며 내린 판단. **`data/` 가 아니라 `docs/` 다** —
 *                                      크롤링 산출물과 달리 재생성이 안 되는 기록이라 git 에 남긴다
 *   data/youtube-choices.json          사람이 검토 화면에서 직접 고른 것 (있으면 무조건 우선)
 *
 * 사용법:
 *   node scripts/apply-decisions.js --dry-run
 *   node scripts/apply-decisions.js
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const YT_FILE = path.join(DATA_DIR, 'artist-youtube.jsonl')
const DEC_FILE = path.join(__dirname, '..', 'docs', 'artist-import-decisions.json')
const CHOICE_FILE = path.join(DATA_DIR, 'youtube-choices.json')
const DRY_RUN = process.argv.includes('--dry-run')

const rows = fs.readFileSync(YT_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
const find = (title, artist) => rows.find(r => r.title === title && (!artist || r.artist === artist))
const pickOf = r => r.candidates.find(c => c.videoId === r.pick)

let dec = {}
try { dec = JSON.parse(fs.readFileSync(DEC_FILE, 'utf8')) } catch { console.log(`${DEC_FILE} 없음`) }

// 이미 다른 곡이 쓰고 있는 영상은 후보에서 뺀다 — 한 영상이 두 곡에 붙으면 하나는 반드시 틀렸다.
const assigned = new Set(rows.filter(r => r.include && r.pick).map(r => r.pick))

const log = []
let changed = 0

// ⓪ 곡 목록에서 빠진 행 정리.
// artist-youtube.jsonl 은 검증 당시의 목록으로 만들어졌는데, 그 뒤 중복 정리 규칙이 바뀌면
// 목록에서 빠진 곡의 행이 남는다. 적재는 artist-songs.jsonl 로 조인하므로 DB에 잘못 들어가진
// 않지만, 검토 화면의 "적재 N곡" 이 부풀어서 사실과 달라진다.
const SONGS_FILE = path.join(DATA_DIR, 'artist-songs.jsonl')
if (fs.existsSync(SONGS_FILE)) {
    const live = new Set(fs.readFileSync(SONGS_FILE, 'utf8').split('\n').filter(Boolean)
        .map(JSON.parse).map(s => `${s.title}|||${s.artist}`))
    for (const r of rows) {
        if (r.source === 'existing' || live.has(`${r.title}|||${r.artist}`)) continue
        if (!r.include) continue
        log.push(`목록밖 ${r.title.padEnd(28)} (중복 정리로 곡 목록에서 빠짐)`)
        r.include = false; r.decidedBy = 'system:not-in-list'
        r.decidedWhy = '중복 정리로 곡 목록에서 빠진 곡입니다. 같은 녹음이 다른 제목으로 이미 적재됩니다.'
        changed++
    }
}

// ① 공식 채널의 같은 곡으로 교체 (영문 제목이라 제목 대조가 실패했던 것들)
for (const d of dec['adopt-official'] || []) {
    const r = find(d.title, d.artist)
    if (!r) { log.push(`[!] 없는 곡: ${d.title}`); continue }
    const alt = r.candidates.filter(c => !c.titleMatch && c.officialChannel && !c.negative
        && c.diff != null && Math.abs(c.diff) <= 3 && c.videoId !== r.pick && !assigned.has(c.videoId))
        .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff))[0]
    if (!alt) { log.push(`[!] 공식 후보 못 찾음: ${d.title}`); continue }
    log.push(`교체  ${d.title.padEnd(30)} ${(pickOf(r)?.vtitle || '').slice(0, 30)} → ${alt.vtitle.slice(0, 30)} [${alt.channel.slice(0, 16)}]`)
    assigned.delete(r.pick); assigned.add(alt.videoId)
    r.pick = alt.videoId; r.include = true; r.decidedBy = 'claude:adopt-official'; r.decidedWhy = d.why
    changed++
}

// ② 영상 직접 지정
for (const d of dec['video'] || []) {
    const r = find(d.title, d.artist)
    if (!r) { log.push(`[!] 없는 곡: ${d.title}`); continue }
    const c = r.candidates.find(x => x.videoId === d.videoId)
    if (!c) { log.push(`[!] 후보에 없는 videoId: ${d.title} ${d.videoId}`); continue }
    log.push(`지정  ${d.title.padEnd(30)} → ${c.vtitle.slice(0, 34)} [${c.channel.slice(0, 16)}]`)
    assigned.delete(r.pick); assigned.add(c.videoId)
    r.pick = c.videoId; r.include = true; r.decidedBy = 'claude:video'; r.decidedWhy = d.why
    changed++
}

// ③ 적재 제외
for (const d of dec['drop'] || []) {
    const r = find(d.title, d.artist)
    if (!r) { log.push(`[!] 없는 곡: ${d.title}`); continue }
    log.push(`제외  ${d.title.padEnd(30)} (${d.why.slice(0, 40)})`)
    assigned.delete(r.pick)
    r.include = false; r.decidedBy = 'claude:drop'; r.decidedWhy = d.why
    changed++
}

// ④ 현재 픽 유지 — 값은 안 바꾸고 "확인했다"는 근거만 남긴다
for (const d of dec['keep'] || []) {
    const r = find(d.title, d.artist)
    if (!r) { log.push(`[!] 없는 곡: ${d.title}`); continue }
    log.push(`유지  ${d.title.padEnd(30)} (${d.why.slice(0, 40)})`)
    r.decidedBy = 'claude:keep'; r.decidedWhy = d.why
}

// ⑤ 사람이 화면에서 고른 것 — 가장 마지막에 얹어서 무조건 이기게 한다
let choices = []
try { choices = JSON.parse(fs.readFileSync(CHOICE_FILE, 'utf8')) } catch { }
for (const c of choices) {
    const r = find(c.title, c.artist)
    if (!r) { log.push(`[!] 없는 곡: ${c.title}`); continue }
    const before = r.pick
    r.pick = c.videoId || null
    r.include = !!c.videoId
    r.decidedBy = 'user'
    if (before !== r.pick) { log.push(`사용자 ${c.title.padEnd(28)} → ${c.videoId || '(제외)'}`); changed++ }
}
if (choices.length) console.log(`사용자 선택 ${choices.length}건 반영`)

log.forEach(l => console.log(l))
const inc = rows.filter(r => r.include).length
console.log(`\n=== 반영 ${changed}건 === 적재 ${inc} / 제외 ${rows.length - inc}`)
if (!DRY_RUN) {
    fs.writeFileSync(YT_FILE, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
    console.log(`출력: ${YT_FILE}`)
}
