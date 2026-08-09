import { Suspense } from "react";
import type { Metadata } from "next";
import { Space_Grotesk, IBM_Plex_Sans } from "next/font/google";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/brand";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import ScrollRestoration from "@/components/ScrollRestoration";
import { ToastProvider } from "@/components/Toast";
import { ConfirmProvider } from "@/components/Confirm";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s · ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${plexSans.variable} h-full antialiased`}
    >
      <body className="flex min-h-[100dvh] flex-col">
        <ToastProvider>
          <ConfirmProvider>
          {/* Every route remembers where it was, not just the library.
              Suspense because it reads the search params, which are only
              known once the route resolves. */}
          <Suspense fallback={null}>
            <ScrollRestoration />
          </Suspense>
          <Nav />
          {/* the mobile bottom nav is fixed, so leave it room below the content */}
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:pb-6">
            {children}
          </main>
          <Footer />
          </ConfirmProvider>
        </ToastProvider>
      {/* impeccable-live-start */}
<script src="http://localhost:8400/live.js?token=7539287b-2aea-4ca3-a6a1-a83d57f325a2"></script>
{/* impeccable-live-end */}
</body>
    </html>
  );
}
