const { MongoClient } = require('mongodb')
const os = require('os')
const fs = require('fs')
const util = require('util')
const db = require('../models')

const statfs = util.promisify(fs.statfs)

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

		const sevenDaysAgo = new Date()
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
		sevenDaysAgo.setHours(0, 0, 0, 0)

		const [totalStats, dailyStats] = await Promise.all([
			db.User.aggregate([
				{
					$group: {
						_id: null,
						totalUsers: { $sum: 1 },
						newUsersToday: {
							$sum: {
								$cond: [
									{ $gte: ['$createdAt', new Date(new Date().setHours(0, 0, 0, 0))] },
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
						_id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
						newUsers: { $sum: 1 }
					}
				},
				{
					$sort: { _id: 1 }
				}
			])
		])

		 // 최근 7일의 날짜 배열 생성
		 const last7Days = Array.from({ length: 7 }, (_, i) => {
			const date = new Date()
			date.setDate(date.getDate() - (6 - i))
			return date.toISOString().split('T')[0]
		})
	
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

	async setUserAccessPeriod(userId, days) {
		try {
			const expiryDate = new Date()
	
			if (days === 'unlimited') expiryDate.setFullYear(expiryDate.getFullYear() + 100)
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
				$group: {
					_id: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "Asia/Seoul" } },
					totalPageviews: { $sum: '$totalPageviews' },
					uniqueVisitors: { $addToSet: '$uniqueVisitors' },
					loggedInVisits: { $sum: '$loggedInVisits' },
					uniqueLoggedInVisitors: { $addToSet: '$uniqueLoggedInVisitors' }
				}
			},
			{
				$project: {
					_id: 0,
					date: '$_id',
					totalPageviews: 1,
					uniqueVisitors: { $size: '$uniqueVisitors' },
					loggedInVisits: 1,
					uniqueLoggedInVisitors: { $size: '$uniqueLoggedInVisitors' }
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

	async getSystemStats() {
		const cpus = os.cpus();

		// CPU 사용률 계산
		let totalIdle = 0;
		let totalTick = 0;

		cpus.forEach(cpu => {
			for (let type in cpu.times) {
				totalTick += cpu.times[type];
			}
			totalIdle += cpu.times.idle;
		});

		const idle = totalIdle / cpus.length;
		const total = totalTick / cpus.length;
		const cpuUsagePercent = 100 - (100 * idle / total);

		// 메모리 사용률 계산
		const totalMemory = os.totalmem();
		const freeMemory = os.freemem();
		const usedMemory = totalMemory - freeMemory;
		const memoryUsagePercent = (usedMemory / totalMemory) * 100;

		// 디스크 사용량 계산
		const path = os.platform() === 'win32' ? 'C:' : '/';
		const stats = await statfs(path);

		const totalSpace = stats.blocks * stats.bsize;
		const freeSpace = stats.bfree * stats.bsize;
		const usedSpace = totalSpace - freeSpace;

		return {
			cpuUsage: cpuUsagePercent.toFixed(2),
			memoryUsage: memoryUsagePercent.toFixed(2),
			diskUsage: ((usedSpace / totalSpace) * 100).toFixed(2)
		};
	}

	getAppUptime() {
		const uptimeInSeconds = Math.floor(process.uptime());
		const days = Math.floor(uptimeInSeconds / (3600 * 24));
		const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
		const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
		return Promise.resolve(`${days}일 ${hours}시간 ${minutes}분`);
	}

	// 여기에 다른 통계 메서드들을 추가할 수 있습니다 (예: 음원 통계, 문의사항 등)
}

module.exports = new AdminService()