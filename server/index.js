const express = require('express')
const { Nuxt, Builder } = require('nuxt')
const config = require('../nuxt.config')
// const apiRoutes = require('./api')
const userRoutes = require('./api/user')

const app = express()
const nuxt = new Nuxt(config)

async function start() {
    await nuxt.ready()
    if (config.dev) {
        const builder = new Builder(nuxt)
        await builder.build()
    }

    app.use(express.json())
    app.use(express.urlencoded({ extended: true }))

    // app.use('/api', apiRoutes)
    app.use('/users', userRoutes)

    const { host, port } = nuxt.options.server
    app.listen(port, host, () => {
        console.log(`Server listening on http://${host}:${port}`)
    })
}

start()