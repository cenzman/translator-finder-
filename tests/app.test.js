const request = require("supertest");
const path = require("path");
const fs = require("fs");
const { createApp } = require("../src/app");

let app;
const testDbPath = path.join(__dirname, "test.db");

beforeEach(() => {
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
  app = createApp(testDbPath);
});

afterEach(() => {
  if (app.locals.db) {
    app.locals.db.close();
  }
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }
});

describe("Home Page", () => {
  test("GET / returns 200", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Translator Finder");
  });
});

describe("Auth Routes", () => {
  test("GET /auth/register returns 200", async () => {
    const res = await request(app).get("/auth/register");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Register");
  });

  test("GET /auth/login returns 200", async () => {
    const res = await request(app).get("/auth/login");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Login");
  });

  test("POST /auth/register creates a client account", async () => {
    const res = await request(app)
      .post("/auth/register")
      .type("form")
      .send({ email: "client@test.com", password: "pass123", name: "Test Client", role: "client" });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  test("POST /auth/register creates a translator account with profile", async () => {
    const res = await request(app)
      .post("/auth/register")
      .type("form")
      .send({
        email: "translator@test.com",
        password: "pass123",
        name: "Test Translator",
        role: "translator",
        languages: "Vietnamese, Czech",
        bio: "Experienced translator",
        experience_years: "5",
        hourly_rate: "25",
      });
    expect(res.status).toBe(302);

    const profile = app.locals.db.prepare("SELECT * FROM translator_profiles").get();
    expect(profile).toBeDefined();
    expect(profile.languages).toBe("Vietnamese, Czech");
    expect(profile.experience_years).toBe(5);
  });

  test("POST /auth/register rejects duplicate email", async () => {
    await request(app)
      .post("/auth/register")
      .type("form")
      .send({ email: "dup@test.com", password: "pass123", name: "User1", role: "client" });

    const res = await request(app)
      .post("/auth/register")
      .type("form")
      .send({ email: "dup@test.com", password: "pass456", name: "User2", role: "client" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Email already registered");
  });

  test("POST /auth/register rejects missing fields", async () => {
    const res = await request(app)
      .post("/auth/register")
      .type("form")
      .send({ email: "test@test.com" });
    expect(res.status).toBe(400);
  });

  test("POST /auth/login fails with wrong credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .type("form")
      .send({ email: "nobody@test.com", password: "wrong" });
    expect(res.status).toBe(400);
  });

  test("POST /auth/login succeeds with correct credentials", async () => {
    await request(app)
      .post("/auth/register")
      .type("form")
      .send({ email: "login@test.com", password: "pass123", name: "LoginUser", role: "client" });

    const res = await request(app)
      .post("/auth/login")
      .type("form")
      .send({ email: "login@test.com", password: "pass123" });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });
});

describe("Translator Routes", () => {
  test("GET /translators returns 200 with empty list", async () => {
    const res = await request(app).get("/translators");
    expect(res.status).toBe(200);
    expect(res.text).toContain("No translators have registered yet");
  });

  test("GET /translators shows registered translators", async () => {
    await request(app)
      .post("/auth/register")
      .type("form")
      .send({
        email: "trans@test.com",
        password: "pass123",
        name: "Jane Translator",
        role: "translator",
        languages: "Vietnamese, Czech",
      });

    const res = await request(app).get("/translators");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Jane Translator");
    expect(res.text).toContain("Vietnamese, Czech");
  });

  test("GET /translators/:id shows translator detail", async () => {
    await request(app)
      .post("/auth/register")
      .type("form")
      .send({
        email: "detail@test.com",
        password: "pass123",
        name: "Detail Translator",
        role: "translator",
        languages: "Vietnamese, Czech",
        bio: "A great translator",
      });

    const res = await request(app).get("/translators/1");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Detail Translator");
    expect(res.text).toContain("A great translator");
  });

  test("GET /translators/999 returns 404", async () => {
    const res = await request(app).get("/translators/999");
    expect(res.status).toBe(404);
  });

  test("GET /translators/abc returns 400", async () => {
    const res = await request(app).get("/translators/abc");
    expect(res.status).toBe(400);
  });
});

describe("Review Routes", () => {
  test("POST /reviews requires client login", async () => {
    const res = await request(app)
      .post("/reviews")
      .type("form")
      .send({ translator_id: "1", rating: "5", comment: "Great!" });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/login");
  });

  test("Logged-in client can post a review", async () => {
    // Create translator
    await request(app)
      .post("/auth/register")
      .type("form")
      .send({
        email: "trans@test.com",
        password: "pass123",
        name: "Translator",
        role: "translator",
        languages: "Vietnamese, Czech",
      });

    // Register client and get session cookie
    const agent = request.agent(app);
    await agent
      .post("/auth/register")
      .type("form")
      .send({ email: "client@test.com", password: "pass123", name: "Client", role: "client" });

    // Post review
    const res = await agent
      .post("/reviews")
      .type("form")
      .send({ translator_id: "1", rating: "5", comment: "Excellent work!" });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/translators/1");

    // Verify review appears
    const detailRes = await request(app).get("/translators/1");
    expect(detailRes.text).toContain("Excellent work!");
    expect(detailRes.text).toContain("5.0");
  });
});
