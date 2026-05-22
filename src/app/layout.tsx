import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SmallBiz Ops",
    template: "%s · SmallBiz Ops",
  },
  description: "Customers, products, invoices — on your phone.",
  applicationName: "SmallBiz Ops",
  appleWebApp: {
    capable: true,
    title: "SmallBiz",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
  },
};

// Next 16: viewport lives in its own export, not under metadata.
export const viewport: Viewport = {
  themeColor: "#B8552A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // iOS Safari uses this on the safe-area inset behaviour
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-center" richColors closeButton={false} />
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
