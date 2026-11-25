/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      // Report files no longer go through server actions: the browser uploads
      // them straight to Supabase Storage with a signed URL (Vercel caps
      // function request bodies at 4.5 MB anyway). Actions only carry metadata.
      bodySizeLimit: "1mb",
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
