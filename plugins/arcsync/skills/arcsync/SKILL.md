---
name: arcsync
description: Use when the user wants an architecture diagram from infrastructure-as-code (Terraform, AWS CDK, CloudFormation, Pulumi, Azure ARM, Serverless Framework), wants to set up the ArcSync GitHub Action so every push and pull request gets a diagram, asks what infrastructure a pull request adds, removes, or changes, or wants the cards on an ArcSync diagram to read more clearly (resource descriptions and names in the IaC).
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

## 4. Make the diagram's cards easier to read

Each resource is drawn as a card. Its title and its first line come from the IaC, so a vague card is fixed in the source. Use this when the user says the diagram is hard to read, and when you write new IaC that ArcSync will diagram.

**Descriptions.** A resource's own description is the first line of its card (one line, cut off when long) and shows in full when the card is selected. ArcSync reads the description field the resource already has:

| Engine | Attribute read |
|---|---|
| CloudFormation, CDK | `Description`, `GroupDescription` (security groups), `AlarmDescription` (CloudWatch alarms), `Comment` (CloudFront, Route 53). In CDK these are the `description`, `alarmDescription` and `comment` props. |
| Terraform, Pulumi, ARM | `description`, `alarm_description` / `alarmDescription`, `comment` |
| Serverless Framework | Only entries under `resources:`, by their CloudFormation keys. A function's `description` is not read. |

A tag named `Description` is not read, and neither is a CloudFormation value built by a function (`Fn::Sub`, `Fn::Join`). Write one plain sentence that says what the resource does for the system: "Resizes uploaded images and writes thumbnails to the media bucket", not "Lambda function" or a copy of its name. Leave out secrets, account ids and customer names: the text shows on the diagram, which may be public, and in the cloud console. IAM roles and policies are not drawn as cards.

**Titles.** Where the title comes from depends on the engine:

- CloudFormation and CDK: an explicit name property when the resource sets one (`FunctionName`, `TableName`, `BucketName`), otherwise the CDK construct id or the CloudFormation logical id.
- Terraform: the block label (`aws_lambda_function.order_workflow` is titled `order_workflow`).
- Pulumi: the resource name, the first argument to its constructor.
- ARM: the resource's `name`. Serverless Framework: the function's key.

For a **new** resource, choose an id that names its role: `OrderWorkflow`, not `Fn2`. Do not add a physical name only to get a title.

**Never replace a resource to improve a label.** These rules outrank a clearer diagram:

- Do not rename an existing resource. A new CDK construct id or CloudFormation logical id makes CloudFormation create a second resource and delete the first, and a deleted table or bucket takes its data with it. A renamed Terraform block does the same unless it comes with a `moved` block, and a renamed Pulumi resource unless it has `aliases`.
- Do not change an existing resource's physical name. That also replaces it.
- Some descriptions cannot change in place, and editing one replaces the resource: a security group's, an IAM managed policy's, and an RDS or ElastiCache parameter group's are common cases, not the whole list. Set those only on resources you are creating.
- Before you commit, preview the change and confirm that every edit is an in-place update: `cdk diff`, `terraform plan`, `pulumi preview`, a CloudFormation change set (also for Serverless Framework), or `az deployment group what-if` for ARM. The preview is the authority. If it shows a replacement or a destroy, take that edit out. If you cannot run it, say so and list the resources you changed.

## Reference

- Agent overview: `https://arcsync.dev/llms.txt`
- Full API reference: `https://arcsync.dev/llms-full.txt`
- Action setup guide: `https://arcsync.dev/docs/github-action.md`
- Pricing and quotas: `https://arcsync.dev/pricing`
