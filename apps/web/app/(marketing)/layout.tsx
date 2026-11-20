import { Header } from '@/components/shared/Header';
import { Footer } from '@/components/shared/Footer';
import { StructuredData } from '@/components/shared/StructuredData';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <StructuredData />
      <Header />
      <main id="main" tabIndex={-1} className="focus:outline-none focus:[box-shadow:none]">
        {children}
      </main>
      <Footer />
    </>
  );
}
