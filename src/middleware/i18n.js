const path = require("path");
const fs = require("fs");

const SUPPORTED_LANGS = ["en", "cs", "vi"];
const DEFAULT_LANG = "en";

const translations = {};
SUPPORTED_LANGS.forEach((lang) => {
  const filePath = path.join(__dirname, "..", "..", "locales", `${lang}.json`);
  translations[lang] = JSON.parse(fs.readFileSync(filePath, "utf8"));
});

function i18nMiddleware(req, res, next) {
  // Determine language: query param > session > cookie > default
  let lang = req.query.lang || (req.session && req.session.lang) || req.cookies.lang || DEFAULT_LANG;
  if (!SUPPORTED_LANGS.includes(lang)) {
    lang = DEFAULT_LANG;
  }

  // Persist language choice
  if (req.query.lang && SUPPORTED_LANGS.includes(req.query.lang)) {
    if (req.session) {
      req.session.lang = lang;
    }
    res.cookie("lang", lang, { maxAge: 365 * 24 * 60 * 60 * 1000, httpOnly: false });
  }

  res.locals.lang = lang;
  res.locals.t = translations[lang];
  res.locals.supportedLangs = SUPPORTED_LANGS;
  next();
}

module.exports = { i18nMiddleware, translations, SUPPORTED_LANGS, DEFAULT_LANG };
