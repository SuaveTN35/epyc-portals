'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, X, ChevronDown, Phone, User } from 'lucide-react';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  return (
    <>
      {/* Announcement Bar */}
      <div className="bg-epyc-primary text-white text-center py-2 px-4 text-sm">
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
            <nav className="hidden lg:flex items-center space-x-8">
              <Link href="/" className="text-gray-700 hover:text-epyc-primary font-medium">
                Home
              </Link>

              {/* Services Dropdown */}
              <div className="relative group">
                <button
                  className="flex items-center text-gray-700 hover:text-epyc-primary font-medium"
                  onMouseEnter={() => setServicesOpen(true)}
                  onMouseLeave={() => setServicesOpen(false)}
                >
                  Services
                  <ChevronDown className="ml-1 h-4 w-4" />
                </button>
                <div
                  className={`absolute top-full left-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-100 py-2 transition-all duration-200 ${servicesOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                  onMouseEnter={() => setServicesOpen(true)}
                  onMouseLeave={() => setServicesOpen(false)}
                >
                  <Link href="/services/medical" className="block px-4 py-2 text-gray-700 hover:bg-epyc-light hover:text-epyc-primary">
                    Medical Courier
                  </Link>
                  <Link href="/services/legal" className="block px-4 py-2 text-gray-700 hover:bg-epyc-light hover:text-epyc-primary">
                    Legal Courier
                  </Link>
                  <Link href="/services/commercial" className="block px-4 py-2 text-gray-700 hover:bg-epyc-light hover:text-epyc-primary">
                    Commercial Delivery
                  </Link>
                </div>
              </div>

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

              {/* Login Dropdown */}
              <div className="relative group">
                <button
                  className="flex items-center text-gray-700 hover:text-epyc-primary font-medium"
                  onMouseEnter={() => setLoginOpen(true)}
                  onMouseLeave={() => setLoginOpen(false)}
                >
                  <User className="mr-1 h-4 w-4" />
                  Login
                  <ChevronDown className="ml-1 h-4 w-4" />
                </button>
                <div
                  className={`absolute top-full right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 transition-all duration-200 ${loginOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
                  onMouseEnter={() => setLoginOpen(true)}
                  onMouseLeave={() => setLoginOpen(false)}
                >
                  <Link href="/client/login" className="block px-4 py-2 text-gray-700 hover:bg-epyc-light hover:text-epyc-primary">
                    Client Portal
                  </Link>
                  <Link href="/driver/login" className="block px-4 py-2 text-gray-700 hover:bg-epyc-light hover:text-epyc-primary">
                    Driver Portal
                  </Link>
                </div>
              </div>
            </nav>

            {/* Desktop CTA */}
            <div className="hidden lg:flex items-center space-x-4">
              <a href="tel:8182170070" className="flex items-center text-gray-700 hover:text-epyc-primary">
                <Phone className="h-5 w-5 mr-2" />
                (818) 217-0070
              </a>
              <Link href="/#quote" className="btn btn-primary">
                Get Quote
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-gray-100">
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
              <Link href="/#quote" className="btn btn-primary w-full" onClick={() => setMobileMenuOpen(false)}>
                Get Quote
              </Link>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
