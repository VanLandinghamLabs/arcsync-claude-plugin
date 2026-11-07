---
name: arcsync
description: Use when the user wants an architecture diagram from infrastructure-as-code (Terraform, AWS CDK, CloudFormation, Pulumi, Azure ARM, Serverless Framework), wants to set up the ArcSync GitHub Action so every push and pull request gets a diagram, or asks what infrastructure a pull request adds, removes, or changes.
---

# ArcSync

ArcSync turns infrastructure-as-code into architecture diagrams: an interactive canvas at `arcsync.dev`, Mermaid markdown for docs and PR comments, and on pull requests an *infra delta* — the resources a PR adds, removes, or changes compared with the base branch.

Supported engines: Terraform (HCL), AWS CDK (TypeScript, JavaScript, Python, Java, Go, C#), CloudFormation (single and multi-stack), Pulumi, Azure ARM, and Serverless Framework. Bicep is not supported.

Pick the procedure that matches the request.

## 1. Set up the ArcSync GitHub Action

This is the free path for CDK, Pulumi and Terraform, because the customer's CI does the build. CloudFormation, ARM and Serverless Framework have no build output to upload; use §3 for those. Two lanes:

- **App install (no secrets).** If the user can install the ArcSync GitHub App on a CDK, Pulumi or Terraform repository, installing it opens a pull request that adds the workflow with the correct `permissions:` block. Send them to `https://arcsync.dev/settings`. Nothing else to configure.
- **Manual workflow.** Before writing any YAML, read `https://arcsync.dev/docs/github-action.md` — it carries the required `permissions:` block and the right `path:` for each engine. Omitting `id-token: write` fails the upload. Keep `contents: read` too: the action reads repo metadata with it, and if the fallback lookup also fails, the backend treats the repo as private and keeps its diagram out of the gallery, which cannot be undone later.

The workflow must run on `pull_request` **and** `push` to the default branch: the push keeps the base branch's diagram current, and that is what a pull request's infra delta diffs against.

If the App cannot be installed on their org, they create an ArcSync CI credential at `https://arcsync.dev/settings` and store the secret with `gh secret set ARCSYNC_CLIENT_SECRET`, entered interactively. Never write the secret to a file, echo it, or put it in a commit. The job still needs `id-token: write`. The Action runs only on GitHub Actions, and other CI systems cannot upload a GitHub repository, so use §3 there.

Use `VanLandinghamLabs/arcsync-action@v3`. Older majors are retired.

## 2. Read a pull request's infra delta

On `pull_request` runs the Action's comment starts with an **Infra delta** block: a one-line summary such as "adds 1 RDS, removes 1 NAT Gateway, changes 2 Security Groups", then a table of added (➕), removed (➖) and changed (✏️) resources with their IaC ids, and a link into the canvas with the changes highlighted. When the base branch has never been diagrammed the block says so; the fix is a run on the base branch (see §1).

The Action also exposes a `delta-status` output (`ok`, `no-base`, or `none` when no delta came back, as on non-PR runs) for workflows that want to gate on it.

Free accounts see the resource count and an upgrade link; the per-resource table, the summary sentence and the canvas highlight are Pro and Team features.

## 3. Generate a diagram from a Git repository through the API

Requires an ArcSync account and an Auth0 bearer token or MCP credential; use this only when the Action does not fit.

1. `POST https://api.arcsync.dev/graphs/generate` with `{ "repoUrl": "https://github.com/owner/repo", "branch": "main" }`.
2. Poll `GET /graphs/{graphId}/status` until it reports completion.
3. Open `https://arcsync.dev/canvas/{graphId}` for the interactive diagram, or `https://arcsync.dev/markdown/{graphId}` for Mermaid.

CDK and Pulumi projects are synthesized on ArcSync's servers on this path, which is metered separately from cheap parses (10 per month on the free tier). The Action does not consume that budget, because the user's CI does the synth. With **Re-parse on push** on for that diagram, a push to a paid workspace also runs a server synth.

## Reference

- Agent overview: `https://arcsync.dev/llms.txt`
- Full API reference: `https://arcsync.dev/llms-full.txt`
- Action setup guide: `https://arcsync.dev/docs/github-action.md`
- Pricing and quotas: `https://arcsync.dev/pricing`
