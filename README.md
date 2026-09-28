# Lety Widget

Embeddable chat widget for Lety AI agents. This repository is independent from
`Lety-2.0_Backend` and `Lety-2.0_Frontend`; it builds and publishes the public,
client-facing artifacts that run on third-party websites.

## Packages

| Package | Path | Output | Distribution |
| --- | --- | --- | --- |
| `@lety-ai/widget-loader` | `packages/loader` | `widget.js` (a few KB) | CDN (`https://cdn.lety.ai/widget.js`) |
| `@lety-ai/widget-app` | `packages/app` | Standalone iframe chat app | CDN (widget host page) |
| `@lety-ai/react-widget-chat` | `packages/react-widget-chat` | React component `<LetyWidget />` | npm |

## How it fits together

1. A site embeds the **loader** via `<script src="https://cdn.lety.ai/widget.js" data-widget-id="w_xxx" async></script>`.
2. The loader injects a floating bubble + an iframe pointing at the **widget app**.
3. The widget app calls the backend public endpoints (`/public/widgets/:widgetId/config`,
   `/public/widgets/:widgetId/session`) and connects to the `widget-chat` WebSocket namespace.
4. The **React package** is a thin wrapper that loads the same loader under the hood.

Backend contract lives in `Lety-2.0_Backend` (api-gateway public endpoints). The
dashboard configuration UI lives in `Lety-2.0_Frontend` (Agent → Integrations → Widget).

## Development

```bash
pnpm install
pnpm dev        # run all packages in watch mode
pnpm build      # build all packages
```

## Linear

Implements LET-2037 (loader + iframe app) and LET-2035 (React package),
sub-issues of LET-1993.

## Publishing `@lety-ai/react-widget-chat` to npm

The React package is published by the `Publish @lety-ai/react-widget-chat to npm`
workflow (`.github/workflows/publish-npm.yml`). It needs, one time only:

1. The `lety-ai` organization on npmjs.com (owner of the `@lety-ai` scope).
2. A granular access token with **read and write** permission on the `@lety-ai`
   scope, stored as the `NPM_TOKEN` secret of the `production` environment.

To release a new version:

```bash
cd packages/react-widget-chat
npm version <patch|minor|major> --no-git-tag-version
git commit -am "chore(react-widget-chat): release vX.Y.Z"
git tag react-widget-chat@vX.Y.Z
git push origin develop react-widget-chat@vX.Y.Z
```

Pushing the tag runs the workflow, which fails if the tag and `package.json`
versions differ and skips the publish if that version is already on npm. The
workflow can also be run manually from the Actions tab.
