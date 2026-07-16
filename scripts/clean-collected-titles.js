/**
 * 수집본(data/*.jsonl)의 오염된 제목(`[19금]\n곡명`)을 정리하고 `adult` 플래그로 이관한다.
 * 프로덕션 파서 수정(`.title` → `.title a`)과 짝이며, DB 쪽은 `fix-dirty-titles.js`가 담당한다.
 *
 * ⚠️ 배지는 뒤에 **개행**이 붙는다(실측: [19금] 243/243, [권리없는 곡] 62/62).
 * `[드포즈 극장] 바그다드 카페`처럼 대괄호가 진짜 제목인 곡은 공백으로 이어지므로
 * `^\[[^\]]+\]\n` (개행 필수)로만 잘라야 훼손되지 않는다. `^\[.*?\]`로 하면 그 곡들이 깨진다.
 *
 * 병합: 정리하면 배지본과 깨끗한 본의 키가 같아진다(같은 곡이 싱글/정규/리패키지로 따로 수집된 경우).
 *  - bugs-chart-rows.jsonl → 행 단위라 그대로 두면 된다. **재집계가 알아서 합산**한다
 *    (오히려 정확해진다: 오르트구름 31행 + 배지본 2행 → 33행)
 *  - songs-enriched.jsonl / songs-youtube.jsonl → 곡 단위라 중복이 생긴다. **깨끗한 본을 남긴다**
 *    (실측 3건 모두 깨끗한 본이 더 인기 있고 더 최근이며, DB의 ExtraL 처리 정책과도 같다)
 *
 * 원본은 .bak 으로 백업한다(data/는 gitignore라 되돌릴 방법이 이것뿐).
 *
 * 사용법:
 *   node scripts/clean-collected-titles.js           # 분석만 (기본 dry-run)
 *   node scripts/clean-collected-titles.js --apply   # 실제 정리
 */
const fs = require('fs')
const path = require('path')
const readline = require('readline')

const DATA_DIR = path.join(__dirname, '..', 'data')
const APPLY = process.argv.includes('--apply')

// 배지 = 대괄호 + 개행. 개행이 없으면 진짜 제목이므로 건드리지 않는다.
const BADGE_RE = /^\[([^\]]+)\]\s*\n\s*/
const key = (t, a) => `${t}|||${a}`

const clean = title => title.replace(BADGE_RE, '').trim()
const badgeOf = title => (BADGE_RE.exec(title) || [])[1] || null

async function readJsonl(file) {
    const out = []
    const rl = readline.createInterface({ input: fs.createReadStream(file), crlfDelay: Infinity })
    for await (const line of rl) if (line.trim()) out.push(JSON.parse(line))
    return out
}

function writeJsonl(file, rows) {
    fs.writeFileSync(file, rows.map(r => JSON.stringify(r)).join('\n') + '\n')
}

function backup(file) {
    const bak = file + '.bak'
    fs.copyFileSync(file, bak)
    return bak
}

/** 제목 정리 + adult 이관. 반환: 바뀐 행 수 */
function cleanRows(rows) {
    let changed = 0, adults = 0
    for (const r of rows) {
        const badge = badgeOf(r.title)
        if (!badge) continue
        r.title = clean(r.title)
        if (badge === '19금') { r.adult = true; adults++ }
        changed++
    }
    return { changed, adults }
}

/**
 * 곡 단위 파일에서 정리 후 중복이 되는 항목을 제거한다(깨끗한 본을 남긴다).
 * 배지본을 지우는 이유: 배지가 없었다면 애초에 같은 키라 하나만 남았을 것이기 때문.
 */
function dedupe(rows) {
    const cleanKeys = new Set(rows.filter(r => !badgeOf(r.title)).map(r => key(r.title, r.artist)))
    const dropped = []
    const kept = rows.filter(r => {
        const badge = badgeOf(r.title)
        if (!badge) return true
        if (cleanKeys.has(key(clean(r.title), r.artist))) {
            dropped.push({ badge, title: clean(r.title), artist: r.artist })
            return false
        }
        return true
    })
    return { kept, dropped }
}

async function handle(name, { dedupeSongs }) {
    const file = path.join(DATA_DIR, name)
    if (!fs.existsSync(file)) return console.log(`\n[${name}] 없음 — 건너뜀`)

    console.log(`\n=== ${name} ===`)
    let rows = await readJsonl(file)
    const before = rows.length

    // 진짜 제목에 대괄호가 있는 곡은 손대지 않는다는 걸 눈으로 확인
    const realBrackets = rows.filter(r => /^\[/.test(r.title) && !badgeOf(r.title))
    if (realBrackets.length) {
        const uniq = [...new Set(realBrackets.map(r => r.title))]
        console.log(`  보존(대괄호가 진짜 제목): ${uniq.length}곡 — ${uniq.slice(0, 3).map(t => JSON.stringify(t)).join(', ')}`)
    }

    let dropped = []
    if (dedupeSongs) {
        const res = dedupe(rows)
        rows = res.kept
        dropped = res.dropped
        if (dropped.length) {
            console.log(`  중복 제거(배지본 버리고 깨끗한 본 유지): ${dropped.length}건`)
            for (const d of dropped) console.log(`     [${d.badge}] ${JSON.stringify(d.title)} - ${d.artist}`)
        }
    }

    const { changed, adults } = cleanRows(rows)
    console.log(`  제목 정리 ${changed}건 (그중 19금 → adult:true ${adults}건)`)
    console.log(`  행수 ${before.toLocaleString()} → ${rows.length.toLocaleString()}`)

    // 정리 후 오염이 남아있지 않은지 스스로 확인
    const left = rows.filter(r => badgeOf(r.title)).length
    console.log(`  남은 오염 ${left}건 (0이어야 함)`)

    if (!APPLY) return

    const bak = backup(file)
    writeJsonl(file, rows)
    console.log(`  ✓ 저장 완료 (백업: ${path.basename(bak)})`)
}

async function main() {
    console.log(APPLY ? '=== 실제 정리 (--apply) ===' : '=== 분석만 (dry-run) — 실제로 고치려면 --apply ===')

    // 원시 행: 행 단위라 중복 제거 안 함. 재집계가 합산해준다(오히려 정확해진다).
    await handle('bugs-chart-rows.jsonl', { dedupeSongs: false })
    // 곡 단위: 정리하면 키가 겹치므로 배지본을 버린다.
    await handle('songs-enriched.jsonl', { dedupeSongs: true })
    await handle('songs-youtube.jsonl', { dedupeSongs: true })

    console.log(`\n※ songs.jsonl 은 정리하지 않는다 — aggregate-songs.js 재실행으로 새로 만든다.`)
    if (APPLY) console.log(`※ 다음: node scripts/aggregate-songs.js --out data/songs.jsonl`)
}

main().catch(err => { console.error(err); process.exit(1) })
