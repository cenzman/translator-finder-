const { createApp } = require("./src/app");

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === "production") {
  if (!process.env.SESSION_SECRET || !process.env.CSRF_SECRET) {
    console.error("ERROR: SESSION_SECRET and CSRF_SECRET environment variables must be set in production.");
    process.exit(1);
  }
}

const app = createApp();

app.listen(PORT, () => {
  console.log(`Translator Finder running at http://localhost:${PORT}`);
});
