# Translator Finder

A web application that connects clients with professional translators. Users can register as translators or clients, browse translator profiles, and leave reviews.

## Features

- User registration and login (translator or client roles)
- Translator profiles with languages, experience, and hourly rates
- Client reviews with 1–5 star ratings
- CSRF protection, session management, and rate limiting

## Requirements

- Node.js 18+
- npm

## Quick Start

```bash
# Install dependencies
npm install

# Copy the example env file and edit with your own secrets
cp .env.example .env

# Start the server
node server.js
```

The app runs at `http://localhost:3000` by default.

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | — | Set to `production` for secure cookies and error handling |
| `SESSION_SECRET` | In production | fallback value | Secret for signing session cookies |
| `CSRF_SECRET` | In production | fallback value | Secret for CSRF token generation |
| `DATABASE_PATH` | No | `./translator_finder.db` | Path to the SQLite database file |

> **Note:** `SESSION_SECRET` and `CSRF_SECRET` **must** be set when `NODE_ENV=production`. The server will refuse to start without them.

## Running Tests

```bash
npm test
```

## Docker

```bash
# Build the image
docker build -t translator-finder .

# Run the container
docker run -p 3000:3000 \
  -e NODE_ENV=production \
  -e SESSION_SECRET=your-secret-here \
  -e CSRF_SECRET=your-csrf-secret-here \
  translator-finder
```

## Project Structure

```
├── server.js              # Entry point
├── src/
│   ├── app.js             # Express app setup
│   ├── db.js              # SQLite schema and connection
│   ├── middleware/
│   │   └── auth.js        # Authentication middleware
│   └── routes/
│       ├── auth.js        # Register / login / logout
│       ├── translators.js # Translator listing and detail
│       └── reviews.js     # Review submission
├── views/                 # EJS templates
├── public/                # Static assets
└── tests/                 # Jest test suite
```