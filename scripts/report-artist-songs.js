/**
 * artist-report.json → 눈으로 검토할 수 있는 HTML 한 장. (요청/DB 없음, 순수 변환)
 *
 * JSONL 은 사람이 훑기 어렵다. 적재 전 최종 확인은 사람이 하는 단계라 읽을 수 있는 형태가 필요하다.
 * **버린 것까지 같이 보여주는 게 핵심** — 남긴 목록만 보면 규칙이 잘못 걸러낸 곡을 못 찾는다.
 *
 * 사용법:
 *   node scripts/report-artist-songs.js
 *   node scripts/report-artist-songs.js --out some/path.html
 */
const fs = require('fs')
const path = require('path')

const DATA_DIR = path.join(__dirname, '..', 'data')
const IN_FILE = path.join(DATA_DIR, 'artist-report.json')
const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i !== -1 ? process.argv[i + 1] : d }
const OUT_FILE = arg('out', path.join(DATA_DIR, 'artist-report.html'))

const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const r = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'))

const TYPE_CLASS = {
    '정규': 'reg', 'EP(미니)': 'ep', '싱글': 'sgl', 'OST': 'ost',
    '컴필레이션': 'comp', '스페셜': 'spc',
}
const chip = t => `<span class="chip ${TYPE_CLASS[t] || 'unk'}">${esc(t || '?')}</span>`
const bugs = link => link ? `<a class="ext" href="${esc(link)}" target="_blank" rel="noopener">벅스 ↗</a>` : ''

const artists = [...new Set(r.fresh.map(s => s.artist))]
    .sort((a, b) => r.fresh.filter(s => s.artist === b).length - r.fresh.filter(s => s.artist === a).length)

const typeCounts = {}
r.fresh.forEach(s => { typeCounts[s.albumType || '?'] = (typeCounts[s.albumType || '?'] || 0) + 1 })

const freshRows = r.fresh.map(s => `
<tr data-artist="${esc(s.artist)}" data-type="${esc(s.albumType)}" data-q="${esc((s.title + ' ' + s.artist + ' ' + s.album).toLowerCase())}">
  <td class="t">${esc(s.title)}${s.artistsAll && s.artistsAll.length > 1 ? `<span class="feat">+ ${esc(s.artistsAll.filter(a => a !== s.artist).join(', '))}</span>` : ''}</td>
  <td class="a">${esc(s.artist)}</td>
  <td class="al">${esc(s.album)} ${chip(s.albumType)}</td>
  <td class="d">${esc(s.releaseDate)}</td>
  <td class="g">${s.genre && s.genre.length ? esc(s.genre.join(', ')) : '<span class="none">장르 없음</span>'}</td>
  <td class="x">${bugs(s.detailLink)}</td>
</tr>`).join('')

const droppedRows = r.dropped.map(s => `
<tr data-q="${esc((s.title + ' ' + s.album).toLowerCase())}">
  <td class="t">${esc(s.title)}</td>
  <td class="a">${esc(s.artist)}</td>
  <td class="al struck">${esc(s.album)} ${chip(s.albumType)}<span class="d2">${esc(s.releaseDate)}</span></td>
  <td class="al win">→ ${esc(s.wonBy)} ${chip(s.wonType)}<span class="d2">${esc(s.wonDate)}</span></td>
  <td class="x">${bugs(s.detailLink)}</td>
</tr>`).join('')

const instRows = r.inst.map(s => `
<tr data-q="${esc((s.title + ' ' + s.album).toLowerCase())}">
  <td class="t struck">${esc(s.title)}</td>
  <td class="a">${esc(s.artist)}</td>
  <td class="al">${esc(s.album)}</td>
  <td class="x">${bugs(s.detailLink)}</td>
</tr>`).join('')

const existRows = r.existing.map(s => `
<tr data-q="${esc((s.title + ' ' + s.artist).toLowerCase())}">
  <td class="t">${esc(s.title)}</td>
  <td class="a">${esc(s.artist)}</td>
  <td class="al">${s.hasYoutube
        ? '<span class="ok">DB에 유튜브 URL 있음</span>'
        : '<span class="warn">유튜브 URL 없음 — 이번에 같이 채울 대상</span>'}</td>
</tr>`).join('')

const html = `<title>국카스텐·터치드 수집 검토</title>
<style>
:root {
  --paper: #F4F3F8; --surface: #FFFFFF; --ink: #17161F; --muted: #6A6580;
  --line: #E1DFEA; --line-soft: #EDEBF3; --accent: #4B3BD1; --accent-soft: #EEEBFC;
  --ok: #1F7A54; --warn: #A3541B; --strike: #9B96AC;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --paper: #121118; --surface: #1B1A23; --ink: #E9E7F1; --muted: #9B96AC;
    --line: #2B2936; --line-soft: #232230; --accent: #9C8FFF; --accent-soft: #221F3A;
    --ok: #5FCA9B; --warn: #E0A268; --strike: #6A6580;
  }
}
:root[data-theme="dark"] {
  --paper: #121118; --surface: #1B1A23; --ink: #E9E7F1; --muted: #9B96AC;
  --line: #2B2936; --line-soft: #232230; --accent: #9C8FFF; --accent-soft: #221F3A;
  --ok: #5FCA9B; --warn: #E0A268; --strike: #6A6580;
}
* { box-sizing: border-box; }
body {
  margin: 0; background: var(--paper); color: var(--ink);
  font-family: "Segoe UI Variable Text", "Segoe UI", "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif;
  font-size: 14px; line-height: 1.5;
}
.wrap { max-width: 1180px; margin: 0 auto; padding: 28px 20px 80px; }

header { display: flex; flex-direction: column; gap: 14px; margin-bottom: 22px; }
h1 { margin: 0; font-size: 25px; font-weight: 650; letter-spacing: -0.02em; text-wrap: balance; }
.sub { margin: 0; color: var(--muted); font-size: 13.5px; }
.sub b { color: var(--ink); font-weight: 600; }

.funnel { display: flex; flex-wrap: wrap; gap: 8px; align-items: stretch; }
.step {
  background: var(--surface); border: 1px solid var(--line); border-radius: 3px;
  padding: 9px 13px; min-width: 108px;
}
.step .n { font-size: 19px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
.step .l { font-size: 11.5px; color: var(--muted); }
.step.final { border-color: var(--accent); background: var(--accent-soft); }
.step.final .n { color: var(--accent); }
.arrow { align-self: center; color: var(--strike); font-size: 13px; }

nav { display: flex; gap: 2px; border-bottom: 1px solid var(--line); margin: 26px 0 0; flex-wrap: wrap; }
nav button {
  appearance: none; background: none; border: 0; border-bottom: 2px solid transparent;
  color: var(--muted); font: inherit; font-size: 13.5px; padding: 9px 13px; cursor: pointer;
  margin-bottom: -1px;
}
nav button:hover { color: var(--ink); }
nav button[aria-selected="true"] { color: var(--accent); border-bottom-color: var(--accent); font-weight: 600; }
nav button:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
nav button .c { font-variant-numeric: tabular-nums; opacity: .7; margin-left: 5px; }

.tools { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin: 16px 0 10px; }
input[type="search"] {
  flex: 1 1 230px; min-width: 180px; background: var(--surface); color: var(--ink);
  border: 1px solid var(--line); border-radius: 3px; padding: 7px 11px; font: inherit; font-size: 13.5px;
}
input[type="search"]:focus-visible { outline: 2px solid var(--accent); outline-offset: -1px; }
.filters { display: flex; gap: 5px; flex-wrap: wrap; }
.filters button {
  appearance: none; background: var(--surface); border: 1px solid var(--line); color: var(--muted);
  border-radius: 999px; padding: 4px 11px; font: inherit; font-size: 12.5px; cursor: pointer;
}
.filters button[aria-pressed="true"] { background: var(--accent); border-color: var(--accent); color: #fff; }
.filters button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }

.panel { display: none; }
.panel.on { display: block; }
.note { color: var(--muted); font-size: 13px; margin: 0 0 12px; }

.tbl { overflow-x: auto; background: var(--surface); border: 1px solid var(--line); border-radius: 3px; }
table { width: 100%; border-collapse: collapse; min-width: 720px; }
th {
  text-align: left; font-size: 11px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
  color: var(--muted); padding: 9px 12px; border-bottom: 1px solid var(--line); white-space: nowrap;
  position: sticky; top: 0; background: var(--surface);
}
td { padding: 8px 12px; border-bottom: 1px solid var(--line-soft); vertical-align: top; }
tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: var(--accent-soft); }
.t { font-weight: 550; }
.a { color: var(--muted); white-space: nowrap; }
.al { color: var(--muted); }
.d, .d2 { font-family: "Cascadia Mono", Consolas, ui-monospace, monospace; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--muted); white-space: nowrap; }
.d2 { display: block; margin-top: 2px; }
.g { font-size: 12.5px; color: var(--muted); }
.x { text-align: right; white-space: nowrap; }
.feat { display: block; font-size: 11.5px; font-weight: 400; color: var(--accent); margin-top: 2px; }
.none { color: var(--warn); font-size: 12px; }
.struck { color: var(--strike); text-decoration: line-through; text-decoration-color: var(--strike); }
.win { color: var(--ink); }
.ok { color: var(--ok); font-size: 12.5px; }
.warn { color: var(--warn); font-size: 12.5px; }
.ext { color: var(--accent); text-decoration: none; font-size: 12px; }
.ext:hover { text-decoration: underline; }

.chip {
  display: inline-block; font-size: 10.5px; padding: 1px 6px; border-radius: 2px;
  border: 1px solid var(--line); color: var(--muted); vertical-align: 1px; white-space: nowrap;
}
.chip.reg { border-color: #4B3BD1; color: #4B3BD1; }
.chip.ep { border-color: #1F7A54; color: #1F7A54; }
.chip.ost { border-color: #A3541B; color: #A3541B; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) .chip.reg { border-color: #9C8FFF; color: #9C8FFF; }
  :root:not([data-theme="light"]) .chip.ep { border-color: #5FCA9B; color: #5FCA9B; }
  :root:not([data-theme="light"]) .chip.ost { border-color: #E0A268; color: #E0A268; }
}
:root[data-theme="dark"] .chip.reg { border-color: #9C8FFF; color: #9C8FFF; }
:root[data-theme="dark"] .chip.ep { border-color: #5FCA9B; color: #5FCA9B; }
:root[data-theme="dark"] .chip.ost { border-color: #E0A268; color: #E0A268; }

.empty { padding: 26px 12px; text-align: center; color: var(--muted); font-size: 13px; }
</style>

<div class="wrap">
<header>
  <div>
    <h1>적재 전 검토 — 국카스텐 · 터치드 · 하현우 · 윤민</h1>
    <p class="sub">벅스 아티스트 페이지에서 <b>${r.counts.rows}행</b>을 수집해 <b>${r.counts.fresh}곡</b>으로 정제했습니다. 버린 것도 전부 아래에 있습니다 — 잘못 걸러진 곡이 있으면 그쪽에서 찾을 수 있습니다.</p>
  </div>
  <div class="funnel">
    <div class="step"><div class="n">${r.counts.rows}</div><div class="l">수집한 행</div></div>
    <span class="arrow">−</span>
    <div class="step"><div class="n">${r.counts.inst}</div><div class="l">Inst / MR</div></div>
    <span class="arrow">−</span>
    <div class="step"><div class="n">${r.counts.dropped}</div><div class="l">중복 수록반</div></div>
    <span class="arrow">−</span>
    <div class="step"><div class="n">${r.counts.existing}</div><div class="l">DB에 이미 있음</div></div>
    <span class="arrow">=</span>
    <div class="step final"><div class="n">${r.counts.fresh}</div><div class="l">적재 후보</div></div>
  </div>
</header>

<nav role="tablist">
  <button role="tab" aria-selected="true" data-p="fresh">적재 후보<span class="c">${r.counts.fresh}</span></button>
  <button role="tab" aria-selected="false" data-p="dropped">중복이라 버림<span class="c">${r.counts.dropped}</span></button>
  <button role="tab" aria-selected="false" data-p="inst">Inst / MR 제외<span class="c">${r.counts.inst}</span></button>
  <button role="tab" aria-selected="false" data-p="exist">DB에 이미 있음<span class="c">${r.counts.existing}</span></button>
</nav>

<div class="tools">
  <input type="search" id="q" placeholder="제목 · 아티스트 · 앨범 검색" autocomplete="off">
  <div class="filters" id="af">
    <button aria-pressed="true" data-a="">전체</button>
    ${artists.map(a => `<button aria-pressed="false" data-a="${esc(a)}">${esc(a)} <span class="c">${r.fresh.filter(s => s.artist === a).length}</span></button>`).join('')}
  </div>
</div>

<section class="panel on" id="p-fresh">
  <p class="note">유형 분포 — ${Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${esc(t)} ${n}`).join(' · ')}</p>
  <div class="tbl"><table>
    <thead><tr><th>곡</th><th>아티스트</th><th>앨범</th><th>발매일</th><th>장르</th><th></th></tr></thead>
    <tbody>${freshRows}</tbody>
  </table></div>
</section>

<section class="panel" id="p-dropped">
  <p class="note">같은 곡이 여러 앨범에 실려 있어 원본 수록반만 남겼습니다. 왼쪽이 버린 것, 오른쪽이 대신 남긴 것입니다.</p>
  <div class="tbl"><table>
    <thead><tr><th>곡</th><th>아티스트</th><th>버린 수록반</th><th>남긴 수록반</th><th></th></tr></thead>
    <tbody>${droppedRows}</tbody>
  </table></div>
</section>

<section class="panel" id="p-inst">
  <p class="note">제목에 <code>(Inst.)</code> · <code>(Instrumental)</code> · <code>(MR)</code> 이 붙은 트랙입니다. 재생해도 노래가 안 나오므로 뺐습니다.</p>
  <div class="tbl"><table>
    <thead><tr><th>곡</th><th>아티스트</th><th>앨범</th><th></th></tr></thead>
    <tbody>${instRows}</tbody>
  </table></div>
</section>

<section class="panel" id="p-exist">
  <p class="note">이미 DB에 있는 곡이라 새로 넣지 않습니다. 다만 유튜브 URL이 비어 있는 곡은 이번 검증 때 같이 채울 수 있습니다.</p>
  <div class="tbl"><table>
    <thead><tr><th>곡</th><th>아티스트</th><th>상태</th></tr></thead>
    <tbody>${existRows}</tbody>
  </table></div>
</section>
</div>

<script>
const tabs = [...document.querySelectorAll('nav button')]
const panels = { fresh: 'p-fresh', dropped: 'p-dropped', inst: 'p-inst', exist: 'p-exist' }
let current = 'fresh'
tabs.forEach(b => b.addEventListener('click', () => {
  current = b.dataset.p
  tabs.forEach(x => x.setAttribute('aria-selected', String(x === b)))
  Object.entries(panels).forEach(([k, id]) => document.getElementById(id).classList.toggle('on', k === current))
  document.getElementById('af').style.display = current === 'fresh' ? '' : 'none'
  apply()
}))

const q = document.getElementById('q')
let artist = ''
document.querySelectorAll('#af button').forEach(b => b.addEventListener('click', () => {
  artist = b.dataset.a
  document.querySelectorAll('#af button').forEach(x => x.setAttribute('aria-pressed', String(x === b)))
  apply()
}))

function apply() {
  const term = q.value.trim().toLowerCase()
  const panel = document.getElementById(panels[current])
  let shown = 0
  panel.querySelectorAll('tbody tr').forEach(tr => {
    const okQ = !term || (tr.dataset.q || '').includes(term)
    const okA = !artist || tr.dataset.artist === artist
    const on = okQ && okA
    tr.style.display = on ? '' : 'none'
    if (on) shown++
  })
  let e = panel.querySelector('.empty')
  if (!shown) {
    if (!e) { e = document.createElement('p'); e.className = 'empty'; e.textContent = '조건에 맞는 곡이 없습니다.'; panel.appendChild(e) }
  } else if (e) e.remove()
}
q.addEventListener('input', apply)
</script>
`

fs.writeFileSync(OUT_FILE, html)
console.log(`검토 화면: ${OUT_FILE}`)
console.log(`  적재 후보 ${r.counts.fresh} | 중복 버림 ${r.counts.dropped} | Inst ${r.counts.inst} | DB 중복 ${r.counts.existing}`)
