export type MediaKind =
  | "image"
  | "video"
  | "audio"
  | "pdf"
  | "office"
  | "youtube"
  | "vimeo"
  | "file";

const EXT_RE = /\.([a-zA-Z0-9]{2,5})(?:[?#]|$)/;

const IMAGE_EXT = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "webp",
  "bmp",
  "avif",
  "svg",
]);
const VIDEO_EXT = new Set(["mp4", "webm", "ogg", "ogv", "mov", "m4v"]);
const AUDIO_EXT = new Set(["mp3", "wav", "m4a", "aac", "oga"]);
const PDF_EXT = new Set(["pdf"]);
const OFFICE_EXT = new Set([
  "xls",
  "xlsx",
  "csv",
  "doc",
  "docx",
  "ppt",
  "pptx",
]);

const IMAGE_HOST_RE = [
  /(^|\.)gstatic\.com$/i,
  /(^|\.)googleusercontent\.com$/i,
  /^i\.imgur\.com$/i,
  /(^|\.)cloudinary\.com$/i,
  /^avatars\.githubusercontent\.com$/i,
  /(^|\.)unsplash\.com$/i,
  /^pbs\.twimg\.com$/i,
  /(^|\.)giphy\.com$/i,
  /^cdn\.discordapp\.com$/i,
  /^media\.discordapp\.net$/i,
];

function youtubeId(u: URL): string | null {
  if (/(^|\.)youtube\.com$/i.test(u.hostname)) {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/);
    if (m) return m[1];
  }
  if (/^youtu\.be$/i.test(u.hostname)) {
    const m = u.pathname.match(/^\/([\w-]{6,})/);
    if (m) return m[1];
  }
  return null;
}

function vimeoId(u: URL): string | null {
  if (!/(^|\.)vimeo\.com$/i.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/(\d+)/);
  return m?.[1] ?? null;
}

export function detectMediaKind(url: string): MediaKind | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;

  if (youtubeId(u)) return "youtube";
  if (vimeoId(u)) return "vimeo";

  const m = u.pathname.match(EXT_RE);
  const ext = m?.[1]?.toLowerCase();
  if (ext) {
    if (IMAGE_EXT.has(ext)) return "image";
    if (VIDEO_EXT.has(ext)) return "video";
    if (AUDIO_EXT.has(ext)) return "audio";
    if (PDF_EXT.has(ext)) return "pdf";
    if (OFFICE_EXT.has(ext)) return "office";
  }

  if (IMAGE_HOST_RE.some((re) => re.test(u.hostname))) return "image";
  if (/\/images?\b/i.test(u.pathname)) return "image";

  return null;
}

export function embedUrlFor(kind: MediaKind, src: string): string {
  try {
    const u = new URL(src);
    if (kind === "youtube") {
      const id = youtubeId(u);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (kind === "vimeo") {
      const id = vimeoId(u);
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
    if (kind === "office") return officeViewerUrl(src);
  } catch {}
  return src;
}

export function filenameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const parts = u.pathname.split("/").filter(Boolean);
    const last = parts[parts.length - 1];
    return last ? decodeURIComponent(last) : u.hostname;
  } catch {
    return url;
  }
}

export function officeViewerUrl(src: string): string {
  return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(
    src
  )}`;
}
