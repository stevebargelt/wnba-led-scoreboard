import type { AppProps } from 'next/app'
import { ThemeProvider } from '../contexts/ThemeContext'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider defaultTheme="system">
      <Component {...pageProps} />
    </ThemeProvider>
  )
}

