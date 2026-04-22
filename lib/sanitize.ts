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
      ],
      span: ["class", "data-type", "data-id", "data-label"],
    },
    allowedClasses: {
      span: ["mention"],
      a: ["mention", "task-ref"],
    },
    disallowedTagsMode: "discard",
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: {
      a: ["http", "https", "mailto"],
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
