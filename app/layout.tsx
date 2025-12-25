import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";

const sfPro = localFont({
  src: "./fonts/SF-Pro-Display-Regular.otf",
  variable: "--font-sf-pro",
});

export const metadata: Metadata = {
  title: "Rivault | Secure Cloud Storage",
  description: "Private, encrypted, crash-safe storage.",
};

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
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
