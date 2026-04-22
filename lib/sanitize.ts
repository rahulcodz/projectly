import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "code",
  "pre",
  "a",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "hr",
  "span",
  "div",
  "img",
  "video",
  "audio",
  "source",
  "iframe",
];

const MEDIA_EMBED_CLASSES = [
  "media-embed",
  "media-embed-image",
  "media-embed-video",
  "media-embed-audio",
  "media-embed-pdf",
  "media-embed-office",
  "media-embed-youtube",
  "media-embed-vimeo",
  "media-embed-file",
];

export function sanitizeRichHtml(input: string): string {
  if (!input) return "";
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: [
        "href",
        "target",
        "rel",
        "class",
        "data-type",
        "data-id",
        "data-label",
        "data-project-id",
        "data-kind",
        "data-filename",
      ],
      span: ["class", "data-type", "data-id", "data-label"],
      div: ["class", "data-type", "data-kind"],
      img: [
        "src",
        "alt",
        "title",
        "width",
        "height",
        "loading",
        "class",
        "data-type",
        "data-kind",
      ],
      video: [
        "src",
        "controls",
        "preload",
        "poster",
        "width",
        "height",
        "class",
        "data-type",
        "data-kind",
      ],
      audio: [
        "src",
        "controls",
        "preload",
        "class",
        "data-type",
        "data-kind",
      ],
      source: ["src", "type"],
      iframe: [
        "src",
        "width",
        "height",
        "frameborder",
        "loading",
        "allow",
        "allowfullscreen",
        "class",
        "data-type",
        "data-kind",
        "data-src",
        "data-filename",
      ],
    },
    allowedClasses: {
      span: ["mention"],
      a: ["mention", "task-ref", ...MEDIA_EMBED_CLASSES],
      div: MEDIA_EMBED_CLASSES,
      img: MEDIA_EMBED_CLASSES,
      video: MEDIA_EMBED_CLASSES,
      audio: MEDIA_EMBED_CLASSES,
      iframe: MEDIA_EMBED_CLASSES,
    },
    disallowedTagsMode: "discard",
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
      img: ["http", "https"],
      video: ["http", "https"],
      audio: ["http", "https"],
      source: ["http", "https"],
      iframe: ["http", "https"],
    },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }),
    },
  });
}

export function stripHtml(input: string): string {
  return input.replace(/<[^>]+>/g, "").trim();
}

export function extractMentionIds(html: string): string[] {
  if (!html) return [];
  const ids = new Set<string>();
  const spanRe = /<span\b[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = spanRe.exec(html)) !== null) {
    const tag = m[0];
    if (!/data-type\s*=\s*"mention"/i.test(tag)) continue;
    const idMatch = tag.match(/data-id\s*=\s*"([^"]+)"/i);
    if (idMatch?.[1]) ids.add(idMatch[1]);
  }
  return Array.from(ids);
}
