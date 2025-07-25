import { Metadata } from 'next';
import React from 'react';

export const metadata: Metadata = {
  title: 'Contest Browser - Fantasy AI Platform',
  description: 'Find optimal DFS contests with advanced overlay detection and EV calculations',
};

export default function ContestsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black">
      <div className="bg-gradient-to-b from-purple-900/10 via-blue-900/10 to-transparent">
        {children}
      </div>
    </div>
  );
}