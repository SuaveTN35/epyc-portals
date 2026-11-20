import Link from 'next/link';

export default function NotFound() {
  return (
    <main id="main" className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Page not found</h1>
      <p className="text-gray-700 mb-6">We could not find that page. It may have moved.</p>
      <Link href="/" className="btn btn-primary">
        Go to the EPYC Courier home page
      </Link>
    </main>
  );
}
