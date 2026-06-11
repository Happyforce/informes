import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Informes Happyforce",
  description:
    "Publicaciones e informes de Happyforce sobre felicidad, compromiso y liderazgo en el trabajo.",
  // favicon is self-hosted at app/icon.png (Next serves it automatically),
  // so we don't depend on the WordPress site's asset URLs.
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
