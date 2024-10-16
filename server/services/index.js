const playlistService = require("./playlistService")
const userService = require("./userService")
const adminService = require('./adminService')

module.exports = {
    songService: require("./songService"),
    playlistService,
    userService,
    adminService
}