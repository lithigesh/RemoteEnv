
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Env Service UI',
  description: 'Local admin UI for projects, environments, and secrets',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
