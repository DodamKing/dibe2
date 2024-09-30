import cors from 'cors'

const corsOptions = {
    origin: ['https://www.youtube.com', 'https://www.youtube-nocookie.com', 'https://dibe2.dimad.site'],
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
};

export default function (req, res, next) {
    if (process.env.NODE_ENV === 'production') {
        cors(corsOptions)(req, res, next)
    }
    else next()
}