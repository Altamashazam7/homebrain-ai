import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeBrain AI | Your household, in harmony",
  description: "Your AI-powered household command centre for time away and everyday life.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
