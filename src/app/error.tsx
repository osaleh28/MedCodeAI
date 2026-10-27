"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main id="main-content" className="message-page"><h1>We couldn’t load this page.</h1><p>Please try again. If the issue persists, check the database and authentication configuration.</p><button className="button primary" onClick={reset}>Try again</button></main>;
}
