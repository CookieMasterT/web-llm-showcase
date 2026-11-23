import assert from "node:assert/strict";
import test from "node:test";
import { formatAssistantMessage } from "../src/utils/markdownFormatter.js";
import {
  formatTokenForDisplay,
  isSpecialTokenText,
  isEndingToken,
} from "../src/ui/tokenDiagnosticsView.js";

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

test("formats whitespace and empty token values for diagnostics", () => {
  assert.equal(formatTokenForDisplay(" "), "･");
  assert.equal(formatTokenForDisplay("\n"), "¶");
  assert.equal(formatTokenForDisplay("\t"), "⇥");
  assert.equal(formatTokenForDisplay("; \n"), ";･¶");
  assert.equal(formatTokenForDisplay(""), "∅");
});

test("recognizes technical and markdown special tokens", () => {
  assert.equal(isSpecialTokenText("<|eot_id|>"), true);
  assert.equal(isSpecialTokenText("```"), true);
  assert.equal(isSpecialTokenText("### "), true);
  assert.equal(isSpecialTokenText("ordinary"), false);
});

test("distinguishes ending tokens from ordinary technical tokens", () => {
  assert.equal(isEndingToken("<|eot_id|>"), true);
  assert.equal(isEndingToken("<|im_end|>"), true);
  assert.equal(isEndingToken("<|im_start|>"), false);
  assert.equal(isEndingToken("```"), false);
});
