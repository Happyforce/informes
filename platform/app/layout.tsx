import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Informes Happyforce",
  description:
    "Publicaciones e informes de Happyforce sobre felicidad, compromiso y liderazgo en el trabajo.",
  icons: {
    icon: "https://myhappyforce.com/wp-content/uploads/2019/06/cropped-favicon-32x32.png",
  },
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
