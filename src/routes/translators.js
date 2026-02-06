const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  const translators = req.app.locals.db.prepare(`
    SELECT tp.id, tp.languages, tp.bio, tp.experience_years, tp.hourly_rate,
           u.name, u.email
    FROM translator_profiles tp
    JOIN users u ON tp.user_id = u.id
    ORDER BY tp.created_at DESC
  `).all();

  // Get average ratings
  const translatorList = translators.map((t) => {
    const ratingRow = req.app.locals.db.prepare(
      "SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE translator_id = ?"
    ).get(t.id);
    return {
      ...t,
      avg_rating: ratingRow.avg_rating ? ratingRow.avg_rating.toFixed(1) : "No reviews",
      review_count: ratingRow.review_count,
    };
  });

  res.render("translators", { translators: translatorList, user: req.session });
});

router.get("/:id", (req, res) => {
  const translatorId = parseInt(req.params.id, 10);
  if (isNaN(translatorId)) {
    return res.status(400).render("error", { message: "Invalid translator ID", user: req.session });
  }

  const translator = req.app.locals.db.prepare(`
    SELECT tp.id, tp.languages, tp.bio, tp.experience_years, tp.hourly_rate,
           u.name, u.email
    FROM translator_profiles tp
    JOIN users u ON tp.user_id = u.id
    WHERE tp.id = ?
  `).get(translatorId);

  if (!translator) {
    return res.status(404).render("error", { message: "Translator not found", user: req.session });
  }

  const reviews = req.app.locals.db.prepare(`
    SELECT r.rating, r.comment, r.created_at, u.name as client_name
    FROM reviews r
    JOIN users u ON r.client_id = u.id
    WHERE r.translator_id = ?
    ORDER BY r.created_at DESC
  `).all(translatorId);

  const ratingRow = req.app.locals.db.prepare(
    "SELECT AVG(rating) as avg_rating, COUNT(*) as review_count FROM reviews WHERE translator_id = ?"
  ).get(translatorId);

  res.render("translator-detail", {
    translator,
    reviews,
    avg_rating: ratingRow.avg_rating ? ratingRow.avg_rating.toFixed(1) : "No reviews",
    review_count: ratingRow.review_count,
    user: req.session,
  });
});

module.exports = router;
