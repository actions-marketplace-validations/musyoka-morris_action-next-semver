const core = require("@actions/core");
const {context, getOctokit} = require("@actions/github");
const fs = require('fs');
const path = require('path');
const semverClean = require('semver/functions/clean');
const semverInc = require('semver/functions/inc');
const semverGte = require('semver/functions/gte');

async function run() {
    const DEFAULT_VERSION = "0.0.0";

    class NextSemverError extends Error {
    }

    function clean(version) {
        const cleanVersion = semverClean(version);
        if (!cleanVersion)
            throw new NextSemverError(`Invalid semver string: ${version}`);
        return cleanVersion;
    }

    function getPackageVersion() {
        const pkgRoot = core.getInput('package_root', {required: false});
        const pkgFile = path.join(process.env.GITHUB_WORKSPACE, pkgRoot, 'package.json');
        if (!fs.existsSync(pkgFile)) {
            return DEFAULT_VERSION;
        }

        const pkg = require(pkgFile);
        core.debug(`Detected package version ${pkg.version}`);
        return clean(pkg.version);
    }


    async function fetchLatestReleaseTag() {
        if (!process.env.hasOwnProperty('GITHUB_TOKEN'))
            throw new NextSemverError('Invalid or missing GITHUB_TOKEN.');

        try {
            const github = getOctokit(process.env.GITHUB_TOKEN);
            const {owner, repo} = context.repo;
            core.debug(`Github context: owner -> ${owner}; repo -> ${repo}`);

            const response = await github.rest.repos.getLatestRelease({owner, repo});
            core.debug(`Latest release response: ${JSON.stringify(response.data)}`);

            let tag = response.data.tag_name;
            core.debug(`Latest release tag: ${tag}`);

            const tagPrefix = core.getInput('tag_prefix', {required: false});
            if (tagPrefix && tag.startsWith(tagPrefix))
                tag = tag.replace(tagPrefix, '');

            const tagSuffix = core.getInput('tag_suffix', {required: false});
            if (tagSuffix && tag.endsWith(tagSuffix))
                tag = tag.replace(tagSuffix, '');

            return clean(tag);
        } catch (error) {
            // No releases yet
            if (error.response.status === 404) {
                return DEFAULT_VERSION;
            }
            throw error;
        }
    }

    function getNextReleaseVersion(pkgVersion, latestVersion) {
        if (semverGte(latestVersion, pkgVersion))
            return semverInc(latestVersion, 'patch');
        return pkgVersion;

    }

    try {
        core.debug(
            ` Available environment variables:\n -> ${Object.keys(process.env)
                .map(key => key + ' :: ' + process.env[key])
                .join('\n -> ')}`
        );

        const pkgVersion = getPackageVersion();
        const latestVersion = await fetchLatestReleaseTag();
        const nextVersion = getNextReleaseVersion(pkgVersion, latestVersion);

        core.debug(`
            Package version: ${pkgVersion} \n
            Previous release version: ${latestVersion} \n
            Next release version: ${nextVersion}
        `);

        core.setOutput('version', nextVersion);
    } catch (e) {
        core.warning(e.message);
        core.setFailed(e instanceof NextSemverError ? e.message : 'Unable to generate next version');
    }
}

run();
