/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // report HTML files are ~0.3–2 MB
      bodySizeLimit: "10mb",
    },
  },
  async redirects() {
    // URLs of the old static site → platform viewer
    return [
      {
        source: "/iv-informe-felicidad-2026.html",
        destination: "/r/iv-informe-felicidad-2026",
        permanent: true,
      },
      {
        source: "/informe_felicidad_vino.html",
        destination: "/r/informe-felicidad-vino-2025",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
