import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/styles/design-tokens.css";

export const metadata: Metadata = {
  title: "ASCII Rhythm / Design Preview",
  description: "ASCII-minimal rhythm game interface preview."
};

export default function RootLayout({
  children
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
