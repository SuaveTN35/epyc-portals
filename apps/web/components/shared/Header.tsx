'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronDown, Phone, User } from 'lucide-react';

/**
 * Disclosure-style dropdown: opens on hover, click, Enter or Space; closes on
 * Escape (focus returns to the button), on a click outside, or when focus
 * leaves it. Keyboard and screen reader users can reach every link.
 */
function NavDropdown({
  label,
  icon,
  align = 'left',
  width = 'w-56',
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  align?: 'left' | 'right';
  width?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          setOpen(false);
          buttonRef.current?.focus();
        }
      }}
      onBlur={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className="flex items-center text-gray-700 hover:text-epyc-primary font-medium py-2"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
      >
        {icon}
        {label}
        <ChevronDown className="ml-1 h-4 w-4" aria-hidden="true" />
      </button>
      <div
        id={menuId}
        className={`absolute top-full ${align === 'right' ? 'right-0' : 'left-0'} pt-2 ${width} transition-opacity duration-200 motion-reduce:transition-none ${open ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
      >
        <ul className="bg-white rounded-lg shadow-lg border border-gray-100 py-2">{children}</ul>
      </div>
    </div>
  );
}

const dropLink = 'block px-4 py-2 text-gray-700 hover:bg-epyc-light hover:text-epyc-primary';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>

      {/* Announcement Bar */}
      <div role="region" aria-label="Emergency delivery" className="bg-epyc-primary text-white text-center py-2 px-4 text-sm">
        <p>
          24/7 Emergency Delivery Available | Call Now:{' '}
          <a href="tel:8182170070" className="text-yellow-300 font-semibold hover:text-yellow-200">
            (818) 217-0070
          </a>
        </p>
      </div>

      {/* Main Header */}
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 lg:h-20">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <Image
                src="/images/logo.png"
                alt="EPYC Courier Service"
                width={120}
                height={80}
                className="h-12 lg:h-14 w-auto"
                priority
              />
            </Link>

            {/* Desktop Navigation */}
            <nav aria-label="Main" className="hidden lg:flex items-center space-x-8">
              <Link href="/" className="text-gray-700 hover:text-epyc-primary font-medium">
                Home
              </Link>

              <NavDropdown label="Services">
                <li><Link href="/services/medical" className={dropLink}>Medical Courier</Link></li>
                <li><Link href="/services/legal" className={dropLink}>Legal Courier</Link></li>
                <li><Link href="/services/commercial" className={dropLink}>Commercial Delivery</Link></li>
              </NavDropdown>

              <Link href="/#service-areas" className="text-gray-700 hover:text-epyc-primary font-medium">
                Service Areas
              </Link>
              <Link href="/about" className="text-gray-700 hover:text-epyc-primary font-medium">
                About Us
              </Link>
              <Link href="/contact" className="text-gray-700 hover:text-epyc-primary font-medium">
                Contact
              </Link>
              <Link href="/track" className="text-gray-700 hover:text-epyc-primary font-medium">
                Track
              </Link>
              <Link href="/driver/register" className="text-epyc-primary hover:text-epyc-secondary font-semibold">
                Drive with Us
              </Link>

              <NavDropdown
                label="Login"
                align="right"
                width="w-48"
                icon={<User className="mr-1 h-4 w-4" aria-hidden="true" />}
              >
                <li><Link href="/client/login" className={dropLink}>Client Portal</Link></li>
                <li><Link href="/driver/login" className={dropLink}>Driver Portal</Link></li>
              </NavDropdown>
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center space-x-4">
              <a href="tel:8182170070" className="flex items-center text-gray-700 hover:text-epyc-primary">
                <Phone className="h-5 w-5 mr-2" aria-hidden="true" />
                (818) 217-0070
              </a>
              <Link href="/request-delivery" className="btn btn-primary">
                Request Delivery
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              type="button"
              className="lg:hidden p-2"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-menu"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav id="mobile-menu" aria-label="Main menu" className="lg:hidden bg-white border-t border-gray-100">
            <div className="px-4 py-4 space-y-3">
              <Link href="/" className="block py-2 text-gray-700 font-medium" onClick={() => setMobileMenuOpen(false)}>
                Home
              </Link>
              <div className="py-2">
                <p className="text-gray-500 text-sm mb-2">Services</p>
                <div className="pl-4 space-y-2">
                  <Link href="/services/medical" className="block py-1 text-gray-700" onClick={() => setMobileMenuOpen(false)}>
                    Medical Courier
                  </Link>
                  <Link href="/services/legal" className="block py-1 text-gray-700" onClick={() => setMobileMenuOpen(false)}>
                    Legal Courier
                  </Link>
                  <Link href="/services/commercial" className="block py-1 text-gray-700" onClick={() => setMobileMenuOpen(false)}>
                    Commercial Delivery
                  </Link>
                </div>
              </div>
              <Link href="/about" className="block py-2 text-gray-700 font-medium" onClick={() => setMobileMenuOpen(false)}>
                About Us
              </Link>
              <Link href="/contact" className="block py-2 text-gray-700 font-medium" onClick={() => setMobileMenuOpen(false)}>
                Contact
              </Link>
              <Link href="/track" className="block py-2 text-gray-700 font-medium" onClick={() => setMobileMenuOpen(false)}>
                Track Delivery
              </Link>
              <Link href="/driver/register" className="block py-2 text-epyc-primary font-semibold" onClick={() => setMobileMenuOpen(false)}>
                Drive with Us
              </Link>
              <hr className="my-4" />
              <p className="text-gray-500 text-sm">Login</p>
              <div className="pl-4 space-y-2">
                <Link href="/client/login" className="block py-1 text-epyc-primary font-medium" onClick={() => setMobileMenuOpen(false)}>
                  Client Portal
                </Link>
                <Link href="/driver/login" className="block py-1 text-epyc-primary font-medium" onClick={() => setMobileMenuOpen(false)}>
                  Driver Portal
                </Link>
              </div>
              <hr className="my-4" />
              <Link href="/request-delivery" className="btn btn-primary w-full" onClick={() => setMobileMenuOpen(false)}>
                Request Delivery
              </Link>
            </div>
          </nav>
        )}
      </header>
    </>
  );
}
