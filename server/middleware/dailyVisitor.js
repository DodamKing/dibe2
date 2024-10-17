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

    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown'
    const userAgent = req.headers['user-agent']

    try {
        const client = await getMongoClient()
        const db = client.db('dibe2')
        const visitsCollection = db.collection('visitor_stats')

         // 오늘의 통계 문서 가져오기 또는 생성
         const todayStats = await visitsCollection.findOne({ date: today })

         if (!todayStats) {
             // 오늘의 통계가 없으면 새로 생성
             await visitsCollection.insertOne({
                 date: today,
                 totalPageviews: 1,
                 uniqueVisitors: [`${ip}:${userAgent}`],
                 loggedInVisits: 0,
                 uniqueLoggedInVisitors: []
             })
         } else {
             // 기존 통계 업데이트
             await visitsCollection.updateOne(
                 { date: today },
                 { 
                     $inc: { totalPageviews: 1 },
                     $addToSet: { uniqueVisitors: `${ip}:${userAgent}` }
                 }
             )
         }

        // 로그인한 사용자 추적 (현재 위치 유지)
        if (req.session && req.session.user) {
            const userId = req.session.user.userId
            const loggedInVisitorKey = `${userId}:${ip}:${userAgent}`

            await visitsCollection.updateOne(
                { date: today, uniqueLoggedInVisitors: { $ne: loggedInVisitorKey } },
                {
                    $inc: { loggedInVisits: 1 },
                    $addToSet: { uniqueLoggedInVisitors: loggedInVisitorKey }
                }
            )
        }
    } catch (error) {
        console.error('Error recording visitor stats:', error)
    }

    next()
}