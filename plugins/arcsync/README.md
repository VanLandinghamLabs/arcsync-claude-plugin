# ArcSync

ArcSync turns infrastructure-as-code into architecture diagrams. This plugin adds one skill, `arcsync`, that teaches Claude to:

- diagram Terraform, AWS CDK, CloudFormation, Pulumi, Azure ARM and Serverless Framework code through [arcsync.dev](https://arcsync.dev);
- set up the [ArcSync GitHub Action](https://arcsync.dev/docs/github-action), so every push and pull request gets a diagram;
- read a pull request's infra delta: the resources it adds, removes or changes;
- make a diagram's cards clearer by improving the resource descriptions and names in the IaC, without replacing deployed resources.

## What it runs and where data goes

The plugin contains a skill and nothing else: no MCP server, hooks, commands or scripts. When the skill applies, Claude may:

- fetch public documentation from `https://arcsync.dev` (`/llms.txt`, `/llms-full.txt`, `/docs/github-action.md`);
- with your ArcSync account, send a repository URL and branch to `https://api.arcsync.dev/graphs/generate`, then read the diagram's status;
- write a GitHub Actions workflow that runs `VanLandinghamLabs/arcsync-action`, which uploads that repository's diagram to ArcSync from your CI.

The skill never writes a credential to a file. A CI secret is stored by you, interactively, in your GitHub repository's secrets with `gh secret set`.

## Install

```
/plugin marketplace add VanLandinghamLabs/arcsync-claude-plugin
/plugin install arcsync@arcsync
```

Then ask Claude for an architecture diagram of your infrastructure, or to set up the ArcSync Action in a repository.

## Links

- Privacy policy: https://arcsync.dev/privacy
- Terms: https://arcsync.dev/terms
- Security contact: security@arcsync.dev

## License

MIT
