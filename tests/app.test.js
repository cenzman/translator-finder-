const request = require("supertest");
const path = require("path");
const fs = require("fs");
const { createApp } = require("../src/app");

let app;
const testDbPath = path.join(__dirname, "test.db");

// Helper to extract CSRF token and cookies from a GET response
async function getCsrf(agent, url) {
  const res = await agent.get(url);
  const match = res.text.match(/name="_csrf" value="([^"]+)"/);
  const token = match ? match[1] : "";
  return { token, cookies: res.headers["set-cookie"] };
}

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
    expect(res.text).toContain("Create Account");
  });

  test("GET /auth/login returns 200", async () => {
    const res = await request(app).get("/auth/login");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Sign In");
  });

  test("POST /auth/register creates a client account", async () => {
    const agent = request.agent(app);
    const { token } = await getCsrf(agent, "/auth/register");
    const res = await agent
      .post("/auth/register")
      .type("form")
      .send({ _csrf: token, email: "client@test.com", password: "pass123", name: "Test Client", role: "client" });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });

  test("POST /auth/register creates a translator account with profile", async () => {
    const agent = request.agent(app);
    const { token } = await getCsrf(agent, "/auth/register");
    const res = await agent
      .post("/auth/register")
      .type("form")
      .send({
        _csrf: token,
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
    const agent1 = request.agent(app);
    const { token: t1 } = await getCsrf(agent1, "/auth/register");
    await agent1
      .post("/auth/register")
      .type("form")
      .send({ _csrf: t1, email: "dup@test.com", password: "pass123", name: "User1", role: "client" });

    const agent2 = request.agent(app);
    const { token: t2 } = await getCsrf(agent2, "/auth/register");
    const res = await agent2
      .post("/auth/register")
      .type("form")
      .send({ _csrf: t2, email: "dup@test.com", password: "pass456", name: "User2", role: "client" });
    expect(res.status).toBe(400);
    expect(res.text).toContain("Email already registered");
  });

  test("POST /auth/register rejects missing fields", async () => {
    const agent = request.agent(app);
    const { token } = await getCsrf(agent, "/auth/register");
    const res = await agent
      .post("/auth/register")
      .type("form")
      .send({ _csrf: token, email: "test@test.com" });
    expect(res.status).toBe(400);
  });

  test("POST /auth/login fails with wrong credentials", async () => {
    const agent = request.agent(app);
    const { token } = await getCsrf(agent, "/auth/login");
    const res = await agent
      .post("/auth/login")
      .type("form")
      .send({ _csrf: token, email: "nobody@test.com", password: "wrong" });
    expect(res.status).toBe(400);
  });

  test("POST /auth/login succeeds with correct credentials", async () => {
    const agent = request.agent(app);
    const { token: regToken } = await getCsrf(agent, "/auth/register");
    await agent
      .post("/auth/register")
      .type("form")
      .send({ _csrf: regToken, email: "login@test.com", password: "pass123", name: "LoginUser", role: "client" });

    // Logout first, then login
    await agent.get("/auth/logout");
    const { token: loginToken } = await getCsrf(agent, "/auth/login");
    const res = await agent
      .post("/auth/login")
      .type("form")
      .send({ _csrf: loginToken, email: "login@test.com", password: "pass123" });
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
    const agent = request.agent(app);
    const { token } = await getCsrf(agent, "/auth/register");
    await agent
      .post("/auth/register")
      .type("form")
      .send({
        _csrf: token,
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
    const agent = request.agent(app);
    const { token } = await getCsrf(agent, "/auth/register");
    await agent
      .post("/auth/register")
      .type("form")
      .send({
        _csrf: token,
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
    const agent = request.agent(app);
    const res = await agent
      .post("/reviews")
      .type("form")
      .send({ translator_id: "1", rating: "5", comment: "Great!" });
    // Without login, redirects to login (CSRF or auth redirect)
    expect([302, 403]).toContain(res.status);
  });

  test("Logged-in client can post a review", async () => {
    // Create translator
    const transAgent = request.agent(app);
    const { token: transToken } = await getCsrf(transAgent, "/auth/register");
    await transAgent
      .post("/auth/register")
      .type("form")
      .send({
        _csrf: transToken,
        email: "trans@test.com",
        password: "pass123",
        name: "Translator",
        role: "translator",
        languages: "Vietnamese, Czech",
      });

    // Register client
    const agent = request.agent(app);
    const { token: clientToken } = await getCsrf(agent, "/auth/register");
    await agent
      .post("/auth/register")
      .type("form")
      .send({ _csrf: clientToken, email: "client@test.com", password: "pass123", name: "Client", role: "client" });

    // Get CSRF token from translator detail page (which has the review form)
    const { token: reviewToken } = await getCsrf(agent, "/translators/1");

    // Post review
    const res = await agent
      .post("/reviews")
      .type("form")
      .send({ _csrf: reviewToken, translator_id: "1", rating: "5", comment: "Excellent work!" });
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/translators/1");

    // Verify review appears
    const detailRes = await request(app).get("/translators/1");
    expect(detailRes.text).toContain("Excellent work!");
    expect(detailRes.text).toContain("5.0");
  });
});

describe("Profile Edit Routes", () => {
  test("GET /auth/profile redirects if not logged in", async () => {
    const res = await request(app).get("/auth/profile");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/auth/login");
  });

  test("GET /auth/profile returns 403 for clients", async () => {
    const agent = request.agent(app);
    const { token } = await getCsrf(agent, "/auth/register");
    await agent
      .post("/auth/register")
      .type("form")
      .send({ _csrf: token, email: "client@test.com", password: "pass123", name: "Client", role: "client" });

    const res = await agent.get("/auth/profile");
    expect(res.status).toBe(403);
  });

  test("GET /auth/profile returns 200 for translators", async () => {
    const agent = request.agent(app);
    const { token } = await getCsrf(agent, "/auth/register");
    await agent
      .post("/auth/register")
      .type("form")
      .send({
        _csrf: token,
        email: "trans@test.com",
        password: "pass123",
        name: "Trans User",
        role: "translator",
        languages: "Vietnamese, Czech",
      });

    const res = await agent.get("/auth/profile");
    expect(res.status).toBe(200);
    expect(res.text).toContain("Edit Profile");
    expect(res.text).toContain("Trans User");
  });

  test("POST /auth/profile updates translator info", async () => {
    const agent = request.agent(app);
    const { token: regToken } = await getCsrf(agent, "/auth/register");
    await agent
      .post("/auth/register")
      .type("form")
      .send({
        _csrf: regToken,
        email: "editable@test.com",
        password: "pass123",
        name: "Old Name",
        role: "translator",
        languages: "Vietnamese, Czech",
        bio: "Old bio",
        experience_years: "3",
        hourly_rate: "20",
      });

    const { token: profileToken } = await getCsrf(agent, "/auth/profile");
    const res = await agent
      .post("/auth/profile")
      .type("form")
      .send({
        _csrf: profileToken,
        name: "New Name",
        email: "editable@test.com",
        languages: "Vietnamese, Czech, English",
        bio: "Updated bio",
        experience_years: "5",
        hourly_rate: "30",
      });

    expect(res.status).toBe(200);
    expect(res.text).toContain("Profile updated successfully");
    expect(res.text).toContain("New Name");
    expect(res.text).toContain("Updated bio");

    // Verify in database
    const profile = app.locals.db.prepare("SELECT * FROM translator_profiles").get();
    expect(profile.languages).toBe("Vietnamese, Czech, English");
    expect(profile.experience_years).toBe(5);
    expect(profile.hourly_rate).toBe(30);
  });

  test("POST /auth/profile rejects missing required fields", async () => {
    const agent = request.agent(app);
    const { token: regToken } = await getCsrf(agent, "/auth/register");
    await agent
      .post("/auth/register")
      .type("form")
      .send({
        _csrf: regToken,
        email: "validate@test.com",
        password: "pass123",
        name: "Validator",
        role: "translator",
        languages: "Vietnamese",
      });

    const { token: profileToken } = await getCsrf(agent, "/auth/profile");
    const res = await agent
      .post("/auth/profile")
      .type("form")
      .send({
        _csrf: profileToken,
        name: "",
        email: "validate@test.com",
        languages: "Vietnamese",
      });

    expect(res.status).toBe(400);
    expect(res.text).toContain("required");
  });
});
