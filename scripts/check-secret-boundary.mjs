import { spawnSync } from "node:child_process";
import {
  readFileSync,
  statSync,
} from "node:fs";
import path from "node:path";

const root = process.cwd();
const result = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  {
    cwd: root,
    encoding: null,
    maxBuffer: 128 * 1024 * 1024,
    windowsHide: true,
  },
);
if (result.status !== 0) throw new Error("Secret-boundary inventory failed safely.");

const files = result.stdout
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .map((file) => file.replaceAll("\\", "/"));
const allowedEnvironmentFiles = new Set([
  ".env.example",
  "services/social/.env.docker.example",
  "services/social/.env.example",
  "services/social/.env.testing",
]);
const forbiddenPath =
  /(^|\/)(?:credentials?|secrets?)(\/|$)|\.(?:age|db|dump|key|p12|pfx|pem|sqlite(?:\d+)?|tar(?:\.gz)?)$/iu;
const contentChecks = [
  ["private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/u],
  ["GitHub token", /github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/u],
  ["cloud access key", /AKIA[0-9A-Z]{16}/u],
  ["collaboration token", /xox[baprs]-[A-Za-z0-9-]{10,}/u],
  ["live payment key", /sk_live_[A-Za-z0-9]{16,}/u],
  ["local credential boundary", new RegExp("Mochi" + " Creds", "u")],
  ["local workstation path", /[A-Za-z]:\\Github Repo/u],
];
const failures = [];

for (const file of files) {
  if (forbiddenPath.test(file)) failures.push(`Forbidden candidate path: ${file}`);
  const base = path.basename(file);
  if (
    (base === ".env" || base.startsWith(".env.")) &&
    !allowedEnvironmentFiles.has(file)
  ) {
    failures.push(`Runtime environment file is forbidden: ${file}`);
  }
  const absolute = path.join(root, ...file.split("/"));
  if (statSync(absolute).isDirectory()) continue;
  const content = readFileSync(absolute);
  if (content.includes(0)) continue;
  const text = content.toString("utf8");
  for (const [label, pattern] of contentChecks) {
    if (pattern.test(text)) failures.push(`${file} contains a redacted ${label} finding.`);
  }
}

if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exit(1);
}
console.log(`Secret boundary passed for ${files.length} tracked and candidate files.`);
