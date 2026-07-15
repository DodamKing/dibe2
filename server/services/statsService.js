const db = require('../models')

// 앱이 재시도하거나 중복 발사했을 때 같은 재생이 두 번 세지는 걸 막는 창.
// 정상적인 "한 곡 반복 재생"은 곡 길이상 이 창을 넘기므로 억제되지 않는다.
const PLAY_DEDUPE_WINDOW_MS = 20 * 1000

module.exports = {
    // 좋아요 등록(멱등). 이미 눌러둔 상태면 카운터를 건드리지 않는다.
    // upsert의 upsertedCount로 "이번에 새로 생겼는지"를 판별 → 유니크 인덱스와 함께
    // 동시 요청이 와도 likeCount가 실제 Like 수와 어긋나지 않는다.
    like: async (userId, songId) => {
        const song = await db.Song.findById(songId).select('_id')
        if (!song) return null

        const result = await db.Like.updateOne(
            { user: userId, song: songId },
            { $setOnInsert: { user: userId, song: songId } },
            { upsert: true }
        )

        const isNew = result.upsertedCount > 0
        const updated = isNew
            ? await db.Song.findByIdAndUpdate(songId, { $inc: { likeCount: 1 } }, { new: true }).select('likeCount')
            : await db.Song.findById(songId).select('likeCount')

        return { liked: true, likeCount: updated.likeCount, changed: isNew }
    },

    // 좋아요 해제(멱등). 실제로 지워졌을 때만 감소시킨다.
    unlike: async (userId, songId) => {
        const song = await db.Song.findById(songId).select('_id')
        if (!song) return null

        const result = await db.Like.deleteOne({ user: userId, song: songId })
        const removed = result.deletedCount > 0

        // min:0 은 문서 검증이라 $inc를 막지 못한다. 음수 방지는 조건부 갱신으로 처리.
        const updated = removed
            ? await db.Song.findOneAndUpdate(
                { _id: songId, likeCount: { $gt: 0 } },
                { $inc: { likeCount: -1 } },
                { new: true }
            ).select('likeCount')
            : null

        const current = updated || await db.Song.findById(songId).select('likeCount')
        return { liked: false, likeCount: current.likeCount, changed: removed }
    },

    // 내가 좋아요한 곡(최신순). Like가 원본이므로 여기서 조인해 온다.
    getLikedSongs: async (userId, page = 1, limit = 50) => {
        const skip = (page - 1) * limit

        const [likes, total] = await Promise.all([
            db.Like.find({ user: userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .populate('song', '_id title artist album coverUrl likeCount playCount')
                .lean(),
            db.Like.countDocuments({ user: userId }),
        ])

        // 곡이 삭제됐는데 Like가 남아있으면 populate 결과가 null → 걸러낸다.
        const songs = likes
            .filter(like => like.song)
            .map(like => ({ ...like.song, likedAt: like.createdAt, liked: true }))

        return { songs, total, page, limit, hasMore: skip + songs.length < total }
    },

    // 재생 1회 기록. 앱이 30초/50% 도달 시 호출한다.
    recordPlay: async (userId, songId, source = 'unknown') => {
        const song = await db.Song.findById(songId).select('_id')
        if (!song) return null

        // 중복 발사 가드 — 짧은 창 안의 같은 곡 재생은 무시.
        const recent = await db.PlayEvent.findOne({
            user: userId,
            song: songId,
            playedAt: { $gte: new Date(Date.now() - PLAY_DEDUPE_WINDOW_MS) },
        }).select('_id')

        if (recent) {
            const current = await db.Song.findById(songId).select('playCount')
            return { playCount: current.playCount, counted: false }
        }

        await db.PlayEvent.create({ user: userId, song: songId, source })
        const updated = await db.Song.findByIdAndUpdate(
            songId,
            { $inc: { playCount: 1 } },
            { new: true }
        ).select('playCount')

        return { playCount: updated.playCount, counted: true }
    },

    // 곡 목록에 현재 사용자의 liked 여부를 붙인다. 목록당 Like 쿼리 1회.
    attachLikedFlags: async (userId, songs) => {
        if (!userId || !songs.length) {
            return songs.map(song => ({ ...song, liked: false }))
        }

        const ids = songs.map(song => song._id)
        const likes = await db.Like.find({ user: userId, song: { $in: ids } }).select('song').lean()
        const likedIds = new Set(likes.map(like => like.song.toString()))

        return songs.map(song => ({ ...song, liked: likedIds.has(song._id.toString()) }))
    },
}
