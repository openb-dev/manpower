import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manpower Management System",
  description: "Enterprise Multi-Tenant Manpower Architecture",
  icons: {
    icon: [
      { url: "/icon.png?v=blackcat", type: "image/png", sizes: "32x32" },
      { url: "/favicon.ico?v=blackcat", sizes: "48x48" },
    ],
    shortcut: "/favicon.ico?v=blackcat",
    apple: "/apple-icon.png?v=blackcat",
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
