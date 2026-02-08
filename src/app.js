const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { doubleCsrf } = require("csrf-csrf");
const path = require("path");
const { createDb } = require("./db");
const { i18nMiddleware } = require("./middleware/i18n");

function createApp(dbPath) {
  const app = express();

  app.locals.db = createDb(dbPath || process.env.DATABASE_PATH);

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));

  app.use(helmet());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(cookieParser(process.env.CSRF_SECRET || "csrf-secret-key"));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "translator-finder-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production" },
    })
  );

  app.use(i18nMiddleware);

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    message: "Too many requests, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });

  const { generateToken, doubleCsrfProtection } = doubleCsrf({
    getSecret: () => process.env.CSRF_SECRET || "csrf-secret-key",
    cookieName: "_csrf",
    cookieOptions: { signed: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" },
    getTokenFromRequest: (req) => req.body._csrf,
  });

  app.use((req, res, next) => {
    res.locals.generateCsrfToken = () => generateToken(req, res);
    next();
  });

  app.get("/health", (req, res) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/auth", authLimiter, doubleCsrfProtection, require("./routes/auth"));
  app.use("/translators", require("./routes/translators"));
  app.use("/reviews", doubleCsrfProtection, require("./routes/reviews"));

  app.get("/", (req, res) => {
    res.render("index", { user: req.session });
  });

  app.use((err, req, res, _next) => {
    const status = err.status || 500;
    const message = process.env.NODE_ENV === "production" ? "Something went wrong" : err.message;
    res.status(status).render("error", { message, user: req.session || {} });
  });

  return app;
}

module.exports = { createApp };
