import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ClerkProvider } from "@/components/providers/ClerkProvider";

export const metadata: Metadata = {
  title: {
    default: "EchoSphere — Where Every Answer Shapes the Next Question",
    template: "%s | EchoSphere",
  },
  description:
    "AI-powered adaptive voice interviews. Practice realistic interviews with a coordinated AI interview panel that listens, adapts, challenges your answers, and gives evidence-backed feedback.",
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><circle cx='16' cy='16' r='14' fill='%236366f1' opacity='.15'/><circle cx='16' cy='16' r='8' fill='%236366f1'/><circle cx='16' cy='10' r='3' fill='white'/><circle cx='16' cy='22' r='3' fill='white' opacity='.6'/></svg>",
        type: "image/svg+xml",
      },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ClerkProvider>
          <TooltipProvider>
            {children}
          </TooltipProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
