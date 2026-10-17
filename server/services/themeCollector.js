/**
 * 테마 플레이리스트 수집기 — 유튜브 사용자 플레이리스트를 모아 "여러 리스트에 겹치는 곡"을 센다.
 *
 * DB를 모른다(순수 수집·집계). DB 반영은 themeService.applyRefresh, 실행은 scripts/refresh-themes.js.
 * 나중에 크론으로 쪼개 돌릴 때도 이 모듈을 그대로 쓴다. 알고리즘 설명은 docs/THEME_PLAYLIST.md
 */
const fs = require('fs')
const path = require('path')
const axios = require('axios')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36'
const PLAYLIST_FILTER = 'EgIQAw%253D%253D' // 검색 결과를 플레이리스트로 한정
const PER_QUERY = 10

const MAX_DURATION = 480 // 8분 초과 = 1시간 모음 영상 등
const MIN_DURATION = 90

// 플레이리스트 제목이 해외곡 위주임을 나타내는 표현
const FOREIGN_PL = /팝송|pop\s*song|재즈|jazz|j-?pop|제이팝|일본|시티팝|city\s*pop|도쿄|lo-?fi|로파이|피아노|piano|classic|클래식|bossa|보사노바|bgm|매장음악/i
const JUNK = /\b(official|m\/?v|music video|lyrics?|lyric video|audio|visualizer|teaser|4k|hd|eng|sub|cc|color coded|han|rom)\b|가사|뮤비|뮤직비디오|공식|자막/gi
const NONSONG = /플레이리스트|playlist|플리|모음|연속\s*듣기|1\s*시간|hours?|광고\s*없는|노동요|compilation|top\s*\d+|베스트\s*\d+/i
const BADVIDEO = /live|라이브|clip|cover|커버|remix|sped|slowed|reverb|8d|but you|edit|fmv|교차편집|직캠|fancam|stage|무대|inst|karaoke|노래방|practice|안무|dance ver|behind|reaction|\bai\b|자작곡/i
// 레이블·방송 채널 — 채널명을 아티스트로 쓰면 안 된다
const LABEL_CH = /entertainment|ent\.?$|1thek|원더케이|stone music|smtown|jyp|hybe|kakao|genie|warner|워너뮤직|brandnew music|mnet|kbs|mbc|sbs|jtbc|dingo|딩고|pocketdol|kdrama|ost\b|loen|cj\s*e&m|universal|sony music/i
const HANGUL = /[가-힣]/
const ARTIST_STOP = /^(official|topic|vevo|music|channel|tv|공식|채널|오피셜|feat|ft|with|and)$/

const norm = (s) => s.toLowerCase().replace(JUNK, ' ').replace(/[^0-9a-z가-힣]+/g, '')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ytInitialData 트리에서 특정 키를 전부 모은다 (유튜브 렌더러 구조가 자주 바뀌어 경로 대신 키로 찾는다)
function collect(o, key, acc = []) {
    if (o && typeof o === 'object') {
        for (const [k, v] of Object.entries(o)) {
            if (k === key) acc.push(v)
            collect(v, key, acc)
        }
    }
    return acc
}
const badges = (l) => collect(l, 'thumbnailBadgeViewModel').map((b) => b.text).filter(Boolean)
const metaParts = (l) => collect(l && l.metadata, 'metadataParts').flat().map((p) => p && p.text && p.text.content).filter(Boolean)
const lockupTitle = (l) => (l.metadata && l.metadata.lockupMetadataViewModel && l.metadata.lockupMetadataViewModel.title && l.metadata.lockupMetadataViewModel.title.content) || ''
function toSec(t) {
    const p = t.split(':').map(Number)
    return p.length < 2 || p.some(isNaN) ? null : p.reduce((a, b) => a * 60 + b, 0)
}

// ---------- 표시용 정리 ----------
function cleanTitle(s) {
    s = s.replace(/['"‘’“”]/g, ' ')
        .replace(/\([^)]*(가사|해석|번역|lyrics|full)[^)]*\)/gi, ' ')
        .replace(/\b(official\s*)?(m\/v|mv|music video|video|audio|visualizer|lyrics?(\s*video)?)\b/gi, ' ')
        .replace(/\|.*$/, ' ').replace(/\(\s*\)/g, ' ')
    // 짝 안 맞는 괄호 정리
    while ((s.match(/\)/g) || []).length > (s.match(/\(/g) || []).length) s = s.replace(/\)(?!.*\))/, '')
    while ((s.match(/\(/g) || []).length > (s.match(/\)/g) || []).length) s = s.replace(/\((?!.*\()/, '')
    return s.replace(/\s{2,}/g, ' ').replace(/^[\s-]+|[\s-]+$/g, '').trim()
}
function cleanArtist(s) {
    s = s.replace(/\s*-\s*topic$/i, '')
    const offBr = s.match(/\[([^\]]*)\bofficial\b[^\]]*\]/i) // "이지금 [IU Official]" → "IU"
    if (offBr && offBr[1].trim()) return offBr[1].trim()
    return s.replace(/\[[^\]]*\]|\(\s*youtube channel\s*\)/gi, ' ')
        .replace(/^채널\s+|'s channel$|^official(?=[a-z])/gi, '') // "채널 조정석", "RAIN's Channel", "officialpsy"
        .replace(/\bofficial\b|공식\s*채널|공식|vevo/gi, ' ')
        .replace(/\s{2,}/g, ' ').replace(/^[\s\-_|/]+|[\s\-_|/]+$/g, '').trim()
}

function createCollector({ cacheDir = null, log = console.error } = {}) {
    const stats = { requests: 0, failures: 0 }

    // ---------- 요청 (+ 선택적 파일 캐시) ----------
    async function getData(url, cacheKey) {
        const file = cacheDir && path.join(cacheDir, `${cacheKey}.json`)
        if (file && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'))
        await sleep(1000 + Math.random() * 1000)
        stats.requests++
        const res = await axios.get(url, {
            headers: { 'User-Agent': UA, 'Accept-Language': 'ko-KR,ko;q=0.9' },
            responseType: 'text',
            timeout: 15000,
        })
        const m = String(res.data).match(/var ytInitialData = (\{.*?\});<\/script>/s)
        if (!m) { stats.failures++; throw new Error(`ytInitialData 없음 (${res.status})`) }
        if (file) fs.writeFileSync(file, m[1])
        return JSON.parse(m[1])
    }

    async function searchPlaylists(q) {
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=${PLAYLIST_FILTER}`
        const d = await getData(url, 's_' + Buffer.from(q).toString('hex').slice(0, 60))
        return collect(d, 'lockupViewModel')
            .filter((l) => l.contentType === 'LOCKUP_CONTENT_TYPE_PLAYLIST')
            .slice(0, PER_QUERY)
            .map((l) => ({ id: l.contentId, title: lockupTitle(l), channel: metaParts(l)[0] || '' }))
    }

    async function playlistItems(id) {
        const d = await getData(`https://www.youtube.com/playlist?list=${id}`, 'p_' + id)
        return collect(d, 'lockupViewModel')
            .filter((l) => l.contentType === 'LOCKUP_CONTENT_TYPE_VIDEO')
            .map((l) => ({
                videoId: l.contentId,
                title: lockupTitle(l),
                channel: metaParts(l)[0] || '',
                dur: badges(l).map(toSec).find((x) => x != null) ?? null,
            }))
    }

    // ---------- 아티스트 별칭 (헤이즈 ↔ heize) — 한 실행 안에서 전 테마가 공유 ----------
    const alias = new Map()
    const afind = (x) => {
        if (!alias.has(x)) alias.set(x, x)
        if (alias.get(x) === x) return x
        alias.set(x, afind(alias.get(x)))
        return alias.get(x)
    }
    function artistTokens(s, learn = false) {
        if (!s) return []
        s = s.replace(/\s*-\s*topic$/i, '').replace(/\bofficial\b|vevo|공식\s*채널|공식/gi, ' ')
        const paren = [...s.matchAll(/\(([^)]*)\)|\[([^\]]*)\]/g)].map((m) => m[1] ?? m[2])
        const base = s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
        // "X x Y" 협업 표기는 공백으로 둘러싸인 x만 — 그냥 [x]로 자르면 "EXO"가 "E"/"O"로 쪼개진다
        const parts = (x) => x.split(/,|&|×|\s[x×]\s|\/|\bfeat\.?|\bft\.?|\band\b|\bwith\b|\s{2,}/i).map(norm).filter((t) => t.length >= 2 && !ARTIST_STOP.test(t))
        const b = parts(base)
        const p = paren.flatMap(parts)
        if (learn && b.length === 1 && p.length === 1) alias.set(afind(b[0]), afind(p[0]))
        const words = base.split(/\s+/).map(norm).filter((t) => t.length >= 2 && !ARTIST_STOP.test(t))
        return [...new Set([...b, ...p, ...words])]
    }

    // 영상 제목 → 제목 키 / 아티스트
    function parseVideo(it) {
        let t = it.title.replace(/【[^】]*】/g, ' ')
        const topic = /-\s*topic$/i.test(it.channel)
        const label = LABEL_CH.test(it.channel)
        const officialCh = label || /official|공식|bangtantv/i.test(it.channel)
        let artistStr = ''
        let strong = false
        const br = t.match(/^\s*\[([^\]]+)\]\s*/) // [MV] 또는 [아티스트]
        if (br) t = t.slice(br[0].length)
        t = t.replace(/\[[^\]]*\]/g, ' ')
        const quote = t.match(/^(.{1,40}?)\s*['‘"“]([^'’"”]{1,60})['’"”]/) // 태연 'Rain' MV
        const dash = t.split(/\s[-–—_]\s|\s_\s/)
        if (quote && quote[1].trim()) { artistStr = quote[1]; t = quote[2]; strong = true }
        else if (dash.length >= 2) { artistStr = dash[0]; t = dash.slice(1).join(' '); strong = true }
        else if (topic) { artistStr = it.channel; strong = true }
        else if (officialCh && !label) { artistStr = it.channel; strong = true }
        else { artistStr = label ? '' : it.channel }
        if (br && !/^(mv|m\/v|official|audio|teaser|special|live|playlist|가사|lyrics)/i.test(br[1].trim()) && dash.length < 2 && !quote) {
            artistStr = br[1]; strong = true
        }
        t = t.replace(/\(?\s*(feat|ft|prod|with)\.?[^)]*\)?/gi, ' ')
        const paren = [...t.matchAll(/\(([^)]*)\)/g)].map((m) => norm(m[1])).filter((x) => x.length >= 2)
        const main = norm(t.replace(/\([^)]*\)/g, ' '))
        // 표기 차이 흡수: 한글만 / 영문만 ("비도 오고 그래서 You, Clouds, Rain" ↔ "비도 오고 그래서 (You, Clouds, Rain)")
        const full = norm(t)
        const hangulOnly = full.replace(/[^가-힣]/g, '')
        const latinOnly = full.replace(/[^a-z]/g, '')
        const keys = [...new Set([main, ...paren, hangulOnly.length >= 3 ? hangulOnly : '', latinOnly.length >= 5 ? latinOnly : ''])]
            .filter((k) => k.length >= 2 && !/^(ver|version|acoustic|remix|inst|cover|\d+|official|audio)$/.test(k))
        artistTokens(artistStr, true)
        return { keys, main, artistStr: artistStr.trim(), strong, display: cleanTitle(t), topic, officialCh, label }
    }

    // ---------- 1단계: 테마 하나 수집 (요청 발생) ----------
    async function collectTheme(def) {
        const pls = new Map()
        for (const q of def.queries) {
            try {
                for (const p of await searchPlaylists(q)) if (!pls.has(p.id)) pls.set(p.id, p)
            } catch (e) { log(`[${def.key}] 검색 실패 "${q}": ${e.message}`) }
        }
        const lists = []
        for (const p of pls.values()) {
            try { lists.push({ ...p, items: await playlistItems(p.id) }) }
            catch (e) { log(`[${def.key}] 플리 건너뜀 ${p.id}: ${e.message}`) }
        }
        return lists
    }

    // ---------- 2단계: 항목 정리 (별칭 학습 포함 — 전 테마를 다 돌린 뒤 3단계로) ----------
    function parseTheme(def, lists) {
        const dropped = { long: 0, short: 0, nonsong: 0 }
        const entries = []
        for (const pl of lists) {
            pl.relevant = def.keywords.test(pl.title)
            pl.foreign = FOREIGN_PL.test(pl.title)
            pl.weight = (pl.relevant ? 1 : 0.3) * (pl.foreign ? 0.3 : 1) / Math.log2(2 + (pl.items.length || 1) / 10)
            for (const it of pl.items) {
                if (it.dur == null || it.dur > MAX_DURATION) { dropped.long++; continue }
                if (it.dur < MIN_DURATION) { dropped.short++; continue }
                if (NONSONG.test(it.title)) { dropped.nonsong++; continue }
                const v = parseVideo(it)
                if (v.keys.length) entries.push({ pl, it, v })
            }
        }
        return { entries, dropped, listCount: lists.length }
    }

    // ---------- 3단계: 같은 곡 묶기 → 점수 → 등급 ----------
    function groupTheme({ entries, listCount }) {
        for (const e of entries) e.tok = new Set(artistTokens(e.v.artistStr).map(afind))
        const compatible = (a, b) => { for (const t of a.tok) if (b.tok.has(t)) return true; return false }

        // 같은 곡 = 제목 키 공유 && 아티스트 토큰 공유 (업로더 채널명도 토큰으로 참여 — 맞을 때만 합쳐진다)
        const par = entries.map((_, i) => i)
        const find = (i) => (par[i] === i ? i : (par[i] = find(par[i])))
        const byKey = new Map()
        entries.forEach((e, i) => e.v.keys.forEach((k) => {
            if (!byKey.has(k)) byKey.set(k, [])
            byKey.get(k).push(i)
        }))
        for (const idx of byKey.values()) {
            for (let a = 0; a < idx.length; a++) {
                for (let b = a + 1; b < idx.length; b++) {
                    if (compatible(entries[idx[a]], entries[idx[b]])) par[find(idx[a])] = find(idx[b])
                }
            }
        }
        // 아티스트 정보가 아예 없는 항목(레이블 채널 + 제목에 아티스트 없음)만 같은 키의 최대 그룹에 붙인다
        const size = new Map()
        entries.forEach((e, i) => size.set(find(i), (size.get(find(i)) || 0) + 1))
        entries.forEach((e, i) => {
            if (e.tok.size) return
            const cands = [...new Set(e.v.keys.flatMap((k) => byKey.get(k)).filter((j) => entries[j].tok.size).map(find))]
            if (cands.length) par[find(i)] = cands.sort((a, b) => (size.get(b) || 0) - (size.get(a) || 0))[0]
        })

        const groups = new Map()
        entries.forEach((e, i) => {
            const r = find(i)
            if (!groups.has(r)) groups.set(r, { plIds: new Set(), score: 0, videos: new Map(), names: new Map(), artists: new Map(), toks: new Map(), mains: new Map(), nForeign: 0, hangul: false, fromRelevant: false })
            const g = groups.get(r)
            if (!g.plIds.has(e.pl.id)) {
                g.plIds.add(e.pl.id)
                g.score += e.pl.weight
                if (e.pl.foreign) g.nForeign++
                if (e.pl.relevant && !e.pl.foreign) g.fromRelevant = true
            }
            const v = g.videos.get(e.it.videoId) || { ...e.it, ...e.v, n: 0 }
            v.n++
            g.videos.set(e.it.videoId, v)
            g.names.set(e.v.display, (g.names.get(e.v.display) || 0) + 1)
            g.mains.set(e.v.main, (g.mains.get(e.v.main) || 0) + 1)
            for (const t of e.tok) g.toks.set(t, (g.toks.get(t) || 0) + 1)
            // 표시용 아티스트: Topic 채널명이 가장 정확, 그다음 제목에서 뽑은 이름. 레이블 채널명은 제외
            const an = cleanArtist(e.v.artistStr)
            if (an && !LABEL_CH.test(an)) g.artists.set(an, (g.artists.get(an) || 0) + (e.v.topic ? 3 : e.v.strong ? 1 : 0.2))
            if (HANGUL.test(e.it.title + e.it.channel)) g.hangul = true
        })

        const top = (m) => ([...m.entries()].sort((a, b) => b[1] - a[1])[0] || [''])[0]
        const rank = (v) => (BADVIDEO.test(v.title) ? -10 : 0) + (v.topic ? 3 : 0) + (v.officialCh ? 2 : 0) + Math.min(v.n, 3)
        const songs = []
        for (const g of groups.values()) {
            const video = [...g.videos.values()].sort((a, b) => rank(b) - rank(a))[0]
            const count = g.plIds.size
            // 해외곡: 한글 흔적이 없고 주로 해외성향 리스트에서 나온 곡 → 0.5배 (빼지 않고 조금만)
            const foreign = !g.hangul && g.nForeign / count >= 0.5
            let tier = null
            if (count >= 2) tier = 'core'
            // 탐색: 1회 등장 + 테마 제목이 맞는 국내 리스트 출신 + Topic/공식 영상 (AI 채널·엉뚱한 플리 출신 차단)
            else if (g.fromRelevant && !foreign && (video.topic || video.officialCh) && !BADVIDEO.test(video.title)) tier = 'explore'
            if (!tier) continue
            songs.push({
                songKey: `${top(g.mains)}|${top(g.toks)}`,
                videoId: video.videoId,
                title: top(g.names),
                artist: top(g.artists) || cleanArtist(video.channel),
                duration: video.dur,
                count,
                share: count / listCount,
                score: g.score * (foreign ? 0.5 : 1),
                foreign,
                tier,
            })
        }
        // 서로 다른 그룹이 같은 영상을 대표로 고른 경우 점수 높은 쪽만
        const byVideo = new Map()
        for (const s of songs) {
            const prev = byVideo.get(s.videoId)
            if (!prev || prev.score < s.score) byVideo.set(s.videoId, s)
        }
        return [...byVideo.values()].sort((a, b) => b.score - a.score)
    }

    return { collectTheme, parseTheme, groupTheme, stats }
}

/**
 * 테마 특이성 — 어느 테마에나 나오는 곡(밤편지 등)을 깎는다.
 * spec = 이 테마 share / 전 테마 share 합, 최종 점수 = 점수 × √spec
 * @param {Map<string, Map<string, number>>} shares songKey → (themeKey → share)
 */
function applySpecificity(themeKey, songs, shares) {
    for (const s of songs) {
        const m = shares.get(s.songKey)
        const mine = (m && m.get(themeKey)) || s.share
        let sum = 0
        if (m) for (const v of m.values()) sum += v
        s.spec = sum > 0 ? mine / sum : 1
        s.score = s.score * Math.sqrt(s.spec)
    }
    return songs
}

module.exports = { createCollector, applySpecificity }
