import { defineMarkdocConfig } from '@astrojs/markdoc/config';
import shiki from '@astrojs/markdoc/shiki';
import { shikiConfig } from './src/config/shiki.mjs';

// Markdoc renders fenced code through its own `fence` node, so Astro's
// `markdown.shikiConfig` never reaches it — without this extension `.mdoc` code blocks
// come out as unhighlighted `<pre data-language="…">` while `.md` ones are highlighted.
export default defineMarkdocConfig({
    extends: [await shiki(shikiConfig)],
});
