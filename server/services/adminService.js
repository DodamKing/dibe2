const db = require('../models')

const DAY = 864e5

// 대시보드에 보여줄 크론 (순서 = 화면 순서). 여기 없는 job 이 기록에 있으면 뒤에 붙인다
const CRON_JOBS = [
	['updateChartData', '국내 차트'],
	['updatePopChartData', '해외 차트'],
	['updateYoutubeUrls', '유튜브 주소'],
	['updateLyrics', '가사'],
	['updateGenres', '장르'],
	['verify:updatePopChartData', '해외 차트 확인'], // 해외 차트 재호출 검증(2026-11-04)
]
const THEME_STALE_DAYS = 90 // 수집이 이보다 오래되면 화면에 표시
const EXPIRING_DAYS = 7     // 이용 기간이 이 안에 끝나면 "곧 만료"

class AdminService {
	/**
	 * 관리자 대시보드 — "손볼 게 있나"를 한 번에 (2026-11-08 재구성).
	 * 예전 방문자 통계(visitor_stats)는 기록 미들웨어가 2026-04 레거시 제거 때 지워져 3-29 이후 비어 있었고,
	 * 로그인해야 쓰는 서비스라 페이지뷰보다 "재생한 사용자"(PlayEvent)가 트래픽을 더 잘 보여줘서 대체했다.
	 * 단 PlayEvent 는 벅스 곡(Song) 재생만 기록 — 테마·영상만 듣는 사용자는 활동 사용자에 안 잡힌다
	 */
	async getDashboard(now = Date.now()) {
		const [cron, music, themes, users, usage] = await Promise.all([
			this._cron(now), this._music(), this._themes(now), this._users(now), this._usage(now),
		])
		return { cron, music, themes, users, usage, generatedAt: new Date(now) }
	}

	// 크론: job 별 마지막 실행 + 최근 7일 실행·실패 수. running 이 2분 넘게 남아 있으면 30초 제한에 강제 종료된 것
	async _cron(now) {
		const runs = await db.CronRun.find({ startedAt: { $gte: new Date(now - 7 * DAY) } })
			.sort({ startedAt: -1 }).select('job status startedAt durationMs error').lean()
		const known = CRON_JOBS.map(([job]) => job)
		const extra = [...new Set(runs.map((r) => r.job))].filter((j) => !known.includes(j))
		const status = (r) => (r.status === 'running' && now - new Date(r.startedAt) > 2 * 60e3 ? 'timeout' : r.status)
		return [...CRON_JOBS, ...extra.map((j) => [j, j])].map(([job, label]) => {
			const mine = runs.filter((r) => r.job === job)
			const last = mine[0]
			return {
				job, label,
				runs7d: mine.length,
				fails7d: mine.filter((r) => ['error', 'timeout', 'wiped'].includes(status(r))).length,
				last: last ? { startedAt: last.startedAt, status: status(last), durationMs: last.durationMs, error: last.error || null } : null,
			}
		})
	}

	// 음원: 크론이 아직 처리할 곡(백로그 — scripts/cron-health.js 와 같은 조건) + 관리자가 손으로 채울 곡
	async _music() {
		const noUrl = { youtubeUrl: { $in: [null, ''] } }
		const [total, plays, noYoutube, gated, ytBacklog, lyBacklog, gnBacklog, head] = await Promise.all([
			db.Song.estimatedDocumentCount(),
			db.Song.aggregate([{ $group: { _id: null, total: { $sum: '$playCount' } } }]),
			db.Song.countDocuments(noUrl),
			db.Song.countDocuments({ ...noUrl, youtubeGatedAt: { $exists: true } }),
			db.Song.countDocuments({ ...noUrl, youtubeCheckedAt: { $exists: false }, youtubeGatedAt: { $exists: false } }),
			db.Song.countDocuments({ lyrics: { $in: [null, ''] }, lyricsCheckedAt: { $exists: false }, adult: { $ne: true }, detailLink: { $ne: null } }),
			db.Song.countDocuments({ genre: { $exists: false }, coverUrl: { $ne: null } }),
			// 최근 차트 상위 100곡 — 신곡을 크론이 제때 채우는지
			db.Song.find({ lastChartedAt: { $ne: null } }).sort({ lastChartedAt: -1, chartHits: -1 }).limit(100)
				.select('youtubeUrl lyrics adult').lean(),
		])
		return {
			total,
			totalPlays: (plays[0] && plays[0].total) || 0,
			noYoutube,
			gated,
			backlog: { youtube: ytBacklog, lyrics: lyBacklog, genre: gnBacklog },
			chartTop: { size: head.length, youtube: head.filter((s) => s.youtubeUrl).length, lyrics: head.filter((s) => s.lyrics || s.adult).length },
		}
	}

	// 테마: 수집일·풀 크기 (수집은 로컬 scripts/refresh-themes.js 수동 — 관리자 화면은 보기만)
	async _themes(now) {
		const themes = await db.Theme.find({ active: true }).sort({ order: 1 }).select('key name lastRefreshedAt lastStats').lean()
		return themes.map((t) => ({
			key: t.key,
			name: t.name,
			lastRefreshedAt: t.lastRefreshedAt || null,
			core: (t.lastStats && t.lastStats.core) || 0,
			explore: (t.lastStats && t.lastStats.explore) || 0,
			stale: !t.lastRefreshedAt || now - new Date(t.lastRefreshedAt) > THEME_STALE_DAYS * DAY,
		}))
	}

	// 사용자: 신규 가입(누가 들어왔나) + 활동 사용자(트래픽) + 곧 만료(관리자가 기간을 늘려줘야 함)
	async _users(now) {
		const pick = 'username email provider createdAt expiryDate'
		const [total, new7d, recent, active7d, active30d, expiring] = await Promise.all([
			db.User.estimatedDocumentCount(),
			db.User.countDocuments({ createdAt: { $gte: new Date(now - 7 * DAY) } }),
			db.User.find().sort({ createdAt: -1 }).limit(5).select(pick).lean(),
			db.PlayEvent.distinct('user', { playedAt: { $gte: new Date(now - 7 * DAY) } }),
			db.PlayEvent.distinct('user', { playedAt: { $gte: new Date(now - 30 * DAY) } }),
			db.User.find({ expiryDate: { $gte: new Date(now), $lte: new Date(now + EXPIRING_DAYS * DAY) } })
				.sort({ expiryDate: 1 }).limit(10).select(pick).lean(),
		])
		const row = (u) => ({ id: u._id, username: u.username, email: u.email, provider: u.provider || null, createdAt: u.createdAt, expiryDate: u.expiryDate })
		return { total, new7d, recent: recent.map(row), active7d: active7d.length, active30d: active30d.length, expiring: expiring.map(row) }
	}

	// 이용: 최근 7일 재생 수·많이 들은 곡 (PlayEvent = 벅스 곡 재생만)
	async _usage(now) {
		const since = new Date(now - 7 * DAY)
		const [plays7d, top] = await Promise.all([
			db.PlayEvent.countDocuments({ playedAt: { $gte: since } }),
			db.PlayEvent.aggregate([
				{ $match: { playedAt: { $gte: since } } },
				{ $group: { _id: '$song', n: { $sum: 1 } } },
				{ $sort: { n: -1 } },
				{ $limit: 5 },
				{ $lookup: { from: 'songs', localField: '_id', foreignField: '_id', as: 's' } },
				{ $project: { n: 1, title: { $first: '$s.title' }, artist: { $first: '$s.artist' } } },
			]),
		])
		return { plays7d, top: top.map((t) => ({ title: t.title || '(삭제된 곡)', artist: t.artist || '', plays: t.n })) }
	}

	async setUserAccessPeriod(userId, days) {
		try {
			const expiryDate = new Date()
	
			if (days === 'unlimited') expiryDate.setFullYear(expiryDate.getFullYear() + 1000)
			else expiryDate.setDate(expiryDate.getDate() + days)

			const updateUser = await db.User.findByIdAndUpdate(userId, { expiryDate }, { new: true })

			if (!updateUser) throw new Error('User not found')
	
			return updateUser
		} catch (error) {
			console.error('Error in setUserAccessPeriod:', error)
			throw error
		}
	}

}

module.exports = new AdminService()