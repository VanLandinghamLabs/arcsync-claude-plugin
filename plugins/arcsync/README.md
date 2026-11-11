# ArcSync

ArcSync turns infrastructure-as-code into architecture diagrams. This plugin installs the [ArcSync MCP server](https://github.com/VanLandinghamLabs/arcsync-mcp) and three skills:

- `arcsync`: diagram Terraform, AWS CDK, CloudFormation, Pulumi, Azure ARM and Serverless Framework code through [arcsync.dev](https://arcsync.dev), set up the [ArcSync GitHub Action](https://arcsync.dev/docs/github-action) so every push and pull request gets a diagram, read a pull request's infra delta, and make a diagram's cards clearer without replacing deployed resources;
- `arcsync-mcp`: when to call each MCP tool to read a repository's diagram, a resource and what it connects to, or what a pull request changes;
- `arcsync-diagrams`: write, check and publish a new architecture diagram or state machine for a spec or RFC.

MCP tools: `list_diagrams`, `get_diagram`, `describe_resource`, `get_delta`, `list_versions`, `start_parse`, `get_parse_status`, `validate_diagram`, `push_diagram`, `get_diagram_source` and `list_icons`.

## What it runs and where data goes

- **MCP server.** The server's code ships inside this plugin, in `server/`, and Claude Code starts it with `node` from there. Nothing is downloaded when it starts. It needs Node.js 22 or later. `server/` holds one readable file per module: ArcSync's own code and, under `server/vendor/`, the open-source libraries it uses (the MCP TypeScript SDK, zod, ajv and their dependencies), each with its license. The same server is published to npm as `arcsync-mcp` from the public repository above. It sends its requests to `https://api.arcsync.dev` only, and sends no telemetry. Its tools read your diagrams, start a parse of a repository you name, and store diagrams Claude writes when it calls `push_diagram`.
- **Connecting your account.** The first tool call that needs your account returns a link to `https://arcsync.dev/settings/mcp/connect`. You open it and click Connect; ArcSync hands the server an MCP credential over `127.0.0.1`, and the server saves it to `~/.config/arcsync/mcp-credential.json` (mode 0600). Delete that file to disconnect. `validate_diagram` and `list_icons` work without an account.
- **Skills.** Claude may fetch public documentation from `https://arcsync.dev` (`/llms.txt`, `/llms-full.txt`, `/docs/github-action.md`), and may write a GitHub Actions workflow that runs `VanLandinghamLabs/arcsync-action`, which uploads that repository's diagram to ArcSync from your CI.

The plugin has no hooks, commands or scripts of its own. Neither the skills nor the server write a credential anywhere but the file above. A CI secret is stored by you, interactively, in your GitHub repository's secrets with `gh secret set`.

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
