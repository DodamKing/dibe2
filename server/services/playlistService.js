const mongoose = require('mongoose')
const db = require('../models')

// 🔴 플리 하나를 다루는 모든 쿼리는 `{ _id, user: userId }`로 **내 것만** 집는다(2026-10-31 전엔 id만 알면
// 남의 플리를 읽고·고치고·지울 수 있었다). 남의 것은 "없음"과 똑같이 응답 — 존재 여부도 알려주지 않는다.
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
            await db.Playlist.deleteOne({ _id: playlistId, user: userId })
            const updatedPlaylists = await db.Playlist.find({ user: userId })
            return updatedPlaylists
        } catch (err) {
            console.error(err)
        }
    },

    addToPlaylist: async (playlistId, userId, songs) => {
        try {
            const playlist = await db.Playlist.findOne({ _id: playlistId, user: userId })
            if (!playlist) return { success: false, error: 'Playlist not found' }
            
            // 받은 `_id`를 그대로 믿지 않는다. 웹이 차트 항목(서브문서 `_id` = 곡이 아님)을 그대로 보내
            // 어떤 Song 도 가리키지 않는 songId 가 쌓여 왔다(2026-10-31 발견, 82곡 중 27곡).
            // 실제 Song 이 아니면 title+artist 로 찾아 잇고, 그래도 없으면 넣지 않는다.
            const validIds = songs.map(song => song._id).filter(id => mongoose.Types.ObjectId.isValid(id))
            const existing = new Set(
                (await db.Song.find({ _id: { $in: validIds } }).select('_id').lean()).map(s => s._id.toString())
            )

            const newSongs = []
            for (const song of songs) {
                let songId = song._id && existing.has(String(song._id)) ? song._id : null
                if (!songId) {
                    const found = await db.Song.findOne({ title: song.title, artist: song.artist }).select('_id').lean()
                    if (!found) continue
                    songId = found._id
                }
                newSongs.push({ songId, title: song.title, artist: song.artist, coverUrl: song.coverUrl })
            }

            const uniqueNewSongs = newSongs.filter((newSong, i) =>
                !playlist.songs.some(existingSongs => existingSongs.songId.toString() === newSong.songId.toString()) &&
                newSongs.findIndex(s => s.songId.toString() === newSong.songId.toString()) === i
            )

            playlist.songs.push(...uniqueNewSongs)
            await playlist.save()

            return { success: true, addedSongs: uniqueNewSongs.length, playlist }
        } catch (err) {
            console.error('내플레이리스트 노래 추가 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    removeSongsFromPlaylist: async (playlistId, userId, songIds) => {
        try {
            const playlist = await db.Playlist.findOneAndUpdate(
                { _id: playlistId, user: userId },
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

    readPlaylist: async (playlistId, userId) => {
        try {
            const playlist = await db.Playlist.findOne({ _id: playlistId, user: userId })
            return { success: true, playlist }
        } catch (err) {
            console.error('플레이리스트 불러오기 서비스 에러:', err)
            return { success: false, error: err }
        }
    },

    rename: async (id, userId, name) => {
        try {
            const playlist = await db.Playlist.findOneAndUpdate({ _id: id, user: userId }, { name }, { new: true })
            return { success: true, playlist }
        } catch (err) {
            console.error('프렐이리스트 이름 수정 서비스 에러:', err)
            return { success: false, error: err }
        }
    }
}