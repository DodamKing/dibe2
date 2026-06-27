const db = require('../models')

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
            await db.VideoPlaylist.findByIdAndDelete(playlistId)
            const updatedPlaylists = await db.VideoPlaylist.find({ user: userId })
            return updatedPlaylists
        } catch (err) {
            console.error(err)
        }
    },

    addToPlaylist: async (playlistId, videos) => {
        try {
            const playlist = await db.VideoPlaylist.findById(playlistId)
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

    removeVideosFromPlaylist: async (playlistId, videoIds) => {
        try {
            const playlist = await db.VideoPlaylist.findOneAndUpdate(
                { _id: playlistId },
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

    readPlaylist: async (playlistId) => {
        try {
            const playlist = await db.VideoPlaylist.findById(playlistId)
            return { success: true, playlist }
        } catch (err) {
            console.error('비디오 플레이리스트 불러오기 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    rename: async (id, name) => {
        try {
            const playlist = await db.VideoPlaylist.findByIdAndUpdate(id, { name }, { new: true })
            return { success: true, playlist }
        } catch (err) {
            console.error('비디오 플레이리스트 이름 수정 서비스 에러:', err)
            return { success: false, error: err }
        }
    }
}
