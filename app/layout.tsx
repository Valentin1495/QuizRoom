import '../styles/globals.css';
import { Provider } from 'react-redux';
import { store } from '../store';

export default function RootLayout({
  // Layouts must accept a children prop.
  // This will be populated with nested layouts or pages
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang='en'>
      <body>
        <Provider store={store}>{children}</Provider>
      </body>
    </html>
  );
}
