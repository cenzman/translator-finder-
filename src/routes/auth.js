const express = require("express");
const bcrypt = require("bcryptjs");
const { requireLogin } = require("../middleware/auth");
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

router.get("/profile", requireLogin, (req, res) => {
  if (req.session.userRole !== "translator") {
    return res.status(403).render("error", { message: "Only translators can edit their profile", user: req.session });
  }

  const profile = req.app.locals.db.prepare(`
    SELECT u.name, u.email, tp.languages, tp.bio, tp.experience_years, tp.hourly_rate
    FROM users u
    JOIN translator_profiles tp ON tp.user_id = u.id
    WHERE u.id = ?
  `).get(req.session.userId);

  if (!profile) {
    return res.status(404).render("error", { message: "Profile not found", user: req.session });
  }

  res.render("profile", { profile, error: null, success: null, user: req.session });
});

router.post("/profile", requireLogin, (req, res) => {
  if (req.session.userRole !== "translator") {
    return res.status(403).render("error", { message: "Only translators can edit their profile", user: req.session });
  }

  const { name, email, languages, bio, experience_years, hourly_rate } = req.body;

  if (!name || !email || !languages) {
    const profile = { name: name || "", email: email || "", languages: languages || "", bio: bio || "", experience_years: experience_years || 0, hourly_rate: hourly_rate || 0 };
    return res.status(400).render("profile", { profile, error: "Name, email, and languages are required", success: null, user: req.session });
  }

  const experienceYears = parseInt(experience_years, 10) || 0;
  const rate = parseFloat(hourly_rate) || 0;

  // Check if the new email is already taken by another user
  const existing = req.app.locals.db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, req.session.userId);
  if (existing) {
    const profile = { name, email, languages, bio: bio || "", experience_years: experienceYears, hourly_rate: rate };
    return res.status(400).render("profile", { profile, error: "Email already in use by another account", success: null, user: req.session });
  }

  req.app.locals.db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, req.session.userId);
  req.app.locals.db.prepare("UPDATE translator_profiles SET languages = ?, bio = ?, experience_years = ?, hourly_rate = ? WHERE user_id = ?")
    .run(languages, bio || "", experienceYears, rate, req.session.userId);

  // Update session
  req.session.userName = name;
  req.session.userEmail = email;

  const profile = { name, email, languages, bio: bio || "", experience_years: experienceYears, hourly_rate: rate };
  res.render("profile", { profile, error: null, success: "Profile updated successfully", user: req.session });
});

module.exports = router;
