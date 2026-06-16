# @lety-ai/widget-loader

Builds `widget.js`, the lightweight loader embedded on customer sites:

```html
<script src="https://cdn.lety.ai/widget.js" data-widget-id="w_xxx" async></script>
```

Responsibilities (LET-2037):

- Read `data-widget-id` from the script tag.
- Inject the floating bubble + chat iframe pointing at the widget app.
- Do not interfere with the host page's CSS/JS.
- Log a clear console message when blocked (non-allowed domain / disabled widget / inactive agent).
