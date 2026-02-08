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
  if (req.session.userRole === "translator") {
    const profile = req.app.locals.db.prepare(`
      SELECT u.name, u.email, tp.languages, tp.bio, tp.experience_years, tp.hourly_rate
      FROM users u
      JOIN translator_profiles tp ON tp.user_id = u.id
      WHERE u.id = ?
    `).get(req.session.userId);

    if (!profile) {
      return res.status(404).render("error", { message: res.locals.t.profile.profile_not_found, user: req.session });
    }

    return res.render("profile", { profile, error: null, success: null, user: req.session });
  }

  // Client profile
  const user = req.app.locals.db.prepare("SELECT name, email FROM users WHERE id = ?").get(req.session.userId);
  if (!user) {
    return res.status(404).render("error", { message: res.locals.t.profile.profile_not_found, user: req.session });
  }

  let clientProfile = req.app.locals.db.prepare("SELECT * FROM client_profiles WHERE user_id = ?").get(req.session.userId);
  if (!clientProfile) {
    req.app.locals.db.prepare("INSERT INTO client_profiles (user_id) VALUES (?)").run(req.session.userId);
    clientProfile = req.app.locals.db.prepare("SELECT * FROM client_profiles WHERE user_id = ?").get(req.session.userId);
  }

  const profile = {
    name: user.name,
    email: user.email,
    phone: clientProfile.phone || "",
    company: clientProfile.company || "",
    preferred_languages: clientProfile.preferred_languages || "",
    notes: clientProfile.notes || "",
  };

  const reviews = req.app.locals.db.prepare(`
    SELECT r.rating, r.comment, r.created_at, u.name as translator_name, tp.id as translator_id
    FROM reviews r
    JOIN translator_profiles tp ON r.translator_id = tp.id
    JOIN users u ON tp.user_id = u.id
    WHERE r.client_id = ?
    ORDER BY r.created_at DESC
  `).all(req.session.userId);

  res.render("client-profile", { profile, reviews, error: null, success: null, user: req.session });
});

router.post("/profile", requireLogin, (req, res) => {
  if (req.session.userRole === "translator") {
    const { name, email, languages, bio, experience_years, hourly_rate } = req.body;

    if (!name || !email || !languages) {
      const profile = { name: name || "", email: email || "", languages: languages || "", bio: bio || "", experience_years: experience_years || 0, hourly_rate: hourly_rate || 0 };
      return res.status(400).render("profile", { profile, error: res.locals.t.profile.required_fields, success: null, user: req.session });
    }

    const experienceYears = parseInt(experience_years, 10) || 0;
    const rate = parseFloat(hourly_rate) || 0;

    const existing = req.app.locals.db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, req.session.userId);
    if (existing) {
      const profile = { name, email, languages, bio: bio || "", experience_years: experienceYears, hourly_rate: rate };
      return res.status(400).render("profile", { profile, error: res.locals.t.profile.email_in_use, success: null, user: req.session });
    }

    req.app.locals.db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, req.session.userId);
    req.app.locals.db.prepare("UPDATE translator_profiles SET languages = ?, bio = ?, experience_years = ?, hourly_rate = ? WHERE user_id = ?")
      .run(languages, bio || "", experienceYears, rate, req.session.userId);

    req.session.userName = name;
    req.session.userEmail = email;

    const profile = { name, email, languages, bio: bio || "", experience_years: experienceYears, hourly_rate: rate };
    return res.render("profile", { profile, error: null, success: res.locals.t.profile.profile_updated, user: req.session });
  }

  // Client profile update
  const { name, email, phone, company, preferred_languages, notes } = req.body;

  const clientReviews = req.app.locals.db.prepare(`
    SELECT r.rating, r.comment, r.created_at, u.name as translator_name, tp.id as translator_id
    FROM reviews r
    JOIN translator_profiles tp ON r.translator_id = tp.id
    JOIN users u ON tp.user_id = u.id
    WHERE r.client_id = ?
    ORDER BY r.created_at DESC
  `).all(req.session.userId);

  if (!name || !email) {
    const profile = { name: name || "", email: email || "", phone: phone || "", company: company || "", preferred_languages: preferred_languages || "", notes: notes || "" };
    return res.status(400).render("client-profile", { profile, reviews: clientReviews, error: res.locals.t.profile.required_fields_client, success: null, user: req.session });
  }

  const existing = req.app.locals.db.prepare("SELECT id FROM users WHERE email = ? AND id != ?").get(email, req.session.userId);
  if (existing) {
    const profile = { name, email, phone: phone || "", company: company || "", preferred_languages: preferred_languages || "", notes: notes || "" };
    return res.status(400).render("client-profile", { profile, reviews: clientReviews, error: res.locals.t.profile.email_in_use, success: null, user: req.session });
  }

  req.app.locals.db.prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, req.session.userId);

  // Upsert client profile
  const existingProfile = req.app.locals.db.prepare("SELECT id FROM client_profiles WHERE user_id = ?").get(req.session.userId);
  if (existingProfile) {
    req.app.locals.db.prepare("UPDATE client_profiles SET phone = ?, company = ?, preferred_languages = ?, notes = ? WHERE user_id = ?")
      .run(phone || "", company || "", preferred_languages || "", notes || "", req.session.userId);
  } else {
    req.app.locals.db.prepare("INSERT INTO client_profiles (user_id, phone, company, preferred_languages, notes) VALUES (?, ?, ?, ?, ?)")
      .run(req.session.userId, phone || "", company || "", preferred_languages || "", notes || "");
  }

  req.session.userName = name;
  req.session.userEmail = email;

  const profile = { name, email, phone: phone || "", company: company || "", preferred_languages: preferred_languages || "", notes: notes || "" };
  res.render("client-profile", { profile, reviews: clientReviews, error: null, success: res.locals.t.profile.profile_updated, user: req.session });
});

module.exports = router;
