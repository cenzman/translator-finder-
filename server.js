const { createApp } = require("./src/app");

const app = createApp();
const PORT = process.env.PORT || 3000;

// Only listen when running locally (not on Vercel)
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => {
    console.log(`Translator Finder running at http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
