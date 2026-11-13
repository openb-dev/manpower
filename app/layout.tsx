import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manpower Management System",
  description: "Enterprise Multi-Tenant Manpower Architecture",
  icons: {
    icon: [
      { url: "/nk-logo.png", type: "image/png" },
      { url: "/favicon.svg?v=nk2", type: "image/svg+xml" },
      { url: "/favicon.ico?v=nk2" },
    ],
    shortcut: "/nk-logo.png",
    apple: "/nk-logo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased bg-slate-50 text-slate-900">{children}</body>
    </html>
  );
}
