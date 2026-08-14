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
    if (!text.includes(value)) {
      failures.push(`${relativePath} must include: ${value}`);
    }
  }
}

function rejectIncludes(relativePath, text, values) {
  for (const value of values) {
    if (text.includes(value)) {
      failures.push(`${relativePath} must not include: ${value}`);
    }
  }
}

const composePath = "docker-compose.production.yml";
const compose = read(composePath);
requireIncludes(composePath, compose, [
  "name: mochirii-social",
  "${PIXELFED_IMAGE:?PIXELFED_IMAGE must be an immutable GHCR digest}",
  "${PIXELFED_ENV_FILE:?PIXELFED_ENV_FILE must point to the root-owned runtime environment}",
  "${PIXELFED_DATA_ROOT:?PIXELFED_DATA_ROOT must be an absolute path}/mariadb",
  "${PIXELFED_DATA_ROOT:?PIXELFED_DATA_ROOT must be an absolute path}/redis",
  "${PIXELFED_DATA_ROOT:?PIXELFED_DATA_ROOT must be an absolute path}/storage",
  '"127.0.0.1:8080:8080"',
  'AUTORUN_LARAVEL_MIGRATION: "false"',
  'MAX_PHOTO_SIZE: "92160"',
  'MAX_AVATAR_SIZE: "92160"',
  'PHP_POST_MAX_SIZE: "100M"',
  'PHP_UPLOAD_MAX_FILE_SIZE: "95M"',
  "pull_policy: never",
]);
rejectIncludes(composePath, compose, [
  "build:",
  "mochirii-pixelfed:local",
  "./mysql-9-data",
  "./redis-data",
  "./storage",
  '"8080:8080"',
  'PHP_POST_MAX_SIZE: "250M"',
  'PHP_UPLOAD_MAX_FILE_SIZE: "100M"',
]);
if ((compose.match(/image: \*app-image/g) || []).length !== 3) {
  failures.push(`${composePath} must use the immutable app image for all three app services`);
}

const deployWorkflowPath = ".github/workflows/deploy-social-production.yml";
const deployWorkflow = readRepository(deployWorkflowPath);
requireIncludes(deployWorkflowPath, deployWorkflow, [
  "workflow_dispatch:",
  "environment: social-production",
  "permissions:",
  "contents: read",
  "packages: read",
  "persist-credentials: false",
  "DEPLOY social.mochirii.com",
  '[[ "$MIGRATION_APPROVAL" == "NONE" ]]',
  "StrictHostKeyChecking=yes",
  "UserKnownHostsFile=~/.ssh/known_hosts",
  "docker buildx imagetools inspect",
  "https://social.mochirii.com/",
  "cf-mitigated",
  "The public edge blocked the GitHub runner after the hosted public health gates passed.",
]);
rejectIncludes(deployWorkflowPath, deployWorkflow, [
  "self-hosted",
  "StrictHostKeyChecking=no",
  "ssh-keyscan",
  "pull_request_target",
]);

const onlineVerificationWorkflowPath = ".github/workflows/verify-social-online-hosting.yml";
const onlineVerificationWorkflow = readRepository(onlineVerificationWorkflowPath);
requireIncludes(onlineVerificationWorkflowPath, onlineVerificationWorkflow, [
  "workflow_dispatch:",
  "environment: social-production",
  "permissions:\n  contents: read",
  "VERIFY social.mochirii.com",
  "StrictHostKeyChecking=yes",
  '"verify VERIFY_social.mochirii.com"',
  "https://mochirii.com/",
  "https://social.mochirii.com/",
  "Cloudflare blocked the GitHub runner after the forced hosted public gate passed.",
  "/auth/v1/health",
  "/functions/v1/reaper-discord-interactions",
  "/functions/v1/reaper-discord-member-sync",
  "/functions/v1/verify-member-access",
  "https://discord.com/api/v10/gateway",
]);
rejectIncludes(onlineVerificationWorkflowPath, onlineVerificationWorkflow, [
  "self-hosted",
  "StrictHostKeyChecking=no",
  "ssh-keyscan",
  "pull_request_target",
]);

const deployScriptPath = "scripts/deploy-production-runtime.sh";
const deployScript = read(deployScriptPath);
requireIncludes(deployScriptPath, deployScript, [
  "flock -n",
  "Pending migrations require MIGRATIONS_APPROVED.",
  "/usr/local/sbin/mochirii-social-backup",
  "php artisan migrate --force --isolated --no-interaction",
  "rollback_image",
  "verify_runtime",
  '"--verify-online-hosting"',
  "verify_online_hosting",
  "The release Compose file does not match the approved host template.",
]);

const runtimeLibraryPath = "scripts/production-runtime-lib.sh";
const runtimeLibrary = read(runtimeLibraryPath);
requireIncludes(runtimeLibraryPath, runtimeLibrary, [
  'PULL_USER="${MOCHIRII_SOCIAL_PULL_USER:-mochirii}"',
  'sudo -H -u "$PULL_USER" -- docker pull',
  '--env-file "$SHARED_ROOT/pixelfed.env"',
  '--env-file "$release_dir/release.env"',
  "https://social.mochirii.com/",
  "verify_spaces_round_trip",
  'Storage::disk("s3")',
  "Spaces write, read, and delete gates passed.",
]);

const entrypointPath = "scripts/deploy-production-entrypoint.sh";
const entrypoint = read(entrypointPath);
requireIncludes(entrypointPath, entrypoint, [
  "SSH_ORIGINAL_COMMAND",
  "DEPLOY_social.mochirii.com",
  "VERIFY_social.mochirii.com",
  "--verify-online-hosting",
  "head -c 1048577",
  "sudo -n /usr/local/sbin/mochirii-social-deploy",
]);

const installerPath = "scripts/install-production-runtime.sh";
const installer = read(installerPath);
requireIncludes(installerPath, installer, [
  "github-deploy",
  'restrict,command=\"/usr/local/sbin/mochirii-social-deploy-entry\"',
  '"$runtime_root/shared/docker-compose.production.yml"',
  "passwd --lock",
  "visudo -cf",
]);

const migrationPath = "scripts/migrate-production-runtime.sh";
const migration = read(migrationPath);
requireIncludes(migrationPath, migration, [
  "mariadb-dump",
  "--single-transaction",
  "gzip -t",
  "php artisan down",
  "rsync -aHAX --numeric-ids",
  "rollback_legacy",
  "wait_for_container_health pixelfed-app 300",
]);

const backupInstallerPath = "scripts/install-production-backups.sh";
const backupInstaller = read(backupInstallerPath);
requireIncludes(backupInstallerPath, backupInstaller, [
  "github-recovery",
  'restrict,command=\"/usr/local/sbin/mochirii-social-restore-entry\"',
  "passwd --lock",
  "AllowUsers mochirii github-deploy github-recovery",
  "visudo -cf",
]);

const caddyPath = "caddy/Caddyfile";
const caddy = read(caddyPath);
requireIncludes(caddyPath, caddy, [
  "social.mochirii.com",
  "max_size 100MB",
  "reverse_proxy 127.0.0.1:8080",
]);
const caddyInstallerPath = "scripts/install-production-caddy.sh";
const caddyInstaller = read(caddyInstallerPath);
requireIncludes(caddyInstallerPath, caddyInstaller, [
  "caddy validate",
  "systemctl reload caddy",
  "rollback",
  "https://social.mochirii.com/",
]);

for (const [relativePath, text] of [
  [deployScriptPath, deployScript],
  [entrypointPath, entrypoint],
  [installerPath, installer],
  [migrationPath, migration],
  [backupInstallerPath, backupInstaller],
  [caddyInstallerPath, caddyInstaller],
]) {
  rejectIncludes(relativePath, text, ["set -x", "DB_PASSWORD=", "DB_ROOT_PASSWORD="]);
}

if (failures.length) {
  console.error("Production runtime checks failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Production runtime checks passed.");
