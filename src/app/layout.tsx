import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clipsaw",
  description: "Local media file splitter - Clipsaw",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" className="dark">
      <body className="h-screen overflow-hidden antialiased">
        {children}
      </body>
    </html>
  );
}
