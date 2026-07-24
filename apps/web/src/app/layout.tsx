import type { Metadata } from 'next';
import type { JSX } from 'react';

import './globals.css';
import { Providers } from './providers';
import { SessionBootstrap } from './session-bootstrap';

export const metadata: Metadata = {
  title: 'Tradex',
  description: 'Tradex — stock broking for Indian markets',
};

export default function RootLayout({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <html lang="en" className="dark">
      <body>
        <Providers>
          <SessionBootstrap />
          {children}
        </Providers>
      </body>
    </html>
  );
}
