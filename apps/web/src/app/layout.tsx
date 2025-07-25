'use client';

import './global.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="dark light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <title>Fantasy AI Ultimate</title>
        <meta name="description" content="AI-powered fantasy sports platform for every player, every league" />
      </head>
      <body className="antialiased">
        <main>
          {children}
        </main>
      </body>
    </html>
  );
}