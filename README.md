# ArcSync for Claude Code

A Claude Code plugin marketplace with one plugin, `arcsync`, whose skill teaches Claude how to:

- diagram Terraform, AWS CDK, CloudFormation, Pulumi, Azure ARM and Serverless Framework code through [arcsync.dev](https://arcsync.dev);
- set up the [ArcSync GitHub Action](https://arcsync.dev/docs/github-action) so every push and pull request gets a diagram;
- read a pull request's infra delta — what it adds, removes, or changes.

## Install

```
/plugin marketplace add VanLandinghamLabs/arcsync-claude-plugin
/plugin install arcsync@arcsync
```

Then ask Claude for an architecture diagram of your infrastructure, or to set up the ArcSync Action in a repository.

## Layout

```
.claude-plugin/marketplace.json     the marketplace manifest
plugins/arcsync/
  .claude-plugin/plugin.json        the plugin manifest
  skills/arcsync/SKILL.md           the skill
```

This repository is published from the ArcSync monorepo when the plugin version is bumped. Issues and pull requests are welcome, but edits to the skill text itself are made upstream.

## License

MIT — see `LICENSE`.
