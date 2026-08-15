/**
 * artist-youtube.jsonl → 유튜브 후보를 눈으로 고르는 로컬 HTML. (요청/DB 없음)
 *
 * **로컬 파일로 여는 걸 전제로 한다.** 유튜브 썸네일과 임베드 플레이어를 쓰기 때문이다
 * (아티팩트로 올리면 외부 리소스가 차단돼 둘 다 안 뜬다). `file://` 로 열면 임베드가
 * 오류 153으로 거부하므로 scripts/serve-review.js 로 띄운다.
 *
 * 볼 분량을 줄이려고 판정별로 나눈다. 맨 위가 **사람이 실제로 확인해야 하는 것**이다.
 *
 * 고른 결과는 `선택 저장` 으로 서버에 보내 data/youtube-choices.json 이 된다.
 * 체크만 해두면 브라우저 안에만 남아 넘겨줄 방법이 없기 때문이다.
 *
 * 사용법:
 *   node scripts/report-youtube.js
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const IN_FILE = path.join(DATA_DIR, 'artist-youtube.jsonl')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const OUT_FILE = arg('out', path.join(DATA_DIR, 'youtube-review.html'))

const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const mmss = s => s == null ? '?' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

const rows = fs.readFileSync(IN_FILE, 'utf8').split('\n').filter(Boolean).map(JSON.parse)
const pickOf = r => r.candidates.find(c => c.videoId === r.pick)

// 스크립트가 더 못 걸러낸 곡을 하나씩 보고 내린 결정(apply-decisions.js 가 얹는다).
const decided = r => r.decidedBy && r.decidedBy.startsWith('claude')

/**
 * 공식 채널이 **영문 제목만** 써서 제목 대조가 실패한 경우를 찾아낸다.
 *   `플레어 (Flare)` ↔ `Flare`,  `반딧불이` ↔ `Fireflies`,  `촛불` ↔ `Candle`
 *
 * ⚠️ 자동으로 바꾸면 안 된다. 같은 조건으로 `변신` ↔ `Montage`(-2초),
 * `ULTIMATE` ↔ `KICK OUT`(-1초) 같은 **다른 곡**도 걸린다. 한 앨범 안에 3~4분짜리가
 * 몰려 있어서 길이는 우연히 맞는다. 영문 제목 대응표가 없으면 기계는 둘을 구분 못 한다.
 */
const assigned = new Set(rows.filter(r => r.include && r.pick).map(r => r.pick))
const officialAlt = r => r.bugsDuration ? r.candidates.filter(c =>
    !c.titleMatch && c.officialChannel && !c.negative
    && c.diff != null && Math.abs(c.diff) <= 3
    && c.videoId !== r.pick && !assigned.has(c.videoId)) : []

const bucketOf = r => decided(r) && r.include ? 'decided'
    : !r.include ? 'drop'
        : officialAlt(r).length && !pickOf(r)?.officialChannel ? 'official'
            : (pickOf(r)?.officialChannel ? 'auto' : 'skim')

const BUCKETS = [
    ['decided', '내가 판단한 곡 — 여기만 보시면 됩니다', '스크립트가 1차로 거른 뒤 <b>남은 곡을 하나씩 보고 정한 것</b>입니다. 각 곡에 그렇게 정한 이유를 적어뒀습니다. 동의하지 않으시면 다른 후보를 고르거나 제외하세요.'],
    ['drop', '적재하지 않음', '근거가 부족하거나 유튜브에 원곡 음원이 없는 곡입니다. <b>틀린 영상이 붙으면 재생했을 때 다른 노래가 나오므로, URL 없이 두는 것보다 나쁩니다.</b> 살릴 만한 후보가 보이면 직접 고르세요.'],
    ['official', '공식 채널 후보 있음', '공식 채널이 <b>영문 제목만</b> 써서 제목 대조가 실패한 곡입니다. 남아 있다면 제가 <b>다른 곡이라 판단해 일부러 두지 않은 것</b>입니다.'],
    ['skim', '한 번 훑기', '제목·아티스트·길이가 다 맞지만 공식 채널이 아닙니다. 음원이 맞는지만 확인하세요.'],
    ['auto', '자동 통과', '제목·아티스트가 맞고 공식 채널 또는 유튜브가 유통사 음원으로 자동 생성한 <code>- Topic</code> 채널입니다.'],
]

const radioName = r => 'c-' + (r.title + r.artist).replace(/[^a-zA-Z0-9가-힣]/g, '')

const card = r => {
    const b = bucketOf(r)
    const why = r.decidedWhy ? `<p class="flagnote lv-${r.include ? 'mid' : 'high'}"><b>${r.decidedBy === 'claude:drop' ? '제외한 이유' : r.decidedBy === 'claude:keep' ? '그대로 둔 이유' : '바꾼 이유'}</b> — ${esc(r.decidedWhy)}</p>` : ''
    return `
<article class="song" data-b="${b}" data-q="${esc((r.title + ' ' + r.artist).toLowerCase())}" data-key="${esc(r.title + '|||' + r.artist)}">
  <div class="head">
    <div class="meta">
      <h3>${esc(r.title)}</h3>
      <p>${esc(r.artist)}${r.album ? ' · ' + esc(r.album) : ''} · 벅스 <b>${mmss(r.bugsDuration)}</b>
        ${r.detailLink ? `· <a href="${esc(r.detailLink)}" target="_blank" rel="noopener">벅스 ↗</a>` : ''}
        ${r.source === 'existing' ? '<span class="tag">기존 DB</span>' : ''}</p>
    </div>
    <div class="state"><span class="v v-${r.verdict}">${r.verdict}</span><span class="chosen"></span></div>
  </div>
  ${why}
  <div class="cands">
    ${r.candidates.slice(0, b === 'auto' ? 4 : 7).map(c => `
    <label class="cand${c.videoId === r.pick ? ' picked' : ''}">
      <input type="radio" name="${radioName(r)}" value="${esc(c.videoId)}"${c.videoId === r.pick && b !== 'drop' ? ' checked' : ''}>
      <img src="https://i.ytimg.com/vi/${esc(c.videoId)}/mqdefault.jpg" alt="" loading="lazy">
      <div class="ci">
        <div class="ct">${esc(c.vtitle)}</div>
        <div class="cm">
          ${c.officialChannel ? '<b class="offmark">공식</b>' : ''}<span class="ch${c.officialChannel ? ' off' : ''}">${esc(c.channel)}</span>
          <span class="dur">${esc(c.duration)}</span>
          <span class="diff ${c.diff == null ? '' : Math.abs(c.diff) <= 5 ? 'good' : Math.abs(c.diff) <= 15 ? 'mid' : 'bad'}">${c.diff == null ? '길이 비교 불가' : (c.diff > 0 ? '+' : '') + c.diff + '초'}</span>
          ${c.negative ? '<span class="neg">음원 아닐 수 있음</span>' : ''}
          ${c.titleMatch ? '' : '<span class="neg">제목 불일치</span>'}
          ${c.artistMatch ? '' : '<span class="neg">아티스트 불일치</span>'}
        </div>
      </div>
      <span class="acts">
        <button type="button" class="play" data-v="${esc(c.videoId)}">▶ 듣기</button>
        <a class="ext" href="https://www.youtube.com/watch?v=${esc(c.videoId)}" target="_blank" rel="noopener" title="유튜브에서 열기">↗</a>
      </span>
    </label>`).join('')}
    <label class="cand drop">
      <input type="radio" name="${radioName(r)}" value=""${b === 'drop' ? ' checked' : ''}>
      <div class="ci"><div class="ct">이 곡은 적재하지 않음 — 맞는 영상이 없음${b === 'drop' ? ' (기본 선택)' : ''}</div></div>
    </label>
  </div>
</article>`
}

const counts = { decided: 0, drop: 0, official: 0, skim: 0, auto: 0 }
rows.forEach(r => counts[bucketOf(r)]++)
const included = rows.filter(r => r.include).length

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>유튜브 매칭 검토 — 국카스텐 · 터치드 · 하현우 · 윤민</title>
<style>
:root{--paper:#F4F3F8;--surface:#fff;--ink:#17161F;--muted:#6A6580;--line:#E1DFEA;--line-soft:#EDEBF3;
--accent:#4B3BD1;--accent-soft:#EEEBFC;--ok:#1F7A54;--warn:#A3541B;--bad:#B03030;}
@media (prefers-color-scheme:dark){:root{--paper:#121118;--surface:#1B1A23;--ink:#E9E7F1;--muted:#9B96AC;
--line:#2B2936;--line-soft:#232230;--accent:#9C8FFF;--accent-soft:#221F3A;--ok:#5FCA9B;--warn:#E0A268;--bad:#F08A8A;}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-size:14px;line-height:1.5;
font-family:"Segoe UI Variable Text","Segoe UI","Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif}
.wrap{max-width:1080px;margin:0 auto;padding:24px 18px 120px}
h1{margin:0 0 6px;font-size:23px;font-weight:650;letter-spacing:-.02em}
.sub{margin:0 0 18px;color:var(--muted)}
.bar{position:sticky;top:0;z-index:20;background:var(--paper);border-bottom:1px solid var(--line);
padding:10px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.bar button{appearance:none;background:var(--surface);border:1px solid var(--line);color:var(--muted);
border-radius:999px;padding:5px 13px;font:inherit;font-size:13px;cursor:pointer}
.bar button[aria-pressed="true"]{background:var(--accent);border-color:var(--accent);color:#fff}
.bar .save{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:600;margin-left:auto}
.bar input[type=search]{flex:1 1 170px;min-width:140px;background:var(--surface);color:var(--ink);
border:1px solid var(--line);border-radius:3px;padding:6px 10px;font:inherit}
.prog{font-variant-numeric:tabular-nums;color:var(--muted);font-size:13px}
section h2{font-size:15px;margin:26px 0 4px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
section h2 .c{font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
section p.note{margin:0 0 12px;color:var(--muted);font-size:13px}
section.folded .song{display:none}
.fold{appearance:none;background:none;border:1px solid var(--line);border-radius:3px;color:var(--muted);
font:inherit;font-size:12px;padding:2px 9px;cursor:pointer}
.song{background:var(--surface);border:1px solid var(--line);border-radius:4px;margin:0 0 10px;overflow:hidden}
.song.done{border-color:var(--ok)}
.head{display:flex;gap:12px;justify-content:space-between;padding:11px 13px;border-bottom:1px solid var(--line-soft);flex-wrap:wrap}
.head h3{margin:0;font-size:15px;font-weight:600}
.head p{margin:2px 0 0;color:var(--muted);font-size:12.5px}
.head a{color:var(--accent)}
.state{display:flex;gap:6px;align-items:center;white-space:nowrap}
.v{font-size:11px;border:1px solid var(--line);border-radius:2px;padding:1px 7px;color:var(--muted)}
.v-확실{border-color:var(--ok);color:var(--ok)} .v-애매{border-color:var(--warn);color:var(--warn)}
.chosen{font-size:11.5px;color:var(--ok)}
.tag{font-size:11px;border:1px solid var(--line);border-radius:2px;padding:0 5px;margin-left:5px}
.flagnote{margin:0;padding:9px 13px;font-size:12.5px;border-bottom:1px solid var(--line-soft);
background:var(--accent-soft);border-left:3px solid var(--warn)}
.flagnote.lv-high{border-left-color:var(--bad)}
.flagnote code{background:rgba(128,128,128,.18);padding:0 4px;border-radius:2px}
.cands{display:flex;flex-direction:column}
.cand{display:flex;gap:10px;align-items:center;padding:8px 13px;border-bottom:1px solid var(--line-soft);cursor:pointer}
.cand:last-child{border-bottom:0}
.cand:hover{background:var(--accent-soft)}
.cand input{margin:0;flex:none}
.cand img{width:88px;height:50px;object-fit:cover;border-radius:2px;background:var(--line-soft);flex:none}
.ci{flex:1;min-width:0}
.ct{font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cm{display:flex;gap:8px;flex-wrap:wrap;font-size:11.5px;color:var(--muted);margin-top:2px;align-items:center}
.ch.off{color:var(--ok);font-weight:600}
.offmark{background:var(--ok);color:#fff;font-size:10px;padding:0 5px;border-radius:2px;font-weight:700}
.dur,.diff{font-variant-numeric:tabular-nums}
.diff.good{color:var(--ok)} .diff.mid{color:var(--warn)} .diff.bad{color:var(--bad)}
.neg{color:var(--bad)}
.acts{display:flex;gap:4px;align-items:center;flex:none}
.play{appearance:none;background:none;border:1px solid var(--line);border-radius:3px;color:var(--accent);
font:inherit;font-size:12px;padding:3px 9px;cursor:pointer}
.ext{border:1px solid var(--line);border-radius:3px;color:var(--muted);font-size:12px;padding:3px 7px;text-decoration:none}
.ext:hover{color:var(--accent)}
.drop .ct{color:var(--bad)}
#filewarn{display:none;background:#B03030;color:#fff;padding:9px 13px;border-radius:4px;margin:0 0 14px;font-size:13px}
#filewarn code{background:rgba(0,0,0,.25);padding:1px 6px;border-radius:2px}
#player{position:fixed;right:16px;bottom:16px;width:380px;max-width:calc(100vw - 32px);z-index:50;
background:#000;border-radius:4px;overflow:hidden;box-shadow:0 8px 28px rgba(0,0,0,.4);display:none}
#player iframe{display:block;width:100%;height:214px;border:0}
#player .close{position:absolute;right:4px;top:4px;background:rgba(0,0,0,.6);color:#fff;border:0;
border-radius:3px;padding:2px 8px;cursor:pointer;font:inherit}
</style></head><body>
<div class="wrap">
<h1>유튜브 매칭 검토</h1>
<div id="filewarn">
  <b>파일로 직접 열면 재생이 안 됩니다</b> — 유튜브 임베드가 <code>file://</code> 을 거부합니다(오류 153).
  <code>node scripts/serve-review.js</code> 를 실행하고 <code>http://127.0.0.1:4321/youtube-review.html</code> 로 여세요.
</div>
<p class="sub">${rows.length}곡 중 <b>${included}곡 적재</b>, ${rows.length - included}곡 제외.
판정 순서는 <b>제목·아티스트 일치(필수) → 공식 채널 → 길이</b>입니다.
길이 차이가 ±5초 이내면 같은 음원일 가능성이 높고, 크게 벌어지면 라이브·다른 버전입니다.</p>

<div class="bar">
  <button data-f="all" aria-pressed="true">전체 <span class="c">${rows.length}</span></button>
  <button data-f="decided" aria-pressed="false">내가 판단함 <span class="c">${counts.decided}</span></button>
  <button data-f="drop" aria-pressed="false">적재 안 함 <span class="c">${counts.drop}</span></button>
  <button data-f="official" aria-pressed="false">공식 후보 <span class="c">${counts.official}</span></button>
  <button data-f="skim" aria-pressed="false">훑기 <span class="c">${counts.skim}</span></button>
  <button data-f="auto" aria-pressed="false">자동 <span class="c">${counts.auto}</span></button>
  <input type="search" id="q" placeholder="곡 검색" autocomplete="off">
  <span class="prog" id="prog"></span>
  <button class="save" id="save">선택 저장</button>
</div>

${BUCKETS.map(([b, name, note]) => `
<section id="s-${b}" class="${b === 'auto' || b === 'skim' ? 'folded' : ''}">
  <h2>${name} <span class="c">${counts[b]}곡</span>
    <button class="fold" data-s="${b}">${b === 'auto' || b === 'skim' ? '펼치기' : '접기'}</button></h2>
  <p class="note">${note}</p>
  ${rows.filter(r => bucketOf(r) === b).map(card).join('')}
</section>`).join('')}
</div>

<div id="player"><button class="close">닫기</button><iframe allow="autoplay" allowfullscreen></iframe></div>

<script>
// file:// 로 열면 임베드가 막힌다. 조용히 실패하면 "재생이 안 되네" 로만 보이므로 명시한다.
if (location.protocol === 'file:') document.getElementById('filewarn').style.display = 'block'

const KEY = 'dibe2-youtube-review'
const store = JSON.parse(localStorage.getItem(KEY) || '{}')

document.querySelectorAll('.song').forEach(s => {
  const k = s.dataset.key
  if (!(k in store)) return
  const input = [...s.querySelectorAll('input[type=radio]')].find(i => i.value === store[k])
  if (input) { input.checked = true; mark(s) }
})

function mark(song) {
  const k = song.dataset.key
  song.classList.toggle('done', k in store)
  song.querySelector('.chosen').textContent = !(k in store) ? '' : (store[k] === '' ? '제외함' : '선택함')
}
function progress() {
  document.getElementById('prog').textContent = Object.keys(store).length + '곡 변경'
}
progress()

document.addEventListener('change', e => {
  if (e.target.type !== 'radio') return
  const song = e.target.closest('.song')
  store[song.dataset.key] = e.target.value
  localStorage.setItem(KEY, JSON.stringify(store))
  mark(song); progress()
})

// 재생 — 라디오 선택과 분리해서 들어보고 나서 고를 수 있게 한다.
const player = document.getElementById('player')
const frame = player.querySelector('iframe')
document.addEventListener('click', e => {
  const btn = e.target.closest('.play')
  if (btn) {
    e.preventDefault()
    frame.src = 'https://www.youtube-nocookie.com/embed/' + btn.dataset.v + '?autoplay=1'
    player.style.display = 'block'
  }
  if (e.target.closest('#player .close')) { frame.src = ''; player.style.display = 'none' }
  const fold = e.target.closest('.fold')
  if (fold) {
    const sec = document.getElementById('s-' + fold.dataset.s)
    sec.classList.toggle('folded')
    fold.textContent = sec.classList.contains('folded') ? '펼치기' : '접기'
  }
})

let filter = 'all'
document.querySelectorAll('.bar button[data-f]').forEach(b => b.addEventListener('click', () => {
  filter = b.dataset.f
  document.querySelectorAll('.bar button[data-f]').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
  apply()
}))
const q = document.getElementById('q')
q.addEventListener('input', apply)
function apply() {
  const term = q.value.trim().toLowerCase()
  document.querySelectorAll('section').forEach(sec => {
    let shown = 0
    sec.querySelectorAll('.song').forEach(s => {
      const on = (filter === 'all' || s.dataset.b === filter) && (!term || s.dataset.q.includes(term))
      s.style.display = on ? '' : 'none'
      if (on) shown++
    })
    sec.style.display = shown ? '' : 'none'
    if (shown && sec.classList.contains('folded') && (filter !== 'all' || term)) {
      sec.classList.remove('folded')
      const f = sec.querySelector('.fold'); if (f) f.textContent = '접기'
    }
  })
}

// 결과 저장 — 서버(scripts/serve-review.js)가 data/youtube-choices.json 으로 받아 적는다.
// 체크만 해두면 브라우저 안에만 남아서 넘겨줄 방법이 없다.
const saveBtn = document.getElementById('save')
saveBtn.addEventListener('click', async () => {
  const out = Object.entries(store).map(([k, v]) => {
    const parts = k.split('|||')
    return { title: parts[0], artist: parts[1], videoId: v || null }
  })
  if (location.protocol === 'file:') {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 1)], { type: 'application/json' }))
    a.download = 'youtube-choices.json'
    a.click()
    return
  }
  saveBtn.textContent = '저장 중…'
  try {
    const res = await fetch('/choices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(out) })
    const j = await res.json()
    saveBtn.textContent = j.ok ? '저장됨 (' + j.count + '건)' : '저장 실패'
  } catch (e) {
    saveBtn.textContent = '저장 실패 — 서버 꺼짐?'
  }
  setTimeout(() => { saveBtn.textContent = '선택 저장' }, 2500)
})
</script>
</body></html>`

fs.writeFileSync(OUT_FILE, html)
console.log(`검토 화면: ${OUT_FILE}`)
console.log(`  내가 판단함 ${counts.decided} | 적재 안 함 ${counts.drop} | 공식 후보 ${counts.official} | 훑기 ${counts.skim} | 자동 ${counts.auto}`)
console.log(`  적재 ${included} / 제외 ${rows.length - included}`)
