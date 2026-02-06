const express = require("express");
const { requireRole } = require("../middleware/auth");
const router = express.Router();

router.post("/", requireRole("client"), (req, res) => {
  const { translator_id, rating, comment } = req.body;
  const translatorId = parseInt(translator_id, 10);
  const ratingNum = parseInt(rating, 10);

  if (isNaN(translatorId) || isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
    return res.status(400).render("error", { message: "Invalid review data", user: req.session });
  }

  const translator = req.app.locals.db.prepare("SELECT id FROM translator_profiles WHERE id = ?").get(translatorId);
  if (!translator) {
    return res.status(404).render("error", { message: "Translator not found", user: req.session });
  }

  req.app.locals.db.prepare(
    "INSERT INTO reviews (translator_id, client_id, rating, comment) VALUES (?, ?, ?, ?)"
  ).run(translatorId, req.session.userId, ratingNum, comment || "");

  res.redirect("/translators/" + translatorId);
});

module.exports = router;
