# @lety-ai/react

React component to embed the [Lety](https://lety.ai) chat widget (LET-2035).

## Install

```bash
npm install @lety-ai/react
# or
pnpm add @lety-ai/react
```

`react` and `react-dom` (>=18) are peer dependencies.

## Usage

```tsx
import { LetyWidget } from '@lety-ai/react';

export default function App() {
  return (
    <>
      {/* your app */}
      <LetyWidget widgetId="w_xxx" />
    </>
  );
}
```

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `widgetId` | `string` | — | Public widget id from the dashboard (Agent → Integrations → Embed). |
| `scriptUrl` | `string` | `https://cdn.lety.ai/widget.js` | Override the loader script URL (e.g. for self-hosting). |

## Behavior

- Uses the same CDN loader as the script-tag install under the hood, so it
  behaves exactly like the plain `<script>` embed.
- Only one widget instance exists on the page even if the component is mounted
  more than once.
- Unmounting the component removes the widget cleanly.
