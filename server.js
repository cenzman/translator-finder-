const { createApp } = require("./src/app");

const app = createApp();
const PORT = process.env.PORT || 3000;

// Vercel handles listening itself via the serverless export.
// On all other platforms (Render, local, etc.) we must bind to a port.
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Translator Finder running at http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
