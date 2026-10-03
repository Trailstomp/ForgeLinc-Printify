import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ForgeLinc | Team Shop & Merch Studio",
  description: "Choose your MLBL team, preview your jersey, and prepare five-panel merchandise designs.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
