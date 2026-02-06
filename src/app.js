const express = require("express");
const session = require("express-session");
const path = require("path");
const { createDb } = require("./db");

function createApp(dbPath) {
  const app = express();

  app.locals.db = createDb(dbPath);

  app.set("view engine", "ejs");
  app.set("views", path.join(__dirname, "..", "views"));

  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, "..", "public")));
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "translator-finder-secret-key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: false },
    })
  );

  app.use("/auth", require("./routes/auth"));
  app.use("/translators", require("./routes/translators"));
  app.use("/reviews", require("./routes/reviews"));

  app.get("/", (req, res) => {
    res.render("index", { user: req.session });
  });

  return app;
}

module.exports = { createApp };
