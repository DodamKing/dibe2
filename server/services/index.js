const playlistService = require("./playlistService")
const videoPlaylistService = require("./videoPlaylistService")
const userService = require("./userService")
const adminService = require('./adminService')
const statsService = require('./statsService')
const themeService = require('./themeService')

module.exports = {
    songService: require("./songService"),
    playlistService,
    videoPlaylistService,
    userService,
    adminService,
    statsService,
    themeService
}