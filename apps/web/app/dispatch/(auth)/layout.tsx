export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main id="main" tabIndex={-1} className="focus:outline-none focus:[box-shadow:none]">
      {children}
    </main>
  );
}
