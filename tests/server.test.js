const { exec } = require("child_process");
const path = require("path");

// Helper to get an available port
function getRandomPort() {
  return 3000 + Math.floor(Math.random() * 5000);
}

describe("Server Listening Behavior", () => {
  const serverPath = path.join(__dirname, "..", "server.js");

  test("should listen when VERCEL env variable is not set", (done) => {
    const port = getRandomPort();
    const env = { ...process.env, PORT: port.toString() };
    delete env.VERCEL;
    delete env.NODE_ENV;

    const child = exec(`node ${serverPath}`, { env }, (error) => {
      if (error && error.killed) {
        // Process was killed by us, which is expected
        return;
      }
    });

    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      output += data.toString();
    });

    setTimeout(() => {
      expect(output).toContain("Translator Finder running at http://localhost:");
      expect(output).toContain(port.toString());
      child.kill();
      done();
    }, 2000);
  }, 10000);

  test("should listen when NODE_ENV is production but VERCEL is not set", (done) => {
    const port = getRandomPort();
    const env = { ...process.env, NODE_ENV: "production", PORT: port.toString() };
    delete env.VERCEL;

    const child = exec(`node ${serverPath}`, { env }, (error) => {
      if (error && error.killed) {
        // Process was killed by us, which is expected
        return;
      }
    });

    let output = "";
    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      output += data.toString();
    });

    setTimeout(() => {
      expect(output).toContain("Translator Finder running at http://localhost:");
      expect(output).toContain(port.toString());
      child.kill();
      done();
    }, 2000);
  }, 10000);

  test("should not listen when VERCEL env variable is set", (done) => {
    const env = { ...process.env, VERCEL: "1" };

    const child = exec(`node ${serverPath}`, { env }, (error) => {
      if (error && error.killed) {
        // Process was killed by us, which is expected
        return;
      }
    });

    let output = "";
    let hasExited = false;

    child.stdout.on("data", (data) => {
      output += data.toString();
    });

    child.stderr.on("data", (data) => {
      output += data.toString();
    });

    child.on("exit", () => {
      hasExited = true;
    });

    setTimeout(() => {
      expect(output).not.toContain("Translator Finder running at http://localhost:");
      expect(hasExited).toBe(true);
      if (!hasExited) {
        child.kill();
      }
      done();
    }, 2000);
  }, 10000);
});
