import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Manpower Management System",
  description: "Enterprise Multi-Tenant Manpower Architecture",
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
