import type { MetadataRoute } from "next"

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ""

export const dynamic = "force-static"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "WORK TRACKER",
    short_name: "WORK TRACKER",
    description: "CLIP STUDIO PAINT 작업 시간 기록",
    start_url: `${basePath}/`,
    scope: `${basePath}/`,
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3262ad",
    lang: "ko-KR",
    icons: [
      {
        src: `${basePath}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${basePath}/icons/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  }
}
