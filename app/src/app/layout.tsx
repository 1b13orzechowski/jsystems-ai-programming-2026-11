import type { Metadata } from "next";
import Image from "next/image";
import localFont from "next/font/local";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { COPY } from "@/lib/domain/copy-pl";

const titillium = localFont({
  src: [
    { path: "../fonts/titilliumweb-extralight-webfont.woff2", weight: "200", style: "normal" },
    { path: "../fonts/titilliumweb-extralightitalic-webfont.woff", weight: "200", style: "italic" },
    { path: "../fonts/titilliumweb-light-webfont.woff", weight: "300", style: "normal" },
    { path: "../fonts/titilliumweb-lightitalic-webfont.woff2", weight: "300", style: "italic" },
    { path: "../fonts/titilliumweb-regular-webfont.woff2", weight: "400", style: "normal" },
    { path: "../fonts/titilliumweb-italic-webfont.woff", weight: "400", style: "italic" },
    { path: "../fonts/titilliumweb-semibold-webfont.woff", weight: "600", style: "normal" },
    { path: "../fonts/titilliumweb-bold-webfont.woff2", weight: "700", style: "normal" },
    { path: "../fonts/titilliumweb-bolditalic-webfont.woff2", weight: "700", style: "italic" },
    { path: "../fonts/titilliumweb-black-webfont.woff2", weight: "900", style: "normal" },
  ],
  variable: "--font-titillium",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

export const metadata: Metadata = {
  title: COPY.app.productName,
  description: COPY.app.metaDescription,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pl" className={`${titillium.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <TooltipProvider>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:rounded-[4px] focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            {COPY.app.skipToContent}
          </a>
          <header className="border-b border-border bg-background">
            <div className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
              <Image
                src="/logo.webp"
                alt={COPY.app.logoAlt}
                width={109}
                height={109}
                priority
                className="h-[72px] w-[72px] sm:h-[109px] sm:w-[109px]"
              />
              <span className="text-[22px] font-semibold text-secondary-foreground">
                {COPY.app.productName}
              </span>
            </div>
          </header>
          <p className="mx-auto w-full max-w-5xl px-4 pt-6 text-[22px] leading-snug font-semibold text-foreground sm:text-[26px]">
            {COPY.app.intro}
          </p>
          {children}
        </TooltipProvider>
      </body>
    </html>
  );
}
