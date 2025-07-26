import './global.css';
import { Metadata } from 'next';
import { ClientProviders } from '@/components/providers/ClientProviders';

// Static metadata for better SEO and performance
export const metadata: Metadata = {
  title: {
    default: 'Fantasy AI Ultimate',
    template: '%s | Fantasy AI Ultimate'
  },
  description: 'AI-powered fantasy sports platform for every player, every league',
  keywords: ['fantasy sports', 'AI', 'DFS', 'machine learning', 'optimization'],
  authors: [{ name: 'Fantasy AI Team' }],
  creator: 'Fantasy AI Ultimate',
  publisher: 'Fantasy AI Ultimate',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: process.env.NEXT_PUBLIC_APP_URL,
    title: 'Fantasy AI Ultimate',
    description: 'AI-powered fantasy sports platform for every player, every league',
    siteName: 'Fantasy AI Ultimate',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fantasy AI Ultimate',
    description: 'AI-powered fantasy sports platform for every player, every league',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};

// Viewport configuration for better mobile performance
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        {/* Critical resource hints - loaded before any JavaScript */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://api.sportsdata.io" />
        <link rel="preconnect" href="https://api.fantasylabs.com" />
        
        {/* Critical font preloading */}
        <link
          rel="preload"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          as="style"
          onLoad="this.onload=null;this.rel='stylesheet'"
        />
        
        {/* Fallback for font loading */}
        <noscript>
          <link
            rel="stylesheet"
            href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          />
        </noscript>

        {/* Performance and security headers via meta tags */}
        <meta name="color-scheme" content="dark light" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      </head>
      <body className="antialiased font-sans">
        {/* Skip link for accessibility */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-blue-600 text-white px-4 py-2 rounded-md z-50"
        >
          Skip to main content
        </a>
        
        {/* Client-side providers wrapped in separate component */}
        <ClientProviders>
          <main id="main-content">
            {children}
          </main>
        </ClientProviders>
      </body>
    </html>
  );
}