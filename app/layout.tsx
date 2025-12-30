import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import SmoothScroll from "@/components/ui/SmoothScroll";
import GlobalContextMenuHandler from "@/components/providers/GlobalContextMenuHandler";

const sfPro = localFont({
  src: "./fonts/SF-Pro-Display-Regular.otf",
  variable: "--font-sf-pro",
});

export const metadata: Metadata = {
  title: "Rivault | Secure Cloud Storage",
  description: "Private, encrypted, crash-safe storage.",
};

export const runtime = "edge";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sfPro.variable} font-sans antialiased bg-black text-white`}
      >
        <GlobalContextMenuHandler />
        <SmoothScroll />
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
