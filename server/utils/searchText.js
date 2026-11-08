/**
 * 검색용 글자 처리 (순수 함수) — 서버 검색 색인(searchService)과 웹 강조 표시가 같이 쓴다. 2026-11-08
 *   normalize   : 소문자 + 글자·숫자만 (띄어쓰기·기호 제거)        "아이유 (IU)" → "아이유iu"
 *   chosung     : 한글 음절 → 초성, 나머지는 그대로                 "아이유iu" → "ㅇㅇㅇiu"
 *   toJamo      : 자모 단위 분해(겹모음·겹받침도 쪼갬) — 오타 거리용  "와" → "ㅇㅗㅏ"
 *   engToKor    : 한영 키를 안 바꾸고 친 영문 → 한글(두벌식)         "dkdldb" → "아이유"
 *   isChosungOnly / fuzzyDistance(부분 문자열 편집 거리)
 */

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'
const JONG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ']
const BASE = 0xac00
const isSyllable = (c) => c >= '가' && c <= '힣'

// 겹모음·겹받침 ↔ 낱자
const JUNG_PAIRS = { ㅘ: 'ㅗㅏ', ㅙ: 'ㅗㅐ', ㅚ: 'ㅗㅣ', ㅝ: 'ㅜㅓ', ㅞ: 'ㅜㅔ', ㅟ: 'ㅜㅣ', ㅢ: 'ㅡㅣ' }
const JONG_PAIRS = { ㄳ: 'ㄱㅅ', ㄵ: 'ㄴㅈ', ㄶ: 'ㄴㅎ', ㄺ: 'ㄹㄱ', ㄻ: 'ㄹㅁ', ㄼ: 'ㄹㅂ', ㄽ: 'ㄹㅅ', ㄾ: 'ㄹㅌ', ㄿ: 'ㄹㅍ', ㅀ: 'ㄹㅎ', ㅄ: 'ㅂㅅ' }
const COMBINE_JUNG = Object.fromEntries(Object.entries(JUNG_PAIRS).map(([k, v]) => [v, k]))
const COMBINE_JONG = Object.fromEntries(Object.entries(JONG_PAIRS).map(([k, v]) => [v, k]))

function normalize(s) {
    return String(s || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
}

function chosung(s) {
    let out = ''
    for (const c of s) out += isSyllable(c) ? CHO[Math.floor((c.charCodeAt(0) - BASE) / 588)] : c
    return out
}

function toJamo(s) {
    let out = ''
    for (const c of s) {
        if (!isSyllable(c)) { out += JUNG_PAIRS[c] || JONG_PAIRS[c] || c; continue }
        const code = c.charCodeAt(0) - BASE
        const jong = JONG[code % 28]
        const jung = JUNG[Math.floor(code / 28) % 21]
        out += CHO[Math.floor(code / 588)] + (JUNG_PAIRS[jung] || jung) + (JONG_PAIRS[jong] || jong)
    }
    return out
}

const isChosungOnly = (s) => /^[ㄱ-ㅎ]+$/.test(s)

// ---------- 한영 자판 변환 (두벌식) ----------
const KEYMAP = {
    q: 'ㅂ', w: 'ㅈ', e: 'ㄷ', r: 'ㄱ', t: 'ㅅ', y: 'ㅛ', u: 'ㅕ', i: 'ㅑ', o: 'ㅐ', p: 'ㅔ',
    a: 'ㅁ', s: 'ㄴ', d: 'ㅇ', f: 'ㄹ', g: 'ㅎ', h: 'ㅗ', j: 'ㅓ', k: 'ㅏ', l: 'ㅣ',
    z: 'ㅋ', x: 'ㅌ', c: 'ㅊ', v: 'ㅍ', b: 'ㅠ', n: 'ㅜ', m: 'ㅡ',
    Q: 'ㅃ', W: 'ㅉ', E: 'ㄸ', R: 'ㄲ', T: 'ㅆ', O: 'ㅒ', P: 'ㅖ',
}
const isVowel = (j) => JUNG.includes(j)
const syll = (cho, jung, jong) => String.fromCharCode(BASE + (CHO.indexOf(cho) * 21 + JUNG.indexOf(jung)) * 28 + JONG.indexOf(jong || ''))

/** 영문 자판 입력 → 한글. 영문자 외 글자가 있거나 한글 음절이 하나도 안 나오면 null */
function engToKor(input) {
    if (!/^[a-zA-Z]+$/.test(input)) return null
    const jamos = [...input].map((ch) => KEYMAP[ch] || KEYMAP[ch.toLowerCase()])
    let out = ''
    let cho = null
    let jung = null
    let jong = null
    const flush = () => {
        if (cho && jung) out += syll(cho, jung, jong)
        else out += (cho || '') + (jung || '')
        cho = jung = jong = null
    }
    for (const j of jamos) {
        if (!isVowel(j)) {
            if (!jung) { if (cho) flush(); cho = j } // 자음 다음 자음(모음 없음)
            else if (!cho) { flush(); cho = j } // 홀모음 다음 자음
            else if (!jong) { if (JONG.includes(j)) jong = j; else { flush(); cho = j } } // ㄸㅃㅉ는 받침 불가
            else if (COMBINE_JONG[jong + j]) jong = COMBINE_JONG[jong + j]
            else { flush(); cho = j }
        } else if (jong) {
            // 받침 뒤 모음 → 받침(겹받침이면 뒤 낱자)이 다음 음절 초성으로 넘어간다
            const pair = JONG_PAIRS[jong]
            const keep = pair ? pair[0] : null
            const move = pair ? pair[1] : jong
            out += syll(cho, jung, keep)
            cho = move
            jung = j
            jong = null
        } else if (jung) {
            if (COMBINE_JUNG[jung + j]) jung = COMBINE_JUNG[jung + j]
            else { flush(); jung = j }
        } else {
            jung = j
        }
    }
    flush()
    return /[가-힣]/.test(out) ? out : null
}

/**
 * 부분 문자열 편집 거리(Sellers) — pattern 이 text 의 어딘가와 몇 글자 차이로 맞나. max 를 넘으면 일찍 끊는다.
 * 한글은 toJamo 로 쪼갠 뒤 넣는다 — "아이우" 와 "아이유" 가 음절로는 1, 자모로도 1(ㅜ↔ㅠ)이지만
 * "사랑헤" 와 "사랑해" 처럼 받침·모음 하나 틀린 걸 음절 단위보다 정확히 잡는다
 */
function fuzzyDistance(pattern, text, max = 2) {
    const m = pattern.length
    if (!m) return 0
    let prev = new Array(m + 1)
    for (let i = 0; i <= m; i++) prev[i] = i
    let best = prev[m]
    for (let j = 1; j <= text.length; j++) {
        const cur = new Array(m + 1)
        cur[0] = 0 // 어디서 시작해도 됨
        for (let i = 1; i <= m; i++) {
            const cost = pattern[i - 1] === text[j - 1] ? 0 : 1
            cur[i] = Math.min(prev[i] + 1, cur[i - 1] + 1, prev[i - 1] + cost)
        }
        if (cur[m] < best) best = cur[m]
        prev = cur
        if (best === 0) return 0
    }
    return best <= max ? best : max + 1
}

module.exports = { normalize, chosung, toJamo, engToKor, isChosungOnly, fuzzyDistance }
