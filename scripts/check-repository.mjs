import {
  existsSync,
  readFileSync,
  readdirSync,
} from "node:fs";

const required = [
  ".github/workflows/deploy-social-production.yml",
  ".github/workflows/recover-social-production.yml",
  ".github/workflows/validate-social.yml",
  ".github/workflows/verify-social-online-hosting.yml",
  "UPSTREAM_REVISION",
  "docs/adr/0002-incumbent-production-source-integration.md",
  "docs/operations/DEPLOYMENT.md",
  "docs/operations/RELEASE-TRACEABILITY.md",
  "docs/operations/SOURCE-EQUIVALENCE.md",
  "docs/operations/imported-social.sha256",
  "docs/operations/incumbent-website-social.sha256",
  "docs/operations/release-traceability.v1.json",
  "docs/operations/source-equivalence.v1.json",
  "services/social/Dockerfile",
  "services/social/composer.lock",
  "services/social/database/migrations",
  "services/social/docker-compose.production.yml",
  "services/social/package-lock.json",
  "services/social/scripts/deploy-production-runtime.sh",
  "scripts/check-image-labels.sh",
  "scripts/check-release-traceability.mjs",
  "scripts/check-secret-boundary.mjs",
  "scripts/check-source-equivalence.mjs",
];
const failures = [];
const read = (file) => readFileSync(file, "utf8").replaceAll("\r\n", "\n");

function extractJob(workflow, jobName) {
  const jobsIndex = workflow.indexOf("\njobs:\n");
  if (jobsIndex < 0) return "";

  const jobs = workflow.slice(jobsIndex + 1);
  const escapedName = jobName.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  const match = new RegExp(`^  ${escapedName}:\\s*$`, "mu").exec(jobs);
  if (!match) return "";

  const start = match.index;
  const remainder = jobs.slice(start + match[0].length);
  const next = /^  [a-z0-9_-]+:\s*$/imu.exec(remainder);
  return next ? jobs.slice(start, start + match[0].length + next.index) : jobs.slice(start);
}

function replaceInJob(workflow, jobName, search, replacement) {
  const block = extractJob(workflow, jobName);
  if (!block || !block.includes(search)) return workflow;
  return workflow.replace(block, block.replace(search, replacement));
}

function validationTrustBoundaryFailures(workflow) {
  const boundaryFailures = [];
  const jobsIndex = workflow.indexOf("\njobs:\n");
  const header = jobsIndex < 0 ? workflow : workflow.slice(0, jobsIndex);
  const expectedJobs = [
    "source-validation",
    "production-image",
    "validate-social",
    "publish-social-image",
  ];
  const jobs = jobsIndex < 0 ? "" : workflow.slice(jobsIndex + 1);
  const actualJobs = [...jobs.matchAll(/^  ([a-z0-9_-]+):\s*$/gimu)].map(
    (match) => match[1],
  );

  if (JSON.stringify(actualJobs) !== JSON.stringify(expectedJobs)) {
    boundaryFailures.push("Validation workflow job inventory changed.");
  }
  if (!/^permissions:\n  contents: read\s*$/mu.test(header) || /\bpackages\s*:/u.test(header)) {
    boundaryFailures.push("Validation workflow default permissions must be contents: read only.");
  }

  const untrustedJobs = expectedJobs.slice(0, 3);
  const forbiddenUntrustedPatterns = [
    [/\bpackages\s*:/u, "package permission"],
    [/\$\{\{\s*secrets\./u, "secret context"],
    [/\bGITHUB_TOKEN\b/u, "GitHub token"],
    [/docker\s+login/iu, "registry login"],
    [/ghcr[.]io/iu, "registry endpoint"],
    [/type=registry/iu, "registry cache"],
    [/BUILD_CACHE_(?:FROM|TO)/u, "registry cache variable"],
  ];
  const exactUntrustedCheckout = [
    "      - name: Checkout exact source without persisted credentials",
    "        uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0",
    "        with:",
    "          fetch-depth: 0",
    "          persist-credentials: false",
    "          ref: ${{ github.event.pull_request.head.sha || github.sha }}",
  ].join("\n");

  for (const jobName of untrustedJobs) {
    const block = extractJob(workflow, jobName);
    if (!block) {
      boundaryFailures.push(`Missing untrusted validation job: ${jobName}`);
      continue;
    }
    if (!/^    permissions:\n      contents: read\s*$/mu.test(block)) {
      boundaryFailures.push(`${jobName} permissions must be contents: read only.`);
    }
    if (
      (jobName === "source-validation" || jobName === "production-image") &&
      !block.includes(exactUntrustedCheckout)
    ) {
      boundaryFailures.push(
        `${jobName} checkout must pin the PR head SHA or current event SHA.`,
      );
    }
    for (const [pattern, label] of forbiddenUntrustedPatterns) {
      if (pattern.test(block)) {
        boundaryFailures.push(`${jobName} must not use ${label}.`);
      }
    }
  }

  const untrustedRefCount =
    workflow.match(/ref: \$\{\{ github[.]event[.]pull_request[.]head[.]sha \|\| github[.]sha \}\}/gu)
      ?.length ?? 0;
  if (untrustedRefCount !== 2) {
    boundaryFailures.push("Exactly two untrusted checkouts must use the PR-head/current-SHA ref.");
  }

  const imageValidation = extractJob(workflow, "production-image");
  if (
    !imageValidation.includes("github.event_name != 'workflow_dispatch'") ||
    !imageValidation.includes("bash scripts/build-production-image.sh") ||
    !imageValidation.includes("bash scripts/check-clean-database-migrations.sh") ||
    !imageValidation.includes("Generate production image SBOM")
  ) {
    boundaryFailures.push("Untrusted image validation lost a required local Docker gate.");
  }
  const exactUntrustedImageBuildStep = [
    "      - name: Build production image locally without registry access",
    "        id: image-revision",
    "        working-directory: services/social",
    "        shell: bash",
    "        run: |",
    "          set -Eeuo pipefail",
    '          checked_out_revision="$(git rev-parse HEAD)"',
    '          [[ "$checked_out_revision" =~ ^[0-9a-f]{40}$ ]]',
    '          GITHUB_SHA="$checked_out_revision" bash scripts/build-production-image.sh',
    '          echo "commit=$checked_out_revision" >> "$GITHUB_OUTPUT"',
  ].join("\n");
  const exactUntrustedImageLabelStep = [
    "      - name: Verify production image OCI labels",
    "        env:",
    "          BUILT_REVISION: ${{ steps.image-revision.outputs.commit }}",
    "        shell: bash",
    "        run: |",
    "          set -Eeuo pipefail",
    '          checked_out_revision="$(git rev-parse HEAD)"',
    '          [[ "$checked_out_revision" =~ ^[0-9a-f]{40}$ ]]',
    '          [[ "$BUILT_REVISION" == "$checked_out_revision" ]]',
    '          GITHUB_SHA="$checked_out_revision" bash scripts/check-image-labels.sh',
  ].join("\n");
  const checkedRevisionCount =
    imageValidation.match(/checked_out_revision="\$\(git rev-parse HEAD\)"/gu)?.length ?? 0;
  const localRevisionBindingCount =
    imageValidation.match(/GITHUB_SHA="\$checked_out_revision" bash scripts\/(?:build-production-image|check-image-labels)[.]sh/gu)
      ?.length ?? 0;
  if (
    !imageValidation.includes(exactUntrustedImageBuildStep) ||
    !imageValidation.includes(exactUntrustedImageLabelStep) ||
    checkedRevisionCount !== 2 ||
    localRevisionBindingCount !== 2 ||
    !imageValidation.includes(
      "          name: social-image-validation-${{ steps.image-revision.outputs.commit }}",
    ) ||
    imageValidation.includes("name: social-image-validation-${{ github.sha }}")
  ) {
    boundaryFailures.push(
      "Untrusted image build, label check, and SBOM evidence must bind to the checked-out revision.",
    );
  }

  const sourceValidation = extractJob(workflow, "source-validation");
  const frontendBuildIndex = sourceValidation.indexOf("npm run production");
  const frontendDriftIndex = sourceValidation.indexOf(
    "git diff --exit-code -- services/social/public",
  );
  const exactFrontendDriftStep = [
    "      - name: Reject tracked or untracked frontend asset drift",
    "        shell: bash",
    "        run: |",
    "          set -Eeuo pipefail",
    "          git diff --exit-code -- services/social/public",
    '          untracked_assets="$(git ls-files --others --exclude-standard -- services/social/public)"',
    '          if [[ -n "$untracked_assets" ]]; then',
    "            printf 'Untracked generated frontend assets:\\n%s\\n' \"$untracked_assets\" >&2",
    "            exit 1",
    "          fi",
  ].join("\n");
  if (
    frontendBuildIndex < 0 ||
    frontendDriftIndex <= frontendBuildIndex ||
    !sourceValidation.includes(exactFrontendDriftStep) ||
    /git\s+(?:restore|clean)\b[^\n]*services\/social\/public/iu.test(sourceValidation)
  ) {
    boundaryFailures.push(
      "Frontend drift must fail after the build and must never be discarded in CI.",
    );
  }

  const requiredGate = extractJob(workflow, "validate-social");
  const requiredGateIfLines = requiredGate.match(/^    if:\s*[^\n]+$/gmu) ?? [];
  if (
    requiredGateIfLines.length !== 1 ||
    requiredGateIfLines[0].trim() !== "if: always()"
  ) {
    boundaryFailures.push("Required validate-social job-level condition must be only if: always().");
  }
  const exactFanInStep = [
    "      - name: Confirm every required validation lane passed",
    "        env:",
    "          EVENT_NAME: ${{ github.event_name }}",
    "          SOURCE_VALIDATION_RESULT: ${{ needs.source-validation.result }}",
    "          PRODUCTION_IMAGE_RESULT: ${{ needs.production-image.result }}",
    "        shell: bash",
    "        run: |",
    "          set -Eeuo pipefail",
    '          [[ "$SOURCE_VALIDATION_RESULT" == "success" ]]',
    '          case "$EVENT_NAME" in',
    '            push | pull_request)',
    '              [[ "$PRODUCTION_IMAGE_RESULT" == "success" ]]',
    "              ;;",
    '            workflow_dispatch)',
    '              [[ "$PRODUCTION_IMAGE_RESULT" == "skipped" ]]',
    "              ;;",
    "            *)",
    '              echo "Unsupported validation event: $EVENT_NAME" >&2',
    "              exit 1",
    "              ;;",
    "          esac",
    '          echo "Source and event-required image validation passed."',
  ].join("\n");
  if (!requiredGate.includes(exactFanInStep)) {
    boundaryFailures.push("Required validate-social shell fan-in changed.");
  }

  const publish = extractJob(workflow, "publish-social-image");
  if (
    !publish.includes("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'") ||
    !publish.includes("packages: write") ||
    publish.includes("packages: read") ||
    !publish.includes("          ref: ${{ inputs.commit }}") ||
    publish.includes("github.event.pull_request.head.sha || github.sha") ||
    /BUILD_CACHE_(?:FROM|TO)/u.test(publish) ||
    /type=registry/iu.test(publish)
  ) {
    boundaryFailures.push(
      "Candidate publication must be inputs.commit-pinned and must not mutate a registry cache.",
    );
  }
  const exactRegistrySentinelStep = [
    "      - name: Verify the existing registry package sentinel",
    "        shell: bash",
    "        run: |",
    "          set -Eeuo pipefail",
    '          recorded_image="$(jq -er \'.registry_image\' docs/operations/release-traceability.v1.json)"',
    '          incumbent_digest="$(jq -er \'.incumbent_record.last_recorded_image_digest\' docs/operations/release-traceability.v1.json)"',
    '          [[ "$recorded_image" == "$REGISTRY_IMAGE" ]]',
    '          [[ "$incumbent_digest" =~ ^sha256:[0-9a-f]{64}$ ]]',
    '          [[ "$incumbent_digest" == "sha256:1fd27c8f76595595912e6f12f1677c7f108aa50f64b38a85089006b47ad395f1" ]]',
    '          if ! docker buildx imagetools inspect "$REGISTRY_IMAGE@$incumbent_digest" >/dev/null 2>/dev/null; then',
    '            echo "The existing registry package sentinel is not reachable." >&2',
    "            exit 1",
    "          fi",
  ].join("\n");
  const exactCandidateAbsenceGuard = [
    '          immutable_tag="$REGISTRY_IMAGE:$GITHUB_SHA"',
    '          inspect_stderr="$(mktemp)"',
    "          cleanup_inspect() {",
    '            rm -f -- "$inspect_stderr"',
    "          }",
    "          trap cleanup_inspect EXIT",
    "",
    "          inspect_status=0",
    '          if docker buildx imagetools inspect "$immutable_tag" >/dev/null 2>"$inspect_stderr"; then',
    '            echo "The immutable candidate tag already exists; refusing to replace it." >&2',
    "            exit 1",
    "          else",
    "            inspect_status=$?",
    "          fi",
    "",
    "          manifest_absent=false",
    '          if grep -Fq "$immutable_tag: not found" "$inspect_stderr"; then',
    "            manifest_absent=true",
    '          elif grep -Fq "no such manifest: $immutable_tag" "$inspect_stderr"; then',
    "            manifest_absent=true",
    '          elif grep -Fq "manifest unknown" "$inspect_stderr" && grep -Fq "$immutable_tag" "$inspect_stderr"; then',
    "            manifest_absent=true",
    '          elif grep -Eq "manifests/${GITHUB_SHA}([^0-9a-f]|$).*404 Not Found|404 Not Found.*manifests/${GITHUB_SHA}([^0-9a-f]|$)" "$inspect_stderr"; then',
    "            manifest_absent=true",
    "          fi",
    "",
    '          if [[ "$manifest_absent" != "true" ]]; then',
    "            printf 'Unable to prove the immutable candidate tag is absent (inspect status %s).\\n' \"$inspect_status\" >&2",
    "            exit 1",
    "          fi",
    "",
    "          cleanup_inspect",
    "          trap - EXIT",
  ].join("\n");
  const localSbomIndex = publish.indexOf("      - name: Generate production image SBOM");
  const loginIndex = publish.indexOf(
    "      - name: Log in to the existing GitHub Container Registry package",
  );
  const sentinelIndex = publish.indexOf(exactRegistrySentinelStep);
  const sentinelReadIndex = publish.indexOf(
    'docker buildx imagetools inspect "$REGISTRY_IMAGE@$incumbent_digest"',
  );
  const firstRegistryInspectIndex = publish.indexOf("docker buildx imagetools inspect");
  const guardIndex = publish.indexOf(exactCandidateAbsenceGuard);
  const tagIndex = publish.indexOf('          docker tag "$PIXELFED_IMAGE" "$immutable_tag"');
  const pushIndex = publish.indexOf('          docker push "$immutable_tag"');
  const pushCount = publish.match(/^\s*docker push "\$immutable_tag"\s*$/gmu)?.length ?? 0;
  const betweenLoginAndSentinel =
    loginIndex >= 0 && sentinelIndex >= 0 ? publish.slice(loginIndex, sentinelIndex) : "";
  const beforeCandidatePush = pushIndex >= 0 ? publish.slice(0, pushIndex) : publish;
  if (
    localSbomIndex < 0 ||
    loginIndex <= localSbomIndex ||
    sentinelIndex <= loginIndex ||
    sentinelReadIndex < sentinelIndex ||
    firstRegistryInspectIndex !== sentinelReadIndex ||
    /docker\s+(?:pull|manifest)|docker\s+buildx\s+imagetools|ghcr[.]io\/v2\//iu.test(
      betweenLoginAndSentinel,
    ) ||
    guardIndex <= sentinelIndex ||
    guardIndex < 0 ||
    tagIndex <= guardIndex ||
    pushIndex <= tagIndex ||
    pushCount !== 1 ||
    /docker\s+push|docker\s+buildx\s+build[^\n]*--push|oras\s+push|crane\s+(?:push|copy)|skopeo\s+copy/iu.test(
      beforeCandidatePush,
    )
  ) {
    boundaryFailures.push(
      "Local gates, late login, package sentinel, fail-closed tag absence, and one push are out of order or incomplete.",
    );
  }

  const packagesWriteCount = workflow.match(/\bpackages:\s*write\b/gu)?.length ?? 0;
  const packagesReadCount = workflow.match(/\bpackages:\s*read\b/gu)?.length ?? 0;
  if (packagesWriteCount !== 1 || packagesReadCount !== 0) {
    boundaryFailures.push("Validation workflow package permissions exceed the manual publisher.");
  }

  return boundaryFailures;
}

for (const file of required) {
  if (!existsSync(file)) failures.push(`Missing required repository path: ${file}`);
}

for (const forbidden of [
  "app",
  "bootstrap",
  "config",
  "database",
  "Dockerfile",
  "docker-compose.production.yml",
  "composer.json",
  "composer.lock",
  "public",
  "resources",
  "routes",
  "storage",
]) {
  if (existsSync(forbidden)) {
    failures.push(`Application source must remain under services/social: ${forbidden}`);
  }
}

const packageJson = JSON.parse(read("package.json"));
const packageLock = JSON.parse(read("package-lock.json"));
if (
  packageJson.name !== "mochirii-social" ||
  packageLock.name !== packageJson.name ||
  packageJson.engines?.node !== "22.23.1" ||
  packageJson.engines?.npm !== "10.9.8" ||
  read(".node-version").trim() !== "22.23.1" ||
  read("services/social/.node-version").trim() !== "22.23.1"
) {
  failures.push("Root and application Node toolchain identity is inconsistent.");
}

if (
  read("UPSTREAM_REVISION").trim() !==
    "c8bed78bee3d796c5efb57393dafafbba3706f38"
) {
  failures.push("Pinned upstream revision changed.");
}

const workflowDirectory = ".github/workflows";
const workflows = readdirSync(workflowDirectory)
  .filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"))
  .sort();
const expectedWorkflows = [
  "deploy-social-production.yml",
  "recover-social-production.yml",
  "validate-social.yml",
  "verify-social-online-hosting.yml",
];
if (JSON.stringify(workflows) !== JSON.stringify(expectedWorkflows)) {
  failures.push("Workflow inventory contains a missing or unrelated workflow.");
}

for (const workflow of workflows) {
  const file = `${workflowDirectory}/${workflow}`;
  const text = read(file);
  if (/\bpull_request_target\s*:/u.test(text)) {
    failures.push(`${file} must not use pull_request_target.`);
  }
  const actions = [...text.matchAll(/^\s*uses:\s*([^\s#]+)/gmu)].map(
    (match) => match[1],
  );
  for (const action of actions) {
    if (!action.startsWith("./") && !/@[0-9a-f]{40}$/u.test(action)) {
      failures.push(`${file} action is not pinned to a full commit: ${action}`);
    }
  }
  const checkoutCount = actions.filter((action) =>
    action.startsWith("actions/checkout@"),
  ).length;
  const safeCheckoutCount = (
    text.match(/persist-credentials:\s*false/gu) ?? []
  ).length;
  if (safeCheckoutCount < checkoutCount) {
    failures.push(`${file} must disable persisted credentials for every checkout.`);
  }
}

const validate = read(".github/workflows/validate-social.yml");
for (const requiredText of [
  "workflow_dispatch:",
  "PUBLISH SOCIAL CANDIDATE",
  "Publish one immutable candidate",
  "github.event_name == 'workflow_dispatch'",
  "ghcr.io/mochirii-wushu/mochirii-pixelfed-ops",
  "services/social",
  "npm run production",
  "git diff --exit-code -- services/social/public",
  "git ls-files --others --exclude-standard -- services/social/public",
  "Generate production image SBOM",
  "Attest production image provenance",
  "Attest production image SBOM",
]) {
  if (!validate.includes(requiredText)) {
    failures.push(`validate-social.yml must include: ${requiredText}`);
  }
}

const expectedTargetedTests = [
  "tests/Feature/LoginTest.php",
  "tests/Feature/RemoteOidcTest.php",
  "tests/Unit/ActivityPub/AudienceScopeTest.php",
  "tests/Unit/ActivityPub/RemoteFollowTest.php",
  "tests/Unit/AvatarUploadPolicyTest.php",
  "tests/Unit/ImageTransformPolicyTest.php",
];
const targetedTestStep = /      - name: Run targeted authentication, federation, and media policy tests\n[\s\S]*?(?=\n      - name:)/u.exec(
  validate,
)?.[0] ?? "";
const actualTargetedTests = targetedTestStep.match(/tests\/[A-Za-z0-9_./-]+Test[.]php/gu) ?? [];
if (
  !targetedTestStep.includes("php artisan test \\") ||
  JSON.stringify(actualTargetedTests) !== JSON.stringify(expectedTargetedTests)
) {
  failures.push("validate-social.yml targeted application test command or inventory changed.");
}
if (/github\.event_name == 'push'[\s\S]{0,200}docker push/u.test(validate)) {
  failures.push("Ordinary push validation must not publish an image.");
}

failures.push(...validationTrustBoundaryFailures(validate));

const hostileWorkflowFixtures = [
  [
    "package read permission",
    validate.replace(
      "  production-image:\n",
      "  production-image:\n    permissions:\n      packages: read\n",
    ),
  ],
  [
    "secret-backed registry login",
    validate.replace(
      "      - name: Set up Docker Buildx\n",
      "      - name: Hostile registry login\n" +
        "        env:\n" +
        "          GHCR_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n" +
        "        run: printf '%s' \"$GHCR_TOKEN\" | docker login ghcr.io --password-stdin\n\n" +
        "      - name: Set up Docker Buildx\n",
    ),
  ],
  [
    "registry cache",
    replaceInJob(
      validate,
      "production-image",
      "        working-directory: services/social\n        shell: bash\n",
      "        working-directory: services/social\n" +
        "        env:\n" +
        "          BUILD_CACHE_FROM: type=registry,ref=ghcr.io/example/cache\n" +
      "        shell: bash\n",
    ),
  ],
  [
    "manual publisher mutates registry cache",
    replaceInJob(
      validate,
      "publish-social-image",
      "        working-directory: services/social\n        run: bash scripts/build-production-image.sh\n",
      "        working-directory: services/social\n" +
        "        env:\n" +
        "          BUILD_CACHE_FROM: type=registry,ref=ghcr.io/example/cache\n" +
        "          BUILD_CACHE_TO: type=registry,ref=ghcr.io/example/cache,mode=max\n" +
        "        run: bash scripts/build-production-image.sh\n",
    ),
  ],
  [
    "missing source checkout ref",
    replaceInJob(
      validate,
      "source-validation",
      "          ref: ${{ github.event.pull_request.head.sha || github.sha }}\n",
      "          ref: \"\"\n",
    ),
  ],
  [
    "default production checkout ref",
    replaceInJob(
      validate,
      "production-image",
      "          ref: ${{ github.event.pull_request.head.sha || github.sha }}\n",
      "",
    ),
  ],
  [
    "base branch checkout ref",
    replaceInJob(
      validate,
      "source-validation",
      "          ref: ${{ github.event.pull_request.head.sha || github.sha }}",
      "          ref: ${{ github.event.pull_request.base.sha || github.sha }}",
    ),
  ],
  [
    "synthetic merge checkout ref",
    replaceInJob(
      validate,
      "production-image",
      "          ref: ${{ github.event.pull_request.head.sha || github.sha }}",
      "          ref: ${{ github.sha }}",
    ),
  ],
  [
    "manual publisher follows PR ref",
    replaceInJob(
      validate,
      "publish-social-image",
      "          ref: ${{ inputs.commit }}",
      "          ref: ${{ github.event.pull_request.head.sha || github.sha }}",
    ),
  ],
  [
    "untrusted image build omits checked-out revision binding",
    replaceInJob(
      validate,
      "production-image",
      '          GITHUB_SHA="$checked_out_revision" bash scripts/build-production-image.sh',
      "          bash scripts/build-production-image.sh",
    ),
  ],
  [
    "untrusted label check omits checked-out revision binding",
    replaceInJob(
      validate,
      "production-image",
      '          GITHUB_SHA="$checked_out_revision" bash scripts/check-image-labels.sh',
      "          bash scripts/check-image-labels.sh",
    ),
  ],
  [
    "untrusted label check inherits synthetic context revision",
    replaceInJob(
      validate,
      "production-image",
      '          GITHUB_SHA="$checked_out_revision" bash scripts/check-image-labels.sh',
      '          GITHUB_SHA="$GITHUB_SHA" bash scripts/check-image-labels.sh',
    ),
  ],
  [
    "untrusted image build inherits synthetic context revision",
    replaceInJob(
      validate,
      "production-image",
      '          checked_out_revision="$(git rev-parse HEAD)"',
      '          checked_out_revision="$GITHUB_SHA"',
    ),
  ],
  [
    "untrusted image build binds synthetic workflow revision",
    replaceInJob(
      validate,
      "production-image",
      '          GITHUB_SHA="$checked_out_revision" bash scripts/build-production-image.sh',
      '          GITHUB_SHA="${{ github.sha }}" bash scripts/build-production-image.sh',
    ),
  ],
  [
    "untrusted SBOM artifact uses synthetic workflow revision",
    replaceInJob(
      validate,
      "production-image",
      "          name: social-image-validation-${{ steps.image-revision.outputs.commit }}",
      "          name: social-image-validation-${{ github.sha }}",
    ),
  ],
  [
    "existing candidate tag is permitted",
    replaceInJob(
      validate,
      "publish-social-image",
      '            echo "The immutable candidate tag already exists; refusing to replace it." >&2\n' +
        "            exit 1",
      '            echo "The immutable candidate tag already exists; refusing to replace it." >&2\n' +
        "            true",
    ),
  ],
  [
    "exact absent candidate response is not recognized",
    replaceInJob(
      validate,
      "publish-social-image",
      '          if grep -Fq "$immutable_tag: not found" "$inspect_stderr"; then\n' +
        "            manifest_absent=true",
      '          if grep -Fq "$immutable_tag: not found" "$inspect_stderr"; then\n' +
        "            manifest_absent=false",
    ),
  ],
  [
    "arbitrary candidate inspect error permits publication",
    replaceInJob(
      validate,
      "publish-social-image",
      '          if [[ "$manifest_absent" != "true" ]]; then',
      "          if false; then",
    ),
  ],
  [
    "registry package sentinel failure is tolerated",
    replaceInJob(
      validate,
      "publish-social-image",
      '          if ! docker buildx imagetools inspect "$REGISTRY_IMAGE@$incumbent_digest" >/dev/null 2>/dev/null; then',
      "          if false; then",
    ),
  ],
  [
    "registry package sentinel digest drifts",
    replaceInJob(
      validate,
      "publish-social-image",
      "sha256:1fd27c8f76595595912e6f12f1677c7f108aa50f64b38a85089006b47ad395f1",
      "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    ),
  ],
  [
    "candidate probe precedes registry package sentinel",
    replaceInJob(
      validate,
      "publish-social-image",
      "      - name: Verify the existing registry package sentinel\n",
      "      - name: Hostile early candidate probe\n" +
        "        run: docker buildx imagetools inspect \"$REGISTRY_IMAGE:$GITHUB_SHA\" >/dev/null 2>&1 || true\n\n" +
        "      - name: Verify the existing registry package sentinel\n",
    ),
  ],
  [
    "registry write precedes candidate absence proof",
    replaceInJob(
      validate,
      "publish-social-image",
      '          inspect_stderr="$(mktemp)"',
      '          docker push "$immutable_tag"\n' +
        '          inspect_stderr="$(mktemp)"',
    ),
  ],
  [
    "compound required-check condition",
    validate.replace(
      "    if: always()\n",
      "    if: always() && needs.source-validation.result == 'success'\n",
    ),
  ],
  [
    "skipped source dependency accepted",
    validate.replace(
      '          [[ "$SOURCE_VALIDATION_RESULT" == "success" ]]',
      '          [[ "$SOURCE_VALIDATION_RESULT" != "failure" ]]',
    ),
  ],
  [
    "skipped image dependency accepted on push",
    validate.replace(
      '              [[ "$PRODUCTION_IMAGE_RESULT" == "success" ]]',
      '              [[ "$PRODUCTION_IMAGE_RESULT" != "failure" ]]',
    ),
  ],
  [
    "non-skipped image dependency accepted on dispatch",
    validate.replace(
      '              [[ "$PRODUCTION_IMAGE_RESULT" == "skipped" ]]',
      '              [[ "$PRODUCTION_IMAGE_RESULT" == "success" ]]',
    ),
  ],
  [
    "tracked frontend drift ignored",
    validate.replace(
      "          git diff --exit-code -- services/social/public\n",
      "          true # tracked frontend drift ignored\n",
    ),
  ],
  [
    "untracked frontend drift ignored",
    validate.replace(
      "          untracked_assets=\"$(git ls-files --others --exclude-standard -- services/social/public)\"\n",
      "          untracked_assets=\"\"\n",
    ),
  ],
  [
    "frontend drift discarded",
    validate.replace(
      "          git diff --exit-code -- services/social/public\n",
      "          git restore --worktree -- services/social/public\n" +
        "          git diff --exit-code -- services/social/public\n",
    ),
  ],
];

for (const [label, fixture] of hostileWorkflowFixtures) {
  if (fixture === validate || validationTrustBoundaryFailures(fixture).length === 0) {
    failures.push(`Workflow trust policy did not reject hostile fixture: ${label}`);
  }
}

const deploy = read(".github/workflows/deploy-social-production.yml");
for (const requiredText of [
  "environment: social-production",
  "migration_approval",
  '[[ "$MIGRATION_APPROVAL" == "NONE" ]]',
  "services/social/docker-compose.production.yml",
  "repository=Mochirii-Wushu/Mochirii",
  "source_repository=Mochirii-Wushu/Mochirii-Social",
  "source_commit=",
  "DEPLOY social.mochirii.com",
]) {
  if (!deploy.includes(requiredText)) {
    failures.push(`deploy-social-production.yml must include: ${requiredText}`);
  }
}
if (deploy.includes("repository=Mochirii-Wushu/Mochirii-Social\n")) {
  failures.push("The legacy host protocol sentinel must not be renamed.");
}

const recover = read(".github/workflows/recover-social-production.yml");
if (
  !recover.includes("environment: social-recovery") ||
  !recover.includes("validate-only") ||
  !recover.includes("release_digest=sha256:")
) {
  failures.push("Recovery workflow lost its protected isolated-restore contract.");
}

const hosting = read(".github/workflows/verify-social-online-hosting.yml");
if (
  !hosting.includes("environment: social-production") ||
  !hosting.includes("verify VERIFY_social.mochirii.com")
) {
  failures.push("Hosted verification workflow lost the restricted host protocol.");
}

if (failures.length) {
  console.error([...new Set(failures)].join("\n"));
  process.exit(1);
}
console.log("Social repository boundary and workflow policy passed.");
