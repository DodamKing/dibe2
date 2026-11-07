const { MongoClient } = require('mongodb')
const db = require('../models')

const uri = process.env.MONGODB_URI
const client = new MongoClient(uri)

function fillMissingDates(stats, startDate, endDate) {
    const filledStats = []
    let currentDate = new Date(startDate)

    while (currentDate <= endDate) {
        const dateString = currentDate.toISOString().split('T')[0]
        const existingStat = stats.find(stat => stat.date === dateString)

        if (existingStat) {
            filledStats.push(existingStat)
        } else {
            filledStats.push({
                date: dateString,
                totalPageviews: 0,
                uniqueVisitors: 0,
                loggedInVisits: 0,
                uniqueLoggedInVisitors: 0
            })
        }

        currentDate.setDate(currentDate.getDate() + 1)
    }

    return filledStats
}

class AdminService {
	async getUserStats() {
		// await client.connect()
		// const db = client.db('dibe2')

		// 날짜는 **한국 시간** 기준. 예전엔 서버(Netlify=UTC) 시각으로 잘라서 "오늘 신규"가 09시 KST부터 셌고
		// 일별 막대도 9시간 밀려 있었다(2026-11-07 수정)
		const DAY = 86400000
		const kstDate = ms => new Date(ms + 9 * 3600000).toISOString().split('T')[0]
		const kstMidnight = ymd => new Date(`${ymd}T00:00:00+09:00`)
		const last7Days = Array.from({ length: 7 }, (_, i) => kstDate(Date.now() - (6 - i) * DAY))
		const todayStart = kstMidnight(last7Days[6])
		const sevenDaysAgo = kstMidnight(last7Days[0])

		const [totalStats, dailyStats] = await Promise.all([
			db.User.aggregate([
				{
					$group: {
						_id: null,
						totalUsers: { $sum: 1 },
						newUsersToday: {
							$sum: {
								$cond: [
									{ $gte: ['$createdAt', todayStart] },
									1,
									0
								]
							}
						}
					}
				},
				{
					$project: {
						_id: 0,
						totalUsers: 1,
						newUsersToday: 1
					}
				}
			]),
			db.User.aggregate([
				{
					$match: {
						createdAt: { $gte: sevenDaysAgo }
					}
				},
				{
					$group: {
						_id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Seoul" } },
						newUsers: { $sum: 1 }
					}
				},
				{
					$sort: { _id: 1 }
				}
			])
		])

		// 날짜별 데이터 매핑
		const dailyStatsMap = Object.fromEntries(
			dailyStats.map(day => [day._id, day.newUsers])
		)

		// 각 날짜에 대해 데이터가 있으면 사용, 없으면 0
		const newUsersLastWeek = last7Days.map(date => 
			dailyStatsMap[date] || 0
		)

		return {
			...(totalStats[0] || { totalUsers: 0, newUsersToday: 0 }),
			newUsersLastWeek,
			dates: last7Days
		}
	}

	// 대시보드 "음원 통계" — 예전엔 화면에 가짜 숫자(50000/100000)가 박혀 있었다(2026-11-07 교체).
	// 하루 재생 수는 따로 기록하지 않아(Song.playCount 누적뿐) 누적 재생 수를 보여준다
	async getMusicStats() {
		const noUrl = { youtubeUrl: { $in: [null, ''] } }
		const [totalTracks, noYoutube, gated, plays] = await Promise.all([
			db.Song.estimatedDocumentCount(),
			db.Song.countDocuments(noUrl),
			db.Song.countDocuments({ ...noUrl, youtubeGatedAt: { $exists: true } }),
			db.Song.aggregate([{ $group: { _id: null, total: { $sum: '$playCount' } } }]),
		])
		return { totalTracks, noYoutube, gated, totalPlays: (plays[0] && plays[0].total) || 0 }
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

	async getVisitorStats() {
		await client.connect()
		const _db = client.db('dibe2')
		const now = new Date()
		const utcNow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))
		
		// 7일 전 UTC 시간 계산
		const sevenDaysAgo = new Date(utcNow)
		sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6)
		sevenDaysAgo.setUTCHours(0, 0, 0, 0)
	
		const visitorStats = await _db.collection('visitor_stats').aggregate([
			{
				$match: {
					date: { $gte: sevenDaysAgo, $lte: utcNow }
				}
			},
			{
				$project: {
					_id: 0,
					date: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Seoul" } },
					totalPageviews: 1,
					uniqueVisitors: { $size: { $ifNull: ['$uniqueVisitors', []] } },
					loggedInVisits: 1,
					uniqueLoggedInVisitors: { $size: { $ifNull: ['$uniqueLoggedInVisitors', []] } }
				}
			},
			{
				$sort: { date: 1 }
			}
		]).toArray()
	
		// 결과가 7일 미만인 경우 빈 날짜 추가
		const filledStats = fillMissingDates(visitorStats, sevenDaysAgo, now)
	
		return filledStats
	}

}

module.exports = new AdminService()