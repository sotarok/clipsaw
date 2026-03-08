import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipsaw",
  description: "Local media file splitter - Clipsaw",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
