/**
 * 테마 플레이리스트 수집 → ThemeSong 풀 갱신 (누적 + 감쇠).
 *
 * 유튜브에서 "비 오는 날 듣기 좋은 노래" 같은 사용자 플레이리스트를 테마당 50~70개 모아
 * 여러 리스트에 겹치는 곡을 센다. 알고리즘·근거는 docs/THEME_PLAYLIST.md
 *
 * 사용법:
 *   node scripts/refresh-themes.js --dry-run              # DB 안 씀. 요약 + 50곡 샘플
 *   node scripts/refresh-themes.js --theme rain,drive     # 일부 테마만
 *   node scripts/refresh-themes.js --cache <dir>          # 유튜브 응답 파일 캐시 (재실행 시 요청 0)
 *   node scripts/refresh-themes.js                        # 전 테마 수집 → DB 반영 (약 600요청, 30분)
 */
require('dotenv').config()

const fs = require('fs')
const mongoose = require('mongoose')
const { connectToMongoDB } = require('../server/models')
const themeDefinitions = require('../server/services/themeDefinitions')
const { createCollector, applySpecificity } = require('../server/services/themeCollector')
const themeService = require('../server/services/themeService')

const DRY_RUN = process.argv.includes('--dry-run')
const argOf = (name) => {
    const i = process.argv.indexOf(name)
    return i !== -1 ? process.argv[i + 1] : null
}
const ONLY = argOf('--theme') ? argOf('--theme').split(',') : null
const CACHE_DIR = argOf('--cache')

// 이번 수집의 core가 이보다 적으면 DB에 안 쓴다 — 차단·빈 응답으로 망가진 수집이 풀을 덮는 걸 막는다
const MIN_CORE = 50

async function main() {
    const defs = ONLY ? themeDefinitions.filter((d) => ONLY.includes(d.key)) : themeDefinitions
    if (!defs.length) throw new Error(`없는 테마: ${ONLY}`)
    if (CACHE_DIR && !fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true })

    const collector = createCollector({ cacheDir: CACHE_DIR })
    const started = Date.now()

    // 1) 수집 + 정리 — 별칭 학습이 전 테마에서 끝난 뒤 묶어야 테마 간 songKey가 일관된다
    const parsed = []
    for (const def of defs) {
        const lists = await collector.collectTheme(def)
        parsed.push({ def, ...collector.parseTheme(def, lists) })
        console.log(`[${def.key}] 플레이리스트 ${lists.length}개 (누적 요청 ${collector.stats.requests}, 실패 ${collector.stats.failures})`)
    }
    for (const p of parsed) p.songs = collector.groupTheme(p)

    // 2) 테마 특이성 — 이번에 안 돌린 테마는 DB에 저장된 share를 쓴다
    if (!DRY_RUN) await connectToMongoDB()
    const shares = (!DRY_RUN && ONLY) ? await themeService.loadShares(defs.map((d) => d.key)) : new Map()
    for (const p of parsed) {
        for (const s of p.songs) {
            if (!shares.has(s.songKey)) shares.set(s.songKey, new Map())
            const m = shares.get(s.songKey)
            m.set(p.def.key, Math.max(m.get(p.def.key) || 0, s.share))
        }
    }
    for (const p of parsed) {
        applySpecificity(p.def.key, p.songs, shares)
        p.songs.sort((a, b) => b.score - a.score)
    }

    // 3) 요약
    console.log(`\n수집 끝: 요청 ${collector.stats.requests}, 실패 ${collector.stats.failures}, ${Math.round((Date.now() - started) / 1000)}초`)
    for (const p of parsed) {
        const core = p.songs.filter((s) => s.tier === 'core')
        const explore = p.songs.filter((s) => s.tier === 'explore')
        p.ok = core.length >= MIN_CORE
        console.log(`\n## ${p.def.name} (${p.def.key}) — 플리 ${p.listCount}, core ${core.length}, explore ${explore.length}${p.ok ? '' : `  ⚠️ core ${MIN_CORE} 미만 → DB 반영 안 함`}`)
        core.slice(0, 10).forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.title} — ${s.artist} [${s.count}개, ${(s.spec * 100).toFixed(0)}%] ${s.videoId}`))
        if (DRY_RUN) {
            const sample = themeService.buildList(p.songs, 1)
            console.log(`  50곡 샘플(seed 1) ${sample.length}곡: ${sample.slice(0, 8).map((s) => `${s.title}(${s.tier[0]})`).join(' / ')} …`)
        }
    }

    if (DRY_RUN) {
        console.log('\n--dry-run: DB 반영 안 함')
        return
    }

    // 4) DB 반영
    await themeService.syncThemeDefinitions(themeDefinitions)
    for (const p of parsed) {
        if (!p.ok) continue
        const r = await themeService.applyRefresh(p.def.key, p.songs, { playlists: p.listCount })
        console.log(`[${p.def.key}] 반영: 신규 ${r.inserted}, 갱신 ${r.updated}, 감쇠 ${r.decayed}, 삭제 ${r.pruned} (감쇠계수 ${r.decay.toFixed(3)}) → 풀 core ${r.core} / explore ${r.explore}`)
    }
    const skipped = parsed.filter((p) => !p.ok).map((p) => p.def.key)
    if (skipped.length) {
        console.error(`\n⚠️ 반영 안 한 테마: ${skipped.join(', ')} — 차단·빈 응답 의심. 기존 풀은 그대로다`)
        process.exitCode = 1
    }
}

main()
    .catch((err) => {
        console.error(err)
        process.exitCode = 1
    })
    .finally(() => mongoose.disconnect())
