const express = require("express");
const bcrypt = require("bcryptjs");
const router = express.Router();

router.get("/register", (req, res) => {
  res.render("register", { error: null, user: req.session });
});

router.post("/register", async (req, res) => {
  const { email, password, name, role } = req.body;

  if (!email || !password || !name || !role) {
    return res.status(400).render("register", { error: "All fields are required", user: req.session });
  }

  if (!["translator", "client"].includes(role)) {
    return res.status(400).render("register", { error: "Invalid role", user: req.session });
  }

  try {
    const existing = req.app.locals.db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (existing) {
      return res.status(400).render("register", { error: "Email already registered", user: req.session });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = req.app.locals.db.prepare(
      "INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)"
    ).run(email, hashedPassword, name, role);

    if (role === "translator") {
      const languages = req.body.languages || "Vietnamese, Czech";
      const bio = req.body.bio || "";
      const experienceYears = parseInt(req.body.experience_years, 10) || 0;
      const hourlyRate = parseFloat(req.body.hourly_rate) || 0;

      req.app.locals.db.prepare(
        "INSERT INTO translator_profiles (user_id, languages, bio, experience_years, hourly_rate) VALUES (?, ?, ?, ?, ?)"
      ).run(result.lastInsertRowid, languages, bio, experienceYears, hourlyRate);
    }

    req.session.userId = result.lastInsertRowid;
    req.session.userName = name;
    req.session.userRole = role;
    req.session.userEmail = email;

    res.redirect("/");
  } catch (err) {
    return res.status(500).render("register", { error: "Registration failed", user: req.session });
  }
});

router.get("/login", (req, res) => {
  res.render("login", { error: null, user: req.session });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).render("login", { error: "Email and password are required", user: req.session });
  }

  const userRow = req.app.locals.db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!userRow) {
    return res.status(400).render("login", { error: "Invalid email or password", user: req.session });
  }

  const valid = await bcrypt.compare(password, userRow.password);
  if (!valid) {
    return res.status(400).render("login", { error: "Invalid email or password", user: req.session });
  }

  req.session.userId = userRow.id;
  req.session.userName = userRow.name;
  req.session.userRole = userRow.role;
  req.session.userEmail = userRow.email;

  res.redirect("/");
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

module.exports = router;
