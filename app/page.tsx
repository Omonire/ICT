'use client';

import Preloader from '@/components/landing/preloader';
import LandingNav from '@/components/landing/landing-nav';
import Hero from '@/components/landing/hero';
import Stats from '@/components/landing/stats';
import Bento from '@/components/landing/bento';
import Workflow from '@/components/landing/workflow';
import Testimonials from '@/components/landing/testimonials';
import CtaFooter from '@/components/landing/cta-footer';

export default function LandingPage() {
  return (
    <main className="bg-white">
      <Preloader />
      <LandingNav />
      <Hero />
      <Stats />
      <Bento />
      <Workflow />
      <Testimonials />
      <CtaFooter />
    </main>
  );
}
