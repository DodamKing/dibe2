const db = require('../models')

module.exports = {
    createPlaylist: async (name, userId) => {
        try {
            const newPlaylist = new db.Playlist({
                name,
                user: userId,
                songs: []
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
            const playlists = await db.Playlist.find({ user: userId }).sort({ createdAt: -1 })
            return playlists
        } catch (err) {
            console.error(err)
        }
    },

    deletePlaylist: async (playlistId, userId) => {
        try {
            await db.Playlist.findByIdAndDelete(playlistId)
            const updatedPlaylists = await db.Playlist.find({ user: userId })
            return updatedPlaylists
        } catch (err) {
            console.error(err)
        }
    },

    addToPlaylist: async (playlistId, songs) => {
        try {
            const playlist = await db.Playlist.findById(playlistId)
            if (!playlist) return { success: false, error: 'Playlist not found' }
            
            const newSongs = songs.map(song => ({
                songId: song._id,
                title: song.title,
                artist: song.artist,
                coverUrl: song.coverUrl
            }))

            const uniqueNewSongs = newSongs.filter(newSong => 
                !playlist.songs.some(existingSongs => existingSongs.songId.toString() === newSong.songId.toString())
            )

            playlist.songs.push(...uniqueNewSongs)
            await playlist.save()

            return { success: true, addedSongs: uniqueNewSongs.length, playlist }
        } catch (err) {
            console.error('내플레이리스트 노래 추가 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    removeSongsFromPlaylist: async (playlistId, songIds) => {
        try {
            const playlist = await db.Playlist.findOneAndUpdate(
                { _id: playlistId },
                { $pull: { songs: { songId: { $in: songIds } } } },
                { new: true, projection: { songs: 1 } } // 업데이트된 문서를 반환하고, songs 필드만 가져옴
            )

            if (!playlist) {
                return { success: false, error: '플레이리스트를 찾을 수 없습니다.' }
            }

            const removedCount = songIds.length - playlist.songs.filter(song => songIds.includes(song.songId.toString())).length

            return { success: true, message: '곡이 성공적으로 제거되었습니다.', removedCount, playlist }
        } catch (err) {
            console.error('내 플레이리스트 노래 제거 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    readPlaylist: async (playlistId) => {
        try {
            const playlist = await db.Playlist.findById(playlistId)
            return { success: true, playlist }
        } catch (err) {
            console.error('플레이리스트 불러오기 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    rename: async (id, name) => {
        try {
            const playlist = await db.Playlist.findByIdAndUpdate(id, { name }, { new: true })
            return { success: true, playlist }
        } catch (err) {
            console.error('프렐이리스트 이름 수정 서비스 에러:', err)
            return { success: false, error: err }
        }
    }
}