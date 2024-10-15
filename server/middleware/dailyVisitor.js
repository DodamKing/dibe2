import { MongoClient } from 'mongodb'

let mongoClient = null

async function getMongoClient() {
    if (!mongoClient) {
        mongoClient = new MongoClient(process.env.MONGODB_URI)
        await mongoClient.connect()
    }
    return mongoClient
}

export default async function visitorMiddleware(req, res, next) {
    // 개발 환경에서는 미들웨어를 실행하지 않음
    if (process.env.NODE_ENV === 'development') {
        return next()
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const ip = req.ip
    const userAgent = req.headers['user-agent']

    try {
        const client = await getMongoClient()
        const db = client.db('dibe2')
        const visitsCollection = db.collection('visitor_stats')

        // 오늘의 통계 문서 가져오기 또는 생성
        let todayStats = await visitsCollection.findOne({ date: today })
        if (!todayStats) {
            todayStats = {
                date: today,
                totalPageviews: 0,
                uniqueVisitors: [],
                loggedInVisits: 0,
                uniqueLoggedInVisitors: []
            }
            await visitsCollection.insertOne(todayStats)
        }

        // 전체 페이지뷰 증가 (새로고침 포함)
        await visitsCollection.updateOne(
            { date: today },
            { $inc: { totalPageviews: 1 } }
        )

        // 고유 방문자 업데이트
        const visitorKey = `${ip}:${userAgent}`
        await visitsCollection.updateOne(
            { date: today },
            { $addToSet: { uniqueVisitors: visitorKey } }
        )

        // 로그인한 사용자 추적
        if (req.session && req.session.user) {
            const userId = req.session.user._id
            const loggedInVisitorKey = `${userId}:${ip}:${userAgent}`

            // 이미 기록된 로그인 방문자인지 확인
            const alreadyLoggedIn = await visitsCollection.findOne({
                date: today,
                uniqueLoggedInVisitors: loggedInVisitorKey
            })

            if (!alreadyLoggedIn) {
                await visitsCollection.updateOne(
                    { date: today },
                    {
                        $inc: { loggedInVisits: 1 },
                        $addToSet: { uniqueLoggedInVisitors: loggedInVisitorKey }
                    }
                )

            }

        }
    } catch (error) {
        console.error('Error recording visitor stats:', error)
    }

    next()
}