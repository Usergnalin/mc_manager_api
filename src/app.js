import express from 'express'
import cookieParser from 'cookie-parser'
import helmet from 'helmet'
import cors from 'cors'
import mainRoutes from './routes/mainRoutes.js'
import pinoHttp from 'pino-http'
import logger from './services/logger.js'
import {JSON_MAX_BODY_SIZE} from './configs/constants.js'

const app = express()

const content_security_policy = {
    directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'", 'https://fonts.googleapis.com'],
        'img-src': ["'self'", 'data:', 'blob:', 'https://gnalin.xyz', 'https://www.gnalin.xyz'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'connect-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': [],
    },
}

app.use(
    helmet({
        contentSecurityPolicy: content_security_policy,
        hsts: false,
    }),
)

const allowedOrigins = ['https://www.gnalin.xyz', 'https://gnalin.xyz', 'https://gnalin.xyz:5174']

app.use(
    cors({
        origin: function (origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true)
            } else {
                callback(null, false)
            }
        },
        credentials: true,
    }),
)

app.disable('x-powered-by')
app.use(pinoHttp({logger}))
app.use(express.json({ limit: JSON_MAX_BODY_SIZE}))
app.use(express.urlencoded({extended: false}))
app.use(cookieParser())

app.use('/api', mainRoutes)
// app.use("/", express.static("public"))

// app.use("/vendor/bootstrap", express.static("node_modules/bootstrap/dist"))
// app.use("/vendor/icons", express.static("node_modules/bootstrap-icons/font"))
// app.use("/vendor/zxcvbn", express.static("node_modules/zxcvbn/dist"))
// app.use("/vendor/dompurify", express.static("node_modules/dompurify/dist"))
// app.use("/vendor/marked", express.static("node_modules/marked/lib"))

app.use((req, res, _next) => {
    res.status(404).send('Page Not Found')
})

app.use((err, req, res, _next) => {
    try {
        req.log.error(err)
        res.status(500).json({error: 'Internal Server Error'})
    } catch (error) {
        logger.error(error, 'Failed to handle error')
    }
})

export default app
