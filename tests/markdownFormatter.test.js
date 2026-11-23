import assert from "node:assert/strict";
import test from "node:test";
import { formatAssistantMessage } from "../src/utils/markdownFormatter.js";

test("renders Markdown and turns line endings into visible breaks", () => {
  const html = formatAssistantMessage("# Heading\n\n**Bold**\nNext line");

  assert.match(html, /<h1>Heading<\/h1>/);
  assert.match(html, /<strong>Bold<\/strong><br>\nNext line/);
});

test("preserves indentation in complete and streaming code fences", () => {
  const html = formatAssistantMessage("```python\nif True:\n    print('ok')");

  assert.match(
    html,
    /<code class="language-python">if True:\n {4}print\('ok'\)<\/code>/,
  );
});

test("escapes raw HTML and prevents remote images from loading", () => {
  const html = formatAssistantMessage(
    '<script>alert("unsafe")</script>\n\n![remote](https://example.com/image.png)',
  );

  assert.match(
    html,
    /&lt;script&gt;alert\(&quot;unsafe&quot;\)&lt;\/script&gt;/,
  );
  assert.doesNotMatch(html, /<img|https:\/\/example\.com/);
  assert.match(html, /remote/);
});
