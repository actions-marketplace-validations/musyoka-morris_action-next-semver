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


    try {
        core.debug(
            ` Available environment variables:\n -> ${Object.keys(process.env)
                .map(key => key + ' :: ' + process.env[key])
                .join('\n -> ')}`
        );

        const pkgRoot = core.getInput('package_root', {required: false});
        const pkgFile = path.join(process.env.GITHUB_WORKSPACE, pkgRoot, 'package.json');
        if (!fs.existsSync(pkgFile))
            throw new NextSemverError('package.json does not exist.');

        const pkg = require(pkgFile);
        core.debug(`Detected package version ${pkg.version}`);
        const pkgVersion = clean(pkg.version);


        if (!process.env.hasOwnProperty('GITHUB_TOKEN'))
            throw new NextSemverError('Invalid or missing GITHUB_TOKEN.');


        const tagPrefix = core.getInput('tag_prefix', {required: false});
        const tagSuffix = core.getInput('tag_suffix', {required: false});
        let latestVersion = DEFAULT_VERSION;
        try {
            const github = getOctokit(process.env.GITHUB_TOKEN);
            const {owner, repo} = context.repo;
            core.debug(`Github context: owner -> ${owner}; repo -> ${repo}`);

            const response = await github.rest.repos.getLatestRelease({owner, repo});
            core.debug(`Latest release response: ${JSON.stringify(response.data)}`);

            let tag = response.data.tag_name;
            core.debug(`Latest release tag: ${tag}`);

            if (tagPrefix && tag.startsWith(tagPrefix))
                tag = tag.replace(tagPrefix, '');

            if (tagSuffix && tag.endsWith(tagSuffix))
                tag = tag.replace(tagSuffix, '');

            latestVersion = clean(tag);
        } catch (error) {
            // No releases yet
            if (error.response.status !== 404)
                throw error;
        }

        const nextVersion =
            semverGte(latestVersion, pkgVersion) ?
                semverInc(latestVersion, 'patch') : pkgVersion;

        core.debug(`
            Package version: ${pkgVersion} \n
            Previous release version: ${latestVersion} \n
            Next release version: ${nextVersion}
        `);

        pkg.version = nextVersion;
        fs.writeFileSync(pkgFile, JSON.stringify(pkg));

        core.setOutput('tag', `${tagPrefix}${nextVersion}${tagSuffix}`);
    } catch (e) {
        core.warning(e.message);
        core.setFailed(e instanceof NextSemverError ? e.message : 'Unable to generate next version');
    }
}

run();
