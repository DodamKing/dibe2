const db = require('../models')

// 🔴 플리 하나를 다루는 모든 쿼리는 `{ _id, user: userId }`로 **내 것만** 집는다(2026-10-31 전엔 id만 알면
// 남의 플리를 읽고·고치고·지울 수 있었다). 남의 것은 "없음"과 똑같이 응답 — 존재 여부도 알려주지 않는다.
module.exports = {
    createPlaylist: async (name, userId) => {
        try {
            const newPlaylist = new db.VideoPlaylist({
                name,
                user: userId,
                videos: []
            })
            await newPlaylist.save()

            return newPlaylist
        } catch (err) {
            console.error(err)
            return err.message
        }
    },

    readPlaylists: async (userId) => {
        try {
            const playlists = await db.VideoPlaylist.find({ user: userId }).sort({ createdAt: -1 })
            return playlists
        } catch (err) {
            console.error(err)
        }
    },

    deletePlaylist: async (playlistId, userId) => {
        try {
            await db.VideoPlaylist.deleteOne({ _id: playlistId, user: userId })
            const updatedPlaylists = await db.VideoPlaylist.find({ user: userId })
            return updatedPlaylists
        } catch (err) {
            console.error(err)
        }
    },

    addToPlaylist: async (playlistId, userId, videos) => {
        try {
            const playlist = await db.VideoPlaylist.findOne({ _id: playlistId, user: userId })
            if (!playlist) return { success: false, error: 'Playlist not found' }

            const newVideos = videos.map(video => ({
                videoId: video.id || video.videoId,
                title: video.title,
                thumbnail: video.thumbnail,
                channelTitle: video.channelTitle,
                duration: video.duration
            }))

            const uniqueNewVideos = newVideos.filter(newVideo =>
                !playlist.videos.some(existingVideo => existingVideo.videoId === newVideo.videoId)
            )

            playlist.videos.push(...uniqueNewVideos)
            await playlist.save()

            return { success: true, addedVideos: uniqueNewVideos.length, playlist }
        } catch (err) {
            console.error('내 비디오 플레이리스트 영상 추가 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    removeVideosFromPlaylist: async (playlistId, userId, videoIds) => {
        try {
            const playlist = await db.VideoPlaylist.findOneAndUpdate(
                { _id: playlistId, user: userId },
                { $pull: { videos: { videoId: { $in: videoIds } } } },
                { new: true, projection: { videos: 1 } } // 업데이트된 문서를 반환하고, videos 필드만 가져옴
            )

            if (!playlist) {
                return { success: false, error: '플레이리스트를 찾을 수 없습니다.' }
            }

            const removedCount = videoIds.length - playlist.videos.filter(video => videoIds.includes(video.videoId)).length

            return { success: true, message: '영상이 성공적으로 제거되었습니다.', removedCount, playlist }
        } catch (err) {
            console.error('내 비디오 플레이리스트 영상 제거 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    readPlaylist: async (playlistId, userId) => {
        try {
            const playlist = await db.VideoPlaylist.findOne({ _id: playlistId, user: userId })
            return { success: true, playlist }
        } catch (err) {
            console.error('비디오 플레이리스트 불러오기 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    rename: async (id, userId, name) => {
        try {
            const playlist = await db.VideoPlaylist.findOneAndUpdate({ _id: id, user: userId }, { name }, { new: true })
            return { success: true, playlist }
        } catch (err) {
            console.error('비디오 플레이리스트 이름 수정 서비스 에러:', err)
            return { success: false, error: err }
        }
    }
}
