<?php

declare(strict_types=1);

function readJsonObject(string $path): array
{
    if (! is_file($path)) {
        throw new RuntimeException("Missing dependency manifest: {$path}");
    }

    $contents = file_get_contents($path);
    if ($contents === false) {
        throw new RuntimeException("Unable to read dependency manifest: {$path}");
    }

    $decoded = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    if (! is_array($decoded)) {
        throw new RuntimeException("Dependency manifest must contain JSON data: {$path}");
    }

    return $decoded;
}

function packageNames(array $packages): array
{
    $names = [];

    foreach ($packages as $package) {
        if (is_array($package) && isset($package['name']) && is_string($package['name'])) {
            $names[$package['name']] = true;
        }
    }

    return $names;
}

try {
    $projectRoot = dirname(__DIR__);
    $lock = readJsonObject($projectRoot.'/composer.lock');
    $installedManifest = readJsonObject($projectRoot.'/vendor/composer/installed.json');
    $installedPackages = isset($installedManifest['packages']) && is_array($installedManifest['packages'])
        ? $installedManifest['packages']
        : $installedManifest;

    $developmentPackages = packageNames($lock['packages-dev'] ?? []);
    $installedNames = packageNames($installedPackages);
    $unexpectedPackages = array_keys(array_intersect_key($developmentPackages, $installedNames));
    sort($unexpectedPackages);

    if ($unexpectedPackages !== []) {
        throw new RuntimeException(
            'Production image contains Composer development dependencies: '.implode(', ', $unexpectedPackages),
        );
    }

    printf(
        "Production dependency check passed: %d development packages are absent from the final image.\n",
        count($developmentPackages),
    );
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage().PHP_EOL);
    exit(1);
}
