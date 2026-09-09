export type VideoEmbed =
  | { kind: "youtube"; embedUrl: string }
  | { kind: "file" }
  | null;

/**
 * Extracts a YouTube video id from watch / youtu.be / shorts / live / embed URLs.
 * Returns null for non-YouTube URLs.
 */
export function getYouTubeVideoId(url: string): string | null {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  const idPattern = /^[\w-]{6,}$/;

  if (host === "youtube.com" || host === "m.youtube.com" || host === "music.youtube.com") {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v") ?? "";
      return idPattern.test(id) ? id : null;
    }
    const pathMatch = parsed.pathname.match(/^\/(shorts|live|embed|v)\/([\w-]{6,})/);
    return pathMatch ? pathMatch[2] : null;
  }
  if (host === "youtu.be") {
    const id = parsed.pathname.replace(/^\//, "").split("/")[0] ?? "";
    return idPattern.test(id) ? id : null;
  }
  if (host === "youtube-nocookie.com" || host.endsWith(".youtube-nocookie.com")) {
    const embedMatch = parsed.pathname.match(/^\/embed\/([\w-]{6,})/);
    return embedMatch ? embedMatch[1] : null;
  }
  return null;
}

/**
 * Decides how a lesson `sourceUrl` should be rendered for students:
 * - YouTube links -> privacy-friendly embedded player (free + unlimited videos).
 * - Uploaded/internal files or direct video-file URLs -> native <video> player.
 * - Anything else -> external link button only (returns null).
 */
export function getVideoEmbed(sourceUrl: string | null | undefined): VideoEmbed {
  if (!sourceUrl) return null;
  const videoId = getYouTubeVideoId(sourceUrl);
  if (videoId) {
    return { kind: "youtube", embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}` };
  }
  if (sourceUrl.startsWith("/uploads/") || sourceUrl.startsWith("/api/blob-file?")) {
    return { kind: "file" };
  }
  const path = sourceUrl.split("?")[0]?.toLowerCase() ?? "";
  if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/.test(path)) return { kind: "file" };
  return null;
}
