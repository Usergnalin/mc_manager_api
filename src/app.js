const express = require("express")
const cookieParser = require("cookie-parser")
const helmet = require("helmet")
const cors = require("cors")
const path = require("path")
const mainRoutes = require("./routes/mainRoutes")
const app = express()

const content_security_policy = {
    directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'"],
        "style-src": ["'self'", "https://fonts.googleapis.com"],
        "img-src": ["'self'", "data:", "blob:", "https://gnalin.xyz", "https://www.gnalin.xyz"],
        "font-src": ["'self'", "https://fonts.gstatic.com"],
        "connect-src": ["'self'"],
        "object-src": ["'none'"],
        "base-uri": ["'self'"],
        "form-action": ["'self'"],
        "frame-ancestors": ["'none'"],
        "upgrade-insecure-requests": [],
    },
}

app.use(
    helmet({
        contentSecurityPolicy: content_security_policy,
        hsts: false,
    }),
)

const allowedOrigins = ["https://www.gnalin.xyz", "https://gnalin.xyz"]

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

app.disable("x-powered-by")
app.use(express.json())
app.use(express.urlencoded({ extended: false }))
app.use(cookieParser())

app.use("/api", mainRoutes)
// app.use("/", express.static("public"))

// app.use("/vendor/bootstrap", express.static("node_modules/bootstrap/dist"))
// app.use("/vendor/icons", express.static("node_modules/bootstrap-icons/font"))
// app.use("/vendor/zxcvbn", express.static("node_modules/zxcvbn/dist"))
// app.use("/vendor/dompurify", express.static("node_modules/dompurify/dist"))
// app.use("/vendor/marked", express.static("node_modules/marked/lib"))

app.use((req, res, next) => {
    res.status(404).send("Page Not Found")
})

module.exports = app
