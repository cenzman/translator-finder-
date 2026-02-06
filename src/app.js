const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { doubleCsrf } = require("csrf-csrf");
const path = require("path");
const { createDb } = require("./db");

function createApp(dbPath) {
  const app = express();

  app.locals.db = createDb(dbPath);

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));

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

  app.use("/auth", doubleCsrfProtection, require("./routes/auth"));
  app.use("/translators", require("./routes/translators"));
  app.use("/reviews", doubleCsrfProtection, require("./routes/reviews"));

  app.get("/", (req, res) => {
    res.render("index", { user: req.session });
  });

  return app;
}

module.exports = { createApp };
