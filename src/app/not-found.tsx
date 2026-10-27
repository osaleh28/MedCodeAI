import Link from "next/link";

export default function NotFound() {
  return <main id="main-content" className="message-page"><h1>Page not found.</h1><p>This page is unavailable or you don’t have access to it.</p><Link className="button primary" href="/">Return home</Link></main>;
}
