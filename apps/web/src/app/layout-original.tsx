import './global.css';
import { RealtimeProvider } from '../lib/providers/RealtimeProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { OptimizedLayout } from '../components/OptimizedLayout';
import { AccessibilityProvider } from '../components/accessibility/AccessibilityProvider';
import { SkipNavigation } from '../components/accessibility/SkipLink';
import { VoiceAssistant } from '../components/voice/VoiceAssistant';

export const metadata = {
  title: 'Fantasy AI Ultimate',
  description: 'AI-powered fantasy sports platform for every player, every league',
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <meta name="color-scheme" content="dark light" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">
        <SkipNavigation />
        <ErrorBoundary>
          <AccessibilityProvider>
            <RealtimeProvider>
              <OptimizedLayout>
                <main id="main-content" tabIndex={-1}>
                  {children}
                </main>
                <VoiceAssistant />
              </OptimizedLayout>
            </RealtimeProvider>
          </AccessibilityProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
