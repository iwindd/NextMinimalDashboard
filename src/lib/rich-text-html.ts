import sanitizeHtml from "sanitize-html";

/**
 * Server-side counterpart of the shared admin body editor
 * (src/admin/components/rich-text-editor.tsx).
 *
 * The editor's text-colour control emits `<span style="color: ...">`, so both
 * the tag and that single style declaration have to survive sanitisation --
 * otherwise the colour is silently dropped on save. Only `color` is permitted;
 * every other declaration in the `style` attribute is stripped.
 */

/** Colour formats Mantine's ColorPicker / swatches can produce. */
const ALLOWED_COLOR_VALUES = [
  /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i,
  /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*[\d.]+\s*)?\)$/i,
  /^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(?:,\s*[\d.]+\s*)?\)$/i,
  /^[a-z]+$/i, // CSS named colours, e.g. `teal`
];

const RICH_TEXT_SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "strong",
    "em",
    "u",
    "s",
    "h2",
    "h3",
    "h4",
    "ul",
    "ol",
    "li",
    "blockquote",
    "a",
    "img",
    "span",
  ],
  allowedAttributes: {
    a: ["href", "target", "rel"],
    img: ["src", "alt", "title"],
    span: ["style"],
  },
  allowedStyles: {
    span: { color: ALLOWED_COLOR_VALUES },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
};

/** Sanitises rich-text body HTML produced by the admin editor. */
export function sanitizeRichTextHtml(html: string) {
  return sanitizeHtml(html, RICH_TEXT_SANITIZE_OPTIONS);
}
