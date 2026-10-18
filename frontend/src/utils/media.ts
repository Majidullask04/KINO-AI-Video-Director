export const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://kino-ai-video-director.onrender.com").replace(/\/+$/, "");

export const backendMediaUrl = (path: string): string => {
  if (!path) return "";

  if (/^https?:\/\//i.test(path)) {
    try {
      const url = new URL(path);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return `${API_BASE}${url.pathname}${url.search}${url.hash}`;
      }
      return path;
    } catch {
      return path;
    }
  }

  return `${API_BASE}/${path.replace(/^\/+/, "")}`;
};

export const DEMO_REFERENCE_VIDEO = backendMediaUrl("/static/samples/ref_high_energy_demo.mp4");
