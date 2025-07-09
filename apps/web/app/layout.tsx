import './global.css';
import { RealtimeProvider } from '../lib/providers/RealtimeProvider';
import { ErrorBoundary } from '../components/ErrorBoundary';

export const metadata = {
  title: 'Fantasy AI Ultimate',
  description: 'AI-powered fantasy sports platform for every player, every league',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <RealtimeProvider>
            {children}
          </RealtimeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
