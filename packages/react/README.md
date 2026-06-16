# @lety-ai/react

React component to embed the Lety chat widget (LET-2035).

```tsx
import { LetyWidget } from '@lety-ai/react';

export default function App() {
  return <LetyWidget widgetId="w_xxx" />;
}
```

- Uses the same loader (`@lety-ai/widget-loader`) under the hood, so it behaves exactly like
  the script-tag version.
- Only one widget instance exists on the page even if the component mounts twice.
- Unmounting removes the widget cleanly.
