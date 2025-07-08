// app/layout.jsx
import './globals.css'

export const metadata = {
  title: 'My App',
  description: 'Simple form with App Router',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-white w-full h-full">{children}</body>
    </html>
  )
}
