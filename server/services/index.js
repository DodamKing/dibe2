const playlistService = require("./playlistService")
const videoPlaylistService = require("./videoPlaylistService")
const userService = require("./userService")
const adminService = require('./adminService')
const statsService = require('./statsService')

module.exports = {
    songService: require("./songService"),
    playlistService,
    videoPlaylistService,
    userService,
    adminService,
    statsService
}