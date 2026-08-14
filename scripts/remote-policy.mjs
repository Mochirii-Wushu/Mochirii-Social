import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

export const policy = Object.freeze({
  originUrl: "https://github.com/Mochirii-Wushu/Mochirii-Social.git",
  checkoutOriginUrl: "https://github.com/Mochirii-Wushu/Mochirii-Social",
  upstreamUrl: "https://github.com/pixelfed/pixelfed.git",
  upstreamPushSentinel: "disabled://upstream-push",
  upstreamFetchSpec: "+refs/heads/dev:refs/remotes/upstream/dev",
  upstreamRef: "refs/heads/dev",
  pinnedUpstreamCommit: "c8bed78bee3d796c5efb57393dafafbba3706f38",
});

export function git(repositoryRoot, args, { allowedStatuses = [0] } = {}) {
  const result = spawnSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
    windowsHide: true,
  });
  if (!allowedStatuses.includes(result.status)) {
    throw new Error(`Git command failed safely: git ${args[0]} (exit ${result.status})`);
  }
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}
export function resolveRepositoryRoot(value) {
  return resolve(value ?? process.cwd());
}

export function localConfigValues(repositoryRoot, key) {
  const result = git(
    repositoryRoot,
    ["config", "--local", "--get-all", key],
    { allowedStatuses: [0, 1] },
  );
  if (result.status === 1) return [];
  return result.stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function remoteNames(repositoryRoot) {
  return git(repositoryRoot, ["remote"]).stdout
    .split(/\r?\n/u)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort();
}

export function assertInsideWorkTree(repositoryRoot) {
  const result = git(repositoryRoot, ["rev-parse", "--is-inside-work-tree"]);
  if (result.stdout.trim() !== "true") {
    throw new Error("The selected path is not a Git working tree.");
  }
}

export function assertNoProtectedUrlRewrite(repositoryRoot) {
  const result = git(
    repositoryRoot,
    ["config", "--get-regexp", "^url\\..*\\.(insteadOf|pushInsteadOf)$"],
    { allowedStatuses: [0, 1] },
  );
  if (result.status === 1) return;

  const protectedUrls = [
    policy.originUrl,
    policy.checkoutOriginUrl,
    policy.upstreamUrl,
    policy.upstreamPushSentinel,
  ];
  for (const line of result.stdout.split(/\r?\n/u).filter(Boolean)) {
    const separator = line.search(/\s/u);
    if (separator < 1) {
      throw new Error("Unable to parse a Git URL rewrite rule.");
    }
    const prefix = line.slice(separator).trim();
    if (!prefix) {
      throw new Error("A Git URL rewrite has an empty prefix.");
    }
    if (
      protectedUrls.some((url) =>
        url.toLowerCase().startsWith(prefix.toLowerCase()),
      )
    ) {
      throw new Error("A Git URL rewrite can transform a protected remote URL.");
    }
  }
}

export function parseCommonArguments(argv) {
  let repositoryRoot;
  const flags = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repository-root") {
      if (repositoryRoot !== undefined || index + 1 >= argv.length) {
        throw new Error("--repository-root requires exactly one value.");
      }
      repositoryRoot = argv[index + 1];
      index += 1;
      continue;
    }
    if (!argument.startsWith("--")) {
      throw new Error("Unexpected positional argument.");
    }
    if (flags.has(argument)) {
      throw new Error("Duplicate flag.");
    }
    flags.add(argument);
  }
  return {
    repositoryRoot: resolveRepositoryRoot(repositoryRoot),
    flags,
  };
}
