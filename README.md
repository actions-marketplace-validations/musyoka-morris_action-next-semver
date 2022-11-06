# Generate Next Release Semantic Version

- A GitHub Action to automate the process of creating the next release semantic version for your repository. 
     Note: this only generates a new release version instead of creating a new release.
- This action will set an environment variable named `version` which can then be used to create the next release.
- It uses the previous release tag and increments the patch version.
- To bump the `major` or `minor` versions, change the value in the package json to a value higher than the latest release
- This action is recommended to be used with `Klemensas/action-autotag@stable` to create a release tag.

## Example workflow

The following is an example `.github/workflows/main.yml` that will execute when a push to the master branch occurs.

```yaml
name: Create Next Release Semantic Version

on: 
  push:
    branches:
      - master

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: musyoka-morris/action-next-semver@stable
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

To make this work, the workflow must have the checkout action before the next-semver action.

This order is important!

```yaml
- uses: actions/checkout@v2
- uses: musyoka-morris/action-next-semver@stable
```

If the repository is not checked out first, action-next-semver cannot find the package.json file.

## Configuration

The `GITHUB_TOKEN` must be passed in. Without this, it is not possible to create a the next version. 
Make sure the next-semver action looks like the following example:

```yaml
- uses:  musyoka-morris/action-next-semver@stable
  env:
    GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
```

The action will automatically extract the token at runtime. 
**DO NOT MANUALLY ENTER YOUR TOKEN**. 
If you put the actual token in your workflow file, you'll make it accessible (in plaintext) 
to anyone who ever views the repository (it will be in your git history).

## Optional Configurations

There are several options to customize how the tag is created.

1. `package_root`

   By default, next-semver will look for the `package.json` file in the project root. 
    If the file is located in a subdirectory, this option can be used to point to the correct file.

    ```yaml
    - uses: musyoka-morris/action-next-semver@stable
       env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
      with:
        package_root: "/path/to/subdirectory"
    ```

2. `tag_prefix`

   By default, next-semver expects release tag names to use [semantic versioning](https://semver.org/), such as `1.0.0`. 
    In the event a prefix is added to the semver when generating tag names, then next-semver strips the prefix from the tag name before parsing the semver.
    For example, if a tag is labeled as `my-prefix1.0.0` and `tag_prefix` is set to `my-prefix`, then the tag would be transformed to `1.0.0` before processing.

    ```yaml
    - uses: musyoka-morris/action-next-semver@stable
       env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
      with:
        tag_prefix: "my-prefix"
    ```
   
3. `tag_suffix`
   Text can also be added at the end of the semver when generating tag names. In this case,
    then next-semver strips the suffix from the tag name before parsing the semver.
   For example, if a tag is labeled as `1.0.0 (beta)` and `tag_suffix` is set to ` (beta)`, 
    then the tag would be transformed to `1.0.0` before processing.

    ```yaml
    - uses: musyoka-morris/action-next-semver@stable
       env:
          GITHUB_TOKEN: "${{ secrets.GITHUB_TOKEN }}"
      with:
        tag_suffix: " (beta)"
    ```

## Outputs
If you are building an action that runs after this one,
be aware this action produces a single output [outputs](https://help.github.com/en/articles/metadata-syntax-for-github-actions#outputs):

`version`: The next release semantic version.
