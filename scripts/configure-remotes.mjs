import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import {
  assertInsideWorkTree,
  assertNoProtectedUrlRewrite,
  git,
  localConfigValues,
  parseCommonArguments,
  policy,
  remoteNames,
} from "./remote-policy.mjs";
import { verifyRemotePolicy } from "./verify-remotes.mjs";

function assertAbsentOrExact(values, expected, message) {
  if (
    values.length > 1 ||
    (values.length === 1 && values[0] !== expected)
  ) {
    throw new Error(message);
  }
}

export function configureRemotePolicy(repositoryRoot) {
  assertInsideWorkTree(repositoryRoot);
  assertNoProtectedUrlRewrite(repositoryRoot);

  const names = remoteNames(repositoryRoot);
  if (
    !names.includes("origin") ||
    names.some((name) => name !== "origin" && name !== "upstream")
  ) {
    throw new Error("Refusing to configure an unexpected remote inventory.");
  }
  const originFetch = localConfigValues(repositoryRoot, "remote.origin.url");
  if (
    originFetch.length !== 1 ||
    ![policy.originUrl, policy.checkoutOriginUrl].includes(originFetch[0])
  ) {
    throw new Error("Refusing to configure an unexpected origin.");
  }
  assertAbsentOrExact(
    localConfigValues(repositoryRoot, "remote.origin.pushurl"),
    policy.originUrl,
    "Refusing to replace an unexpected origin push URL.",
  );
  assertAbsentOrExact(
    localConfigValues(repositoryRoot, "remote.pushDefault"),
    "origin",
    "Refusing to replace an unexpected push default.",
  );
  assertAbsentOrExact(
    localConfigValues(repositoryRoot, "pull.ff"),
    "only",
    "Refusing to replace an unexpected pull policy.",
  );

  if (names.includes("upstream")) {
    if (
      localConfigValues(repositoryRoot, "remote.upstream.url").length !== 1 ||
      localConfigValues(repositoryRoot, "remote.upstream.url")[0] !==
        policy.upstreamUrl
    ) {
      throw new Error("Refusing to replace an unexpected upstream fetch URL.");
    }
    assertAbsentOrExact(
      localConfigValues(repositoryRoot, "remote.upstream.pushurl"),
      policy.upstreamPushSentinel,
      "Refusing to replace an unexpected upstream push URL.",
    );
    const fetch = localConfigValues(repositoryRoot, "remote.upstream.fetch");
    if (
      fetch.length !== 1 ||
      ![
        policy.upstreamFetchSpec,
        "+refs/heads/*:refs/remotes/upstream/*",
      ].includes(fetch[0])
    ) {
      throw new Error("Refusing to replace an unexpected upstream fetch refspec.");
    }
    assertAbsentOrExact(
      localConfigValues(repositoryRoot, "remote.upstream.tagOpt"),
      "--no-tags",
      "Refusing to replace an unexpected upstream tag policy.",
    );
    if (
      localConfigValues(repositoryRoot, "remote.upstream.push").length !== 0 ||
      localConfigValues(repositoryRoot, "remote.upstream.mirror").length !== 0
    ) {
      throw new Error("Refusing to configure upstream push or mirror settings.");
    }
  }

  const configPath = git(repositoryRoot, [
    "rev-parse",
    "--path-format=absolute",
    "--git-path",
    "config",
  ]).stdout.trim();
  const priorConfig = readFileSync(configPath);
  try {
    git(repositoryRoot, [
      "config",
      "--local",
      "--replace-all",
      "remote.origin.url",
      policy.originUrl,
    ]);
    if (!names.includes("upstream")) {
      git(repositoryRoot, ["remote", "add", "upstream", policy.upstreamUrl]);
    }
    git(repositoryRoot, [
      "config",
      "--local",
      "--replace-all",
      "remote.upstream.fetch",
      policy.upstreamFetchSpec,
    ]);
    git(repositoryRoot, [
      "config",
      "--local",
      "--replace-all",
      "remote.upstream.pushurl",
      policy.upstreamPushSentinel,
    ]);
    git(repositoryRoot, [
      "config",
      "--local",
      "--replace-all",
      "remote.upstream.tagOpt",
      "--no-tags",
    ]);
    git(repositoryRoot, [
      "config",
      "--local",
      "--replace-all",
      "remote.pushDefault",
      "origin",
    ]);
    git(repositoryRoot, [
      "config",
      "--local",
      "--replace-all",
      "pull.ff",
      "only",
    ]);
    verifyRemotePolicy(repositoryRoot);
  } catch (error) {
    writeFileSync(configPath, priorConfig);
    throw error;
  }
}

function main() {
  const { repositoryRoot, flags } = parseCommonArguments(process.argv.slice(2));
  if (flags.size !== 1 || !flags.has("--apply")) {
    throw new Error(
      "No change made. Pass --apply to configure clone-local remote policy.",
    );
  }
  configureRemotePolicy(repositoryRoot);
  console.log("Configured canonical Social remote roles.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Remote configuration failed.");
    process.exitCode = 1;
  }
}
