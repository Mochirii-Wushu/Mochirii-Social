import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const repositoryRoot = path.resolve(root, "../..");
const failures = [];

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
}

function readRepository(relativePath) {
  const fullPath = path.join(repositoryRoot, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing required repository file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
}

function requireIncludes(relativePath, text, values) {
  for (const value of values) {
    if (!text.includes(value)) failures.push(`${relativePath} must include: ${value}`);
  }
}

function rejectIncludes(relativePath, text, values) {
  for (const value of values) {
    if (text.includes(value)) failures.push(`${relativePath} must not include: ${value}`);
  }
}

const backupPath = "scripts/backup-production-runtime.sh";
const backup = read(backupPath);
requireIncludes(backupPath, backup, [
  "--single-transaction",
  "--routines",
  "--events",
  "--triggers",
  "--hex-blob",
  "--network none",
  "RESTORE_TABLES=(users statuses media oauth_clients)",
  "age \\",
  "--recipients-file",
  "RCLONE_CONFIG_MOCHIRII_BACKUP_PROVIDER=DigitalOcean",
  "prune_retention daily 14",
  "prune_retention weekly 8",
  "prune_retention monthly 6",
  "Refusing to prune an unexpected backup object name.",
]);

const servicePath = "systemd/mochirii-social-backup.service";
const service = read(servicePath);
requireIncludes(servicePath, service, [
  "ExecStart=/usr/local/sbin/mochirii-social-backup nightly",
  "NoNewPrivileges=true",
  "ProtectHome=true",
  "TimeoutStartSec=45min",
]);

const timerPath = "systemd/mochirii-social-backup.timer";
const timer = read(timerPath);
requireIncludes(timerPath, timer, [
  "OnCalendar=*-*-* 03:15:00 UTC",
  "Persistent=true",
]);

const workflowPath = ".github/workflows/recover-social-production.yml";
const workflow = readRepository(workflowPath);
requireIncludes(workflowPath, workflow, [
  "workflow_dispatch:",
  "environment: social-recovery",
  "persist-credentials: false",
  "validate-only",
  "restore-production",
  "VERIFY social backup",
  "RESTORE social.mochirii.com",
  "StrictHostKeyChecking=yes",
  "--network none",
]);
rejectIncludes(workflowPath, workflow, [
  "self-hosted",
  "StrictHostKeyChecking=no",
  "ssh-keyscan",
  "pull_request:",
  "pull_request_target",
]);

for (const [relativePath, text] of [
  [backupPath, backup],
  [workflowPath, workflow],
]) {
  requireIncludes(relativePath, text, [
    "restore_ready=false",
    "--execute='SELECT 1;'",
    "The isolated restore database did not become ready.",
  ]);
  rejectIncludes(relativePath, text, ["mariadb-admin ping"]);
}

const runbookPath = "docs/online-backup-recovery.md";
const runbook = read(runbookPath);
const compactRunbook = runbook.replace(/\s+/g, " ");
requireIncludes(runbookPath, compactRunbook, [
  "canonical repository is public",
  "`social-recovery` environment secrets",
  "`social-recovery` environment variables",
  "protected `social-recovery` environment",
  "protected `main`",
]);
rejectIncludes(runbookPath, runbook, ["repository Actions secrets"]);

for (const [relativePath, text] of [
  [backupPath, backup],
  ["scripts/restore-production-runtime.sh", read("scripts/restore-production-runtime.sh")],
  ["scripts/restore-production-entrypoint.sh", read("scripts/restore-production-entrypoint.sh")],
  ["scripts/install-production-backups.sh", read("scripts/install-production-backups.sh")],
]) {
  rejectIncludes(relativePath, text, ["set -x", "echo $BACKUP_", "env |", "printenv"]);
}

if (failures.length) {
  console.error("Production backup checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production backup checks passed.");
