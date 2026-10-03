const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const core = require("../schedule-core.js");

const root = path.resolve(__dirname, "..");
const publicFiles = [
  "index.html",
  "styles.css",
  "schedule-core.js",
  "schedule.js",
  "schedule.json",
  "app.js",
  "manifest.webmanifest",
  "sw.js",
  "README.md"
];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("public files contain no known personal identifiers", () => {
  const combined = publicFiles.map(read).join("\n");
  assert.equal(combined.includes("赖" + "文钊"), false);
  assert.equal(combined.includes("2026" + "36383396"), false);
  assert.equal(combined.includes("赖文钊(2026-2027-1)课表.pdf"), false);
});

test("PWA manifest and service worker cover the app shell", () => {
  const manifest = JSON.parse(read("manifest.webmanifest"));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.ok(manifest.icons.some((icon) => icon.src === "icon.svg")); assert.ok(manifest.icons.some((icon) => icon.src === "icon-192.png")); assert.ok(manifest.icons.some((icon) => icon.src === "icon-512.png"));
  const sw = read("sw.js");
  ["index.html", "styles.css", "schedule-core.js", "schedule.js", "schedule.json", "app.js", "icon-192.png", "icon-512.png"].forEach((file) => {
    assert.ok(sw.includes(`./${file}`), `service worker should cache ${file}`);
  });
});

test("default schedule passes schema validation", () => {
  const data = JSON.parse(read("schedule.json"));
  assert.deepEqual(core.validateSchedule(data), []);
  assert.ok(data.courses.length > 0);
  assert.ok(data.sessions.length > 0);
});

test("project files no longer use prompt()", () => {
  assert.equal(read("app.js").includes("prompt("), false);
});


test("page includes Open Graph and share metadata", () => {
  const html = read("index.html");
  ["og:title", "og:description", "og:image", "twitter:card", "summary_large_image"].forEach((value) => {
    assert.ok(html.includes(value), `index.html should include ${value}`);
  });
});

test("accessibility scaffolding and focus-managed dialogs are present", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.ok(html.includes('role="tablist"'));
  assert.ok(html.includes('id="mainContent"'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(app.includes("modalKeydown"));
  assert.ok(app.includes("closeActiveModal"));
  assert.ok(app.includes("openShareDialog"));
});

test("admin mode includes initial credentials and protected note clearing", () => {
  const html = read("index.html");
  const app = read("app.js");
  assert.ok(html.includes('id="btnAdmin"'));
  assert.ok(html.includes('id="btnAdminSettings"'));
  assert.ok(app.includes('const ADMIN_KEY'));
  assert.ok(app.includes('const DEFAULT_ADMIN = { username: "admin", password: "123456" }'));
  assert.ok(app.includes("function openAdminPanel"));
  assert.ok(app.includes("adminLoggedIn()"));
});
