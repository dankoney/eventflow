import type { MetadataRoute } from "next";

export default function manifest({ params }: { params: { id: string } }): MetadataRoute.Manifest {
  const id = params.id;
  return {
    name: "Eventflow check-in",
    short_name: "Check-in",
    description: "Offline-capable guest check-in for Eventflow events.",
    start_url: `/events/${id}/checkin`,
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
        purpose: "any"
      }
    ]
  };
}
