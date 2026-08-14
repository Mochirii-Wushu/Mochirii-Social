import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const repositoryRoot = path.resolve(root, "../..");

const requiredDocs = [
  "docs/mochirii-social-sync.md",
  "docs/upstream-sync-policy.md",
  "docs/media-spaces-readiness.md",
  "docs/fediverse-activation-runbook.md",
  "docs/online-hosted-runtime.md",
  "docs/online-backup-recovery.md",
];

const failures = [];
const publicSurfaceDirs = [
  ".github",
  "resources/views/site",
  "resources/views/settings",
  "resources/views/layouts",
  "resources/views/auth",
  "resources/views/errors",
  "resources/views/profile",
  "resources/views/status",
  "resources/views/emails",
  "resources/assets/components/partials",
];
const publicSurfaceFiles = [
  ".env.docker.example",
  "package.json",
  "package-lock.json",
  "config/instance.php",
  "resources/assets/components/AccountImport.vue",
  "resources/assets/components/Discover.vue",
  "resources/assets/components/sections/DiscoverFeed.vue",
  "resources/assets/js/i18n/en.json",
  "resources/lang/en/settings.php",
  "resources/lang/en/web.php",
];
const publicDenyTokens = [
  "Pixelfed",
  "pixelfed-icon",
  "Instagram",
  "Mastodon",
  "Fediverse",
  "ActivityPub",
  "Global Feed",
  "Network Feed",
  "Go back to previous design",
  "Import from Instagram",
  "Instagram Import",
  "@dansup",
  "opencollective.com/pixelfed",
  "github.com/pixelfed/pixelfed-rn",
  "discord.gg/6Fy6AJMbMU",
  "danielsupernault",
  "pixelfed@yourdomain.com",
];

function read(file) {
  const fullPath = path.join(root, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing required file: ${file}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
}

function readRepository(file) {
  const fullPath = path.join(repositoryRoot, file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing required repository file: ${file}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8").replace(/\r\n/g, "\n");
}

function requireIncludes(file, text, needles) {
  for (const needle of needles) {
    if (!text.includes(needle)) {
      failures.push(`${file} must mention: ${needle}`);
    }
  }
}

function requireRuntimeSourceFile(file) {
  if (!fs.existsSync(path.join(root, file))) {
    failures.push(`Missing required runtime source file: ${file}`);
  }
}

function walkFiles(relativeDir) {
  const fullDir = path.join(root, relativeDir);
  if (!fs.existsSync(fullDir)) return [];

  const found = [];
  for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
    const relative = path.join(relativeDir, entry.name).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      found.push(...walkFiles(relative));
    } else {
      found.push(relative);
    }
  }
  return found;
}

function assertNoPublicResidue(file) {
  const text = read(file);
  for (const token of publicDenyTokens) {
    if (text.includes(token)) {
      failures.push(`${file} contains public upstream residue: ${token}`);
    }
  }
}

function gitRemote(args) {
  try {
    return execFileSync("git", ["remote", ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (error) {
    failures.push(`git remote ${args.join(" ")} failed: ${error.message}`);
    return "";
  }
}

function isCanonicalRemote(remote) {
  return /github\.com[:/]Mochirii-Wushu\/Mochirii-Social(?:\.git)?\/?$/i.test(remote);
}

for (const doc of requiredDocs) {
  read(doc);
}

for (const file of [
  ".env.testing",
  "bootstrap/cache/.gitignore",
  "public/vendor/horizon/.gitignore",
  "storage/app/bouncer/.gitignore",
  "storage/app/bouncer/all.json",
  "storage/app/public/avatars/.gitignore",
  "storage/app/public/avatars/default.jpg",
  "storage/app/public/avatars/default.png",
]) {
  requireRuntimeSourceFile(file);
}

for (const removedFile of ["funding.json", ".github/FUNDING.yml"]) {
  if (fs.existsSync(path.join(root, removedFile))) {
    failures.push(`${removedFile} should not exist in the Mochirii ops fork.`);
  }
}

for (const file of [...publicSurfaceFiles, ...publicSurfaceDirs.flatMap(walkFiles)]) {
  assertNoPublicResidue(file);
}

const languageBundleFiles = [
  ...walkFiles("resources/assets/js/i18n"),
  ...walkFiles("public/_lang"),
];
const staleLanguageBundleTokens = [
  '"homeFeed": "Home Feed"',
  '"localFeed": "Local Feed"',
  '"globalFeed": "Global Feed"',
  '"discover": "Discover"',
  '"backToPreviousDesign": "Go back to previous design"',
  "Network Feed",
];

for (const file of languageBundleFiles) {
  const text = read(file);
  for (const token of staleLanguageBundleTokens) {
    if (text.includes(token)) {
      failures.push(`${file} contains stale member navigation copy: ${token}`);
    }
  }
}

const packageJson = JSON.parse(read("package.json"));
if (packageJson.name !== "mochirii-social-ops") {
  failures.push(`package.json name must be mochirii-social-ops, got: ${packageJson.name}`);
}

const gitAttributes = read(".gitattributes");
requireIncludes(".gitattributes", gitAttributes, [
  "public/**/*.js text eol=lf -diff",
  "public/**/*.json text eol=lf -diff",
  "public/**/*.css text eol=lf -diff",
]);

const readme = read("README.md");
requireIncludes("README.md", readme, [
  "Mochirii Social Ops",
  "social.mochirii.com",
  "Mochirii-Wushu/Mochirii-Social",
  "DigitalOcean Spaces",
  "Federation disabled",
  "Do not commit host `.env` files",
  "isolated temporary clone",
]);

const staleReadmeMarketing = [
  "pixelfed-full-color",
  "poser.pugx",
  "fedidb",
  "YunoHost",
  "opencollective.com",
  "Made with love",
];

for (const token of staleReadmeMarketing) {
  if (readme.includes(token)) {
    failures.push(`README.md still contains upstream marketing token: ${token}`);
  }
}

const originFetch = gitRemote(["get-url", "origin"]);
const originPush = gitRemote(["get-url", "--push", "origin"]);
if (!isCanonicalRemote(originFetch)) {
  failures.push("origin fetch URL must point at the canonical repository");
}
if (!isCanonicalRemote(originPush)) {
  failures.push("origin push URL must point at the canonical repository");
}

const sourceSnapshot = read("SOURCE-SNAPSHOT.md");
requireIncludes("SOURCE-SNAPSHOT.md", sourceSnapshot, [
  "7e276f225b63ab17a227353ed5f6cb829777eb91",
  "c8bed78bee3d796c5efb57393dafafbba3706f38",
  "sanitized current-state snapshot",
]);

const syncDoc = read("docs/mochirii-social-sync.md");
requireIncludes("docs/mochirii-social-sync.md", syncDoc, [
  "MOCHIRII_SOCIAL_SYNC_URL",
  "MOCHIRII_SOCIAL_SYNC_SECRET",
  "social_accounts",
  "federation_enabled = false",
  "hard safety caps",
]);

const upstreamDoc = read("docs/upstream-sync-policy.md");
requireIncludes("docs/upstream-sync-policy.md", upstreamDoc, [
  "Fetch the official source only",
  "https://github.com/pixelfed/pixelfed.git",
  "isolated temporary clone",
  "DISABLED",
  "Do not commit secrets",
]);

const mediaDoc = read("docs/media-spaces-readiness.md");
requireIncludes("docs/media-spaces-readiness.md", mediaDoc, [
  "hard safety caps",
  "EXIF",
  "thumbnail",
  "DigitalOcean Space",
  "CORS",
  "https://social.mochirii.com",
  "backup",
  "local-after-cloud cleanup",
  "90 MiB",
  "95 MiB",
  "100 MB",
  "1080px",
  "640px",
  "320px",
  "EXIF/GPS",
]);

const fediverseDoc = read("docs/fediverse-activation-runbook.md");
requireIncludes("docs/fediverse-activation-runbook.md", fediverseDoc, [
  "disabled",
  "moderation",
  "report",
  "defederation",
  "blocklist",
  "deletion",
  "WebFinger",
  "NodeInfo",
  "remote delivery",
  "approval",
]);

const envExample = read(".env.example");
requireIncludes(".env.example", envExample, [
  'APP_NAME="Mochirii Social"',
  'OPEN_REGISTRATION="false"',
  'ACTIVITY_PUB="false"',
  'MAIL_FROM_NAME="Mochirii Social"',
]);

const envDockerExample = read(".env.docker.example");
requireIncludes(".env.docker.example", envDockerExample, [
  'APP_NAME="Mochirii Social"',
  'OPEN_REGISTRATION="false"',
  'INSTANCE_DISCOVER_PUBLIC="false"',
  'MAX_PHOTO_SIZE="92160"',
  'MAX_AVATAR_SIZE="92160"',
  'MEDIA_TYPES="image/jpeg,image/jpg,image/png,image/webp"',
  'PHP_POST_MAX_SIZE="100M"',
  'PHP_UPLOAD_MAX_FILE_SIZE="95M"',
  'ACTIVITY_PUB="false"',
  'AP_REMOTE_FOLLOW="false"',
  'AP_INBOX="false"',
  'AP_OUTBOX="false"',
  'AP_SHAREDINBOX="false"',
  'PF_ENABLE_CLOUD="true"',
  'PF_LOCAL_AVATAR_TO_CLOUD="true"',
  'MAIL_FROM_NAME="Mochirii Social"',
]);

const dockerCompose = read("docker-compose.yml");
requireIncludes("docker-compose.yml", dockerCompose, [
  "mariadb:11.4@sha256:a794d9eb009e20de605858a11f32f63b4075cbd197c650436f0e3b457e4caed7",
  "redis:7-alpine@sha256:6ab0b6e7381779332f97b8ca76193e45b0756f38d4c0dcda72dbb3c32061ab99",
  "MARIADB_DATABASE: ${DB_DATABASE}",
  "condition: service_healthy",
  'MAX_PHOTO_SIZE: "92160"',
  'MAX_AVATAR_SIZE: "92160"',
  'PHP_POST_MAX_SIZE: "100M"',
  'PHP_UPLOAD_MAX_FILE_SIZE: "95M"',
]);
if (dockerCompose.includes("mysql:9")) {
  failures.push("docker-compose.yml must not restore the incompatible MySQL 9 runtime");
}
if (dockerCompose.includes("./bootstrap/cache:/var/www/html/bootstrap/cache")) {
  failures.push("docker-compose.yml must keep image-owned bootstrap/cache isolated from the host");
}

const immutableImageReference = "image: ${PIXELFED_IMAGE:-mochirii-pixelfed:local}";
if (dockerCompose.split(immutableImageReference).length - 1 !== 3) {
  failures.push("docker-compose.yml must apply PIXELFED_IMAGE to all three application services");
}

const cleanDatabaseCompose = read("docker-compose.ci.yml");
requireIncludes("docker-compose.ci.yml", cleanDatabaseCompose, [
  "pixelfed-ci-database:/var/lib/mysql",
  "pixelfed-ci-storage:/var/www/html/storage",
  "PIXELFED_IMAGE",
]);

const cleanDatabaseCheck = read("scripts/check-clean-database-migrations.sh");
requireIncludes("scripts/check-clean-database-migrations.sh", cleanDatabaseCheck, [
  "php artisan migrate --force --isolated --no-interaction",
  "php artisan horizon:status",
  "php artisan schedule:list --no-ansi",
  "pulse_values",
  "pulse_entries",
  "pulse_aggregates",
]);

const dockerfile = read("Dockerfile");
requireIncludes("Dockerfile", dockerfile, [
  "serversideup/php:8.4-fpm-nginx@sha256:519720d9ff5d50aad9eb83fac290746460dfc1346faa8fdb25c75d28a3feb2ab",
  'org.opencontainers.image.source="https://github.com/Mochirii-Wushu/Mochirii-Social"',
  "COPY --chmod=755 ./docker/entrypoint.d/ /etc/entrypoint.d/",
  "composer install --no-ansi --no-interaction --no-dev --optimize-autoloader",
  "php scripts/check-production-composer-dependencies.php",
]);

const productionImageBuild = read("scripts/build-production-image.sh");
requireIncludes("scripts/build-production-image.sh", productionImageBuild, [
  "org.opencontainers.image.source",
  "org.opencontainers.image.revision",
  "org.opencontainers.image.version",
  "org.opencontainers.image.licenses",
  "com.mochirii.social.upstream.revision",
  "PIXELFED_IMAGE",
  "docker buildx build",
  "BUILD_CACHE_FROM",
  "BUILD_CACHE_TO",
]);

const validationWorkflow = readRepository(".github/workflows/validate-social.yml");
requireIncludes(".github/workflows/validate-social.yml", validationWorkflow, [
  "name: validate-social",
  "Publish one immutable candidate",
  "services/social",
  "permissions:\n  contents: read",
  "actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0",
  "actions/setup-node@48b55a011bda9f5d6aeb4c2d9c7362e8dae4041e # v6.4.0",
  "shivammathur/setup-php@f3e473d116dcccaddc5834248c87452386958240 # 2.37.2",
  "persist-credentials: false",
  "packages: write",
  "docker login ghcr.io",
  "docker buildx imagetools inspect",
  "docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c",
  "anchore/sbom-action@e22c389904149dbc22b58101806040fa8d37a610",
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a",
  "actions/attest@a1948c3f048ba23858d222213b7c278aabede763",
]);

const deploymentWorkflow = readRepository(".github/workflows/deploy-social-production.yml");
requireIncludes(".github/workflows/deploy-social-production.yml", deploymentWorkflow, [
  "environment: social-production",
  "services/social/docker-compose.production.yml",
  "repository=Mochirii-Wushu/Mochirii",
  "source_repository=Mochirii-Wushu/Mochirii-Social",
  "source_commit=",
  "DEPLOY social.mochirii.com",
  "persist-credentials: false",
]);

const productionDependencyGuard = read(
  "scripts/check-production-composer-dependencies.php",
);
requireIncludes(
  "scripts/check-production-composer-dependencies.php",
  productionDependencyGuard,
  [
    "composer.lock",
    "packages-dev",
    "vendor/composer/installed.json",
    "array_intersect_key",
  ],
);

const oauthKeyGuard = read("docker/entrypoint.d/20-secure-oauth-keys.sh");
requireIncludes(
  "docker/entrypoint.d/20-secure-oauth-keys.sh",
  oauthKeyGuard,
  [
    '"$app_dir/storage/oauth-private.key"',
    '"$app_dir/storage/oauth-public.key"',
    '[ -L "$key_path" ]',
    'chmod 600 "$key_path"',
  ],
);

const avatarPolicy = read("app/Services/AvatarUploadPolicy.php");
requireIncludes("app/Services/AvatarUploadPolicy.php", avatarPolicy, [
  "image/webp",
  "PRIMARY_SIZE = 640",
  "THUMBNAIL_SIZE = 320",
  "pixelfed.max_avatar_size",
]);

const avatarOptimizer = read("app/Jobs/AvatarPipeline/AvatarOptimize.php");
requireIncludes("app/Jobs/AvatarPipeline/AvatarOptimize.php", avatarOptimizer, [
  "PRIMARY_SIZE",
  "THUMBNAIL_SIZE",
  "deleteLocalSource",
  "uploadToCloud",
  "WebpEncoder",
]);

const avatarModal = read("resources/assets/components/partials/modal/UpdateAvatar.vue");
requireIncludes("resources/assets/components/partials/modal/UpdateAvatar.vue", avatarModal, [
  "window.App.config.account.avatar",
  "validateFile",
  "WebP",
  "optimized automatically",
]);

const routeMiddleware = read("app/Http/Middleware/AdminOrNotFound.php");
requireIncludes("app/Http/Middleware/AdminOrNotFound.php", routeMiddleware, [
  "class AdminOrNotFound",
  "abort_if(Auth::check() == false || Auth::user()->is_admin == false, 404)",
]);

const webRoutes = read("routes/web.php");
requireIncludes("routes/web.php", webRoutes, [
  "Route::get('discover', 'DiscoverController@home')->name('discover')->middleware('admin.notfound')",
  "Route::get('discover/tags/{hashtag}', 'DiscoverController@showTags')->middleware('admin.notfound')",
  "Route::get('network', 'TimelineController@network')->name('timeline.network')->middleware('admin.notfound')",
  "Route::get('import', fn () => abort(404))->name('help.import')",
  "Route::get('discover', fn () => abort(404))->name('help.discover')",
  "Route::get('applications', 'SettingsController@applications')->name('settings.applications')->middleware(['dangerzone', 'admin.notfound'])",
  "Route::post('data-export/account', 'SettingsController@exportAccount')->middleware(['dangerzone', 'admin.notfound'])",
  "Route::get('developers', 'SettingsController@developers')->name('settings.developers')->middleware(['dangerzone', 'admin.notfound'])",
  "Route::get('labs', 'SettingsController@labs')->name('settings.labs')->middleware('admin.notfound')",
  "Route::group(['prefix' => 'import', 'middleware' => ['dangerzone', 'admin.notfound']]",
]);

const settingsSidebar = read("resources/views/settings/partial/sidebar.blade.php");
requireIncludes("resources/views/settings/partial/sidebar.blade.php", settingsSidebar, [
  "Auth::user()->is_admin",
  "settings.applications",
  "settings.developers",
  "settings.import",
  "settings.dataexport",
  "settings.labs",
]);

const spaRoutes = read("resources/assets/js/spa.js");
requireIncludes("resources/assets/js/spa.js", spaRoutes, [
  "function adminOnlyRoute",
  "return next('/i/web/404')",
  'path: "/i/web/discover"',
  "beforeEnter: adminOnlyRoute",
]);

const spaSidebar = read("resources/assets/components/partials/sidebar.vue");
for (const staleNav of [
  'to="/i/web/discover"',
  "force_old_ui=1",
  "backToPreviousDesign",
]) {
  if (spaSidebar.includes(staleNav)) {
    failures.push(`resources/assets/components/partials/sidebar.vue still exposes stale member nav: ${staleNav}`);
  }
}

if (failures.length > 0) {
  console.error("Mochirii ops readiness failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Mochirii ops readiness passed.");
