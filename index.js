const {debug, warning, setFailed, getInput, setOutput} = require("@actions/core");
const {context, getOctokit} = require("@actions/github");
const fs = require('fs');
const path = require('path');
const semverClean = require('semver/functions/clean');
const semverInc = require('semver/functions/inc');
const semverGte = require('semver/functions/gte');

async function run() {
    const DEFAULT_VERSION = "0.0.0";

    try {
        debug(
            ` Available environment variables:\n -> ${Object.keys(process.env)
                .map(key => key + ' :: ' + process.env[key])
                .join('\n -> ')}`
        );

        const pkgFileRoot = getInput('package_root', {required: false});
        const pkgFilePath = path.join(process.env.GITHUB_WORKSPACE, pkgFileRoot, 'package.json');
        debug(`package.json file path: ${pkgFilePath}`);

        if (!fs.existsSync(pkgFilePath)) {
            setFailed('package.json does not exist.');
            return;
        }

        const pkg = require(pkgFilePath);
        debug(`Detected package version ${pkg.version}`);
        const pkgVersion = semverClean(pkg.version);
        if (!pkgVersion) {
            setFailed(`Invalid version string in package.json: ${pkg.version}`);
            return;
        }


        if (!process.env.hasOwnProperty('GITHUB_TOKEN')) {
            setFailed('Invalid or missing GITHUB_TOKEN.');
            return;
        }


        const tagPrefix = getInput('tag_prefix', {required: false});
        const tagSuffix = getInput('tag_suffix', {required: false});
        let latestVersion = DEFAULT_VERSION;
        try {
            const github = getOctokit(process.env.GITHUB_TOKEN);
            const {owner, repo} = context.repo;
            debug(`Github context: owner -> ${owner}; repo -> ${repo}`);

            const response = await github.rest.repos.getLatestRelease({owner, repo});
            debug(`Latest release response: ${JSON.stringify(response.data)}`);

            let tag = response.data.tag_name;
            debug(`Latest release tag: ${tag}`);

            if (tagPrefix && tag.startsWith(tagPrefix))
                tag = tag.replace(tagPrefix, '');

            if (tagSuffix && tag.endsWith(tagSuffix))
                tag = tag.replace(tagSuffix, '');

            latestVersion = semverClean(tag);
            if (!latestVersion) {
                setFailed(`Invalid version string in latest release: ${tag}`);
                return;
            }
        } catch (e) {
            // No releases yet
            if (e.response.status !== 404) {
                warning(e.message);
                setFailed(e.message);
                return;
            }
        }

        const nextVersion =
            semverGte(latestVersion, pkgVersion) ?
                semverInc(latestVersion, 'patch') : pkgVersion;

        debug(`
            Package version: ${pkgVersion} \n
            Previous release version: ${latestVersion} \n
            Next release version: ${nextVersion}
        `);

        pkg.version = nextVersion;
        fs.writeFileSync(pkgFilePath, JSON.stringify(pkg));
        debug(JSON.stringify(require(pkgFilePath)));

        setOutput('package_file', pkgFilePath);
        setOutput('tag', `${tagPrefix}${nextVersion}${tagSuffix}`);
    } catch (e) {
        warning(e.message);
        setFailed('Unable to generate next version');
    }
}

run();
