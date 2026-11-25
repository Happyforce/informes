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
  async rewrites() {
    // OAuth discovery for the Claude connector (RFC 8414 / RFC 9728). Some
    // clients append the resource path, some try OIDC discovery: map all.
    return [
      { source: "/.well-known/oauth-authorization-server", destination: "/api/oauth/metadata" },
      { source: "/.well-known/oauth-authorization-server/:path*", destination: "/api/oauth/metadata" },
      { source: "/.well-known/openid-configuration", destination: "/api/oauth/metadata" },
      { source: "/.well-known/oauth-protected-resource", destination: "/api/oauth/protected-resource" },
      { source: "/.well-known/oauth-protected-resource/:path*", destination: "/api/oauth/protected-resource" },
    ];
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
