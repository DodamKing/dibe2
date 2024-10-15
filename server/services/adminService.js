const { MongoClient } = require('mongodb')
const os = require('os')
const fs = require('fs')
const util = require('util')

const statfs = util.promisify(fs.statfs)

const uri = process.env.MONGODB_URI
const client = new MongoClient(uri)

let pm2;
if (process.env.NODE_ENV === 'production') {
	try {
		pm2 = require('pm2');
	} catch (err) {
		console.warn('PM2 not available, uptime might be inaccurate');
	}
}

class AdminService {
	async getUserStats() {
		await client.connect()
		const db = client.db('dibe2')

		const sevenDaysAgo = new Date()
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
		sevenDaysAgo.setHours(0, 0, 0, 0)

		const [totalStats, dailyStats] = await Promise.all([
			db.collection('users').aggregate([
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
			]).toArray(),
			db.collection('users').aggregate([
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
			]).toArray()
		])

		const newUsersLastWeek = new Array(7).fill(0)
		dailyStats.forEach((day, index) => {
			newUsersLastWeek[index] = day.newUsers
		})

		return {
			...(totalStats[0] || { totalUsers: 0, newUsersToday: 0 }),
			newUsersLastWeek
		}
	}

	async getVisitorStats() {
		await client.connect()
		const db = client.db('dibe2')
		const visitorStats = await db.collection('visitor_stats').aggregate([
			{
				$match: {
					date: { $gte: new Date(new Date().setDate(new Date().getDate() - 7)) }
				}
			},
			{
				$group: {
					_id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
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

		return visitorStats[0] || {
			totalPageviews: 0,
			uniqueVisitors: 0,
			loggedInVisits: 0,
			uniqueLoggedInVisitors: 0
		}
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
	if (process.env.NODE_ENV === 'production' && pm2) {
		return new Promise((resolve, reject) => {
			pm2.connect((err) => {
				if (err) {
					pm2.disconnect();
					reject(err);
					return;
				}

				pm2.list((err, processDescriptionList) => {
					pm2.disconnect();
					if (err) {
						reject(err);
						return;
					}

					const app = processDescriptionList.find(proc => proc.name === process.env.PM2_APP_NAME);
					if (!app) {
						reject(new Error('App not found'));
						return;
					}

					const uptimeInSeconds = app.pm2_env.pm_uptime ? Math.floor((Date.now() - app.pm2_env.pm_uptime) / 1000) : 0;
					const days = Math.floor(uptimeInSeconds / (3600 * 24));
					const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
					const minutes = Math.floor((uptimeInSeconds % 3600) / 60);

					resolve(`${days}일 ${hours}시간 ${minutes}분`);
				});
			});
		});
	} else {
		// 개발 환경이거나 PM2를 사용할 수 없는 경우 Node.js 프로세스의 가동 시간을 반환
		const uptimeInSeconds = Math.floor(process.uptime());
		const days = Math.floor(uptimeInSeconds / (3600 * 24));
		const hours = Math.floor((uptimeInSeconds % (3600 * 24)) / 3600);
		const minutes = Math.floor((uptimeInSeconds % 3600) / 60);
		return Promise.resolve(`${days}일 ${hours}시간 ${minutes}분`);
	}
}

  // 여기에 다른 통계 메서드들을 추가할 수 있습니다 (예: 음원 통계, 문의사항 등)
}

module.exports = new AdminService()