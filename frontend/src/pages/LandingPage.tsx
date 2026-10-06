/**
 * Landing Page Component
 * Professional, brand-consistent marketing page for Zettaz Cloud POS.
 * Uses the app's own navy design system instead of an ad-hoc color scheme.
 */

import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingCart,
  BarChart3,
  Check,
  ArrowRight,
  Shield,
  Scale,
  Package,
  Mail,
  Phone,
  Facebook,
  Instagram,
  Linkedin,
  UserPlus,
  Settings,
  BookOpen,
  ArrowUp,
  Menu,
  X,
} from 'lucide-react';

const stats = [
  { value: '20+', label: 'Years' },
  { value: '600+', label: 'Businesses Served' },
  { value: '99.9%', label: 'Uptime SLA' },
];

const features = [
  {
    icon: ShoppingCart,
    title: 'Smart Sales Processing',
    description:
      'Fast, reliable checkout with intelligent product suggestions and seamless payment processing across all channels.',
  },
  {
    icon: BarChart3,
    title: 'Advanced Analytics',
    description:
      'Real-time reporting and predictive insights so you can make confident decisions about pricing, staffing, and stock.',
  },
  {
    icon: Package,
    title: 'Inventory Management',
    description:
      'Automated stock tracking, low-stock alerts, and intelligent reordering keep your business running without surprises.',
  },
];

const steps = [
  {
    icon: UserPlus,
    title: 'Sign Up',
    description: 'Create your account in minutes. No credit card required to get started.',
  },
  {
    icon: Settings,
    title: 'Set Up Your Store',
    description: 'Configure products, taxes, and integrations to match how your business runs.',
  },
  {
    icon: ShoppingCart,
    title: 'Start Selling',
    description: 'Process transactions and manage inventory with a system your whole team can use.',
  },
];

const testimonials = [
  {
    quote:
      'Zettaz Cloud transformed our restaurant operations. Sales are up 30% and our staff picked it up in a day.',
    name: 'Sarah Martinez',
    role: 'Owner, Bella Vista Cafe',
    initials: 'SM',
  },
  {
    quote:
      'The analytics dashboard gives us insights we never had before. We make data-driven decisions instantly.',
    name: 'Michael Johnson',
    role: 'Manager, Tech Retail Plus',
    initials: 'MJ',
  },
  {
    quote: 'Support is outstanding. They helped us migrate from our old system with zero downtime.',
    name: 'Amanda Lee',
    role: 'Director, Fashion Forward',
    initials: 'AL',
  },
];

const LandingPage: React.FC = () => {
  const [menuOpen, setMenuOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-white dark:bg-card text-foreground">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center">
            <img src="/images/zettaz-cloud-logo-dark.png" alt="Zettaz Cloud" className="h-9 w-auto" />
          </div>

          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-600 dark:text-muted-foreground hover:text-primary-900 transition-colors text-sm font-medium">Features</a>
            <a href="#pricing" className="text-gray-600 dark:text-muted-foreground hover:text-primary-900 transition-colors text-sm font-medium">Pricing</a>
            <a href="#getting-started" className="text-gray-600 dark:text-muted-foreground hover:text-primary-900 transition-colors text-sm font-medium">Getting Started</a>
            <a href="#about" className="text-gray-600 dark:text-muted-foreground hover:text-primary-900 transition-colors text-sm font-medium">About</a>
            <a href="#support" className="text-gray-600 dark:text-muted-foreground hover:text-primary-900 transition-colors text-sm font-medium">Support</a>
          </div>

          <div className="hidden md:flex items-center space-x-4">
            <Link to="/login" className="text-gray-600 dark:text-muted-foreground hover:text-primary-900 transition-colors text-sm font-medium">
              Log In
            </Link>
            <Link
              to="/signup"
              className="bg-primary-700 hover:bg-primary-800 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors"
            >
              Start Free Trial
            </Link>
          </div>

          <button
            className="md:hidden text-gray-700 dark:text-foreground"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-border bg-white dark:bg-card px-6 py-4 space-y-3">
            <a href="#features" className="block text-gray-600 dark:text-muted-foreground text-sm font-medium">Features</a>
            <a href="#pricing" className="block text-gray-600 dark:text-muted-foreground text-sm font-medium">Pricing</a>
            <a href="#getting-started" className="block text-gray-600 dark:text-muted-foreground text-sm font-medium">Getting Started</a>
            <a href="#about" className="block text-gray-600 dark:text-muted-foreground text-sm font-medium">About</a>
            <a href="#support" className="block text-gray-600 dark:text-muted-foreground text-sm font-medium">Support</a>
            <div className="pt-3 border-t border-border flex flex-col space-y-2">
              <Link to="/login" className="text-gray-600 dark:text-muted-foreground text-sm font-medium">Log In</Link>
              <Link
                to="/signup"
                className="bg-primary-700 text-white text-center px-5 py-2.5 rounded-lg text-sm font-semibold"
              >
                Start Free Trial
              </Link>
            </div>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-950">
        {/* Subtle radial glow, single accent color only */}
        <div className="pointer-events-none absolute -top-24 right-0 w-[36rem] h-[36rem] bg-primary-700/30 rounded-full blur-3xl" aria-hidden="true" />

        <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-28">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Left column - copy */}
            <div className="space-y-8">
              <div className="inline-flex items-center bg-white/10 border border-white/20 rounded-full px-4 py-1.5">
                <span className="text-xs font-semibold text-primary-100 tracking-wide uppercase">Part of the Zettaz technology family — since 2006</span>
              </div>

              <h1 className="text-4xl lg:text-5xl font-bold leading-tight text-white">
                One POS platform to run your entire business
              </h1>

              <p className="text-lg text-primary-200 leading-relaxed max-w-lg">
                Zettaz Cloud brings sales, inventory, and reporting into a single cloud-native platform —
                so you can spend less time managing systems and more time growing your business.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <Link
                  to="/signup"
                  className="bg-white dark:bg-card hover:bg-primary-50 text-primary-900 px-7 py-3.5 rounded-lg font-semibold transition-colors flex items-center justify-center"
                >
                  Start 14-Day Free Trial
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
                <a
                  href="#features"
                  className="text-white font-semibold px-2 py-3.5 hover:text-primary-100 transition-colors inline-flex items-center"
                >
                  See How It Works
                  <ArrowRight className="ml-2 w-4 h-4" />
                </a>
              </div>

              <p className="text-sm text-primary-300">No credit card required · Cancel anytime</p>
            </div>

            {/* Right column - product preview */}
            <div className="relative">
              <div className="rounded-2xl border border-border shadow-2xl overflow-hidden bg-white dark:bg-card">
                {/* Fake browser chrome to frame the "product" */}
                <div className="flex items-center gap-2 bg-gray-50 dark:bg-muted/50 border-b border-border px-4 py-3">
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                  <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                </div>
                <div className="bg-primary-900 p-6 text-white">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-semibold">Today's Sales</h3>
                    <span className="text-xs text-primary-200">Updated just now</span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="text-2xl font-bold">$12,847</div>
                      <div className="text-sm text-primary-200">Revenue</div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-4">
                      <div className="text-2xl font-bold">247</div>
                      <div className="text-sm text-primary-200">Orders</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-3 text-sm">
                      <span>Coffee &amp; Pastries</span>
                      <span className="font-semibold">$45.20</span>
                    </div>
                    <div className="flex items-center justify-between bg-white/10 rounded-lg px-4 py-3 text-sm">
                      <span>Lunch Special</span>
                      <span className="font-semibold">$28.50</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 bg-gray-50 dark:bg-muted/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-primary-900 mb-4">Everything you need to run your business</h2>
            <p className="text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
              One platform for sales, inventory, and insight — no more juggling disconnected tools.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-card hover:shadow-elegant transition-shadow"
                >
                  <div className="bg-primary-50 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                    <Icon className="w-6 h-6 text-primary-700" />
                  </div>
                  <h3 className="text-xl font-bold text-primary-900 mb-3">{feature.title}</h3>
                  <p className="text-gray-600 dark:text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Getting Started */}
      <section id="getting-started" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-primary-900 mb-4">Get started in minutes</h2>
            <p className="text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
              Three simple steps between you and a fully running POS.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="text-center px-4">
                  <div className="relative bg-primary-700 w-14 h-14 rounded-full flex items-center justify-center mb-6 mx-auto">
                    <Icon className="w-6 h-6 text-white" />
                    <span className="absolute -top-2 -right-2 bg-primary-900 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-primary-900 mb-3">{step.title}</h3>
                  <p className="text-gray-600 dark:text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 bg-gray-50 dark:bg-muted/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-primary-900 mb-4">Simple, transparent pricing</h2>
            <p className="text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
              Every plan starts with a free 14-day trial. No credit card required.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 items-start">
            {/* Starter */}
            <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-card">
              <h3 className="text-lg font-bold text-primary-900 mb-1">Starter</h3>
              <div className="text-2xl font-bold text-primary-900 mb-1">Free 14-Day Trial</div>
              <p className="text-gray-500 dark:text-muted-foreground text-sm mb-6">Try every feature, free for 14 days</p>

              <ul className="space-y-3 mb-8">
                {[
                  'Up to 1,000 transactions/month',
                  'Basic reporting',
                  'Email support',
                  'No credit card required',
                ].map((item) => (
                  <li key={item} className="flex items-start text-gray-600 dark:text-muted-foreground text-sm">
                    <Check className="w-4 h-4 text-primary-700 mr-3 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                to="/signup?plan=starter"
                className="w-full block text-center border border-primary-700 text-primary-700 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Professional - featured */}
            <div className="bg-primary-900 rounded-xl p-8 shadow-elegant relative lg:-mt-4">
              <div className="inline-block bg-white/10 text-white px-3 py-1 rounded-full text-xs font-semibold mb-4">
                Most Popular
              </div>
              <h3 className="text-lg font-bold text-white mb-1">Professional</h3>
              <div className="text-2xl font-bold text-white mb-1">Free 14-Day Trial</div>
              <p className="text-primary-200 text-sm mb-6">Then upgrade to Professional anytime</p>

              <ul className="space-y-3 mb-8">
                {[
                  'Up to 10,000 transactions/month',
                  'Advanced analytics',
                  'Priority support',
                  'Multi-location support',
                  'Upgrade anytime after trial',
                ].map((item) => (
                  <li key={item} className="flex items-start text-primary-100 text-sm">
                    <Check className="w-4 h-4 text-white mr-3 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <Link
                to="/signup?plan=professional"
                className="w-full block text-center bg-white dark:bg-card text-primary-900 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Enterprise */}
            <div className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-card">
              <h3 className="text-lg font-bold text-primary-900 mb-1">Enterprise</h3>
              <div className="text-2xl font-bold text-primary-900 mb-1">Custom Trial Available</div>
              <p className="text-gray-500 dark:text-muted-foreground text-sm mb-6">Contact us for a personalized trial experience</p>

              <ul className="space-y-3 mb-8">
                {[
                  'Unlimited transactions',
                  'Custom integrations',
                  '24/7 phone support',
                  'Dedicated account manager',
                ].map((item) => (
                  <li key={item} className="flex items-start text-gray-600 dark:text-muted-foreground text-sm">
                    <Check className="w-4 h-4 text-primary-700 mr-3 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>

              <a
                href="https://zettaz.com/contact"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-center border border-primary-700 text-primary-700 py-3 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-primary-900 mb-6">About Zettaz Cloud</h2>
              <p className="text-lg text-gray-600 dark:text-muted-foreground mb-8">
                We've spent 18 years helping small and medium businesses run more efficiently with
                point-of-sale systems that are powerful enough to scale and simple enough for any team to use.
              </p>
              <ul className="space-y-4">
                {[
                  'Cloud-native platform with no hardware lock-in',
                  'Seamless integrations and customizable workflows',
                  '24/7 support and continuous product improvements',
                ].map((item) => (
                  <li key={item} className="flex items-start">
                    <Check className="w-5 h-5 text-primary-700 mr-3 mt-0.5 shrink-0" />
                    <span className="text-gray-600 dark:text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-gray-50 dark:bg-muted/50 border border-border rounded-xl p-10">
              <div className="grid grid-cols-1 gap-8 text-center">
                {stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-4xl font-bold text-primary-900">{stat.value}</div>
                    <div className="text-gray-500 dark:text-muted-foreground mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 bg-gray-50 dark:bg-muted/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-primary-900 mb-4">Loved by businesses like yours</h2>
            <p className="text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">See what our customers have to say.</p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {testimonials.map((t) => (
              <div key={t.name} className="bg-white dark:bg-card border border-border rounded-xl p-8 shadow-card">
                <p className="text-gray-600 dark:text-muted-foreground mb-6 leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-700 rounded-full flex items-center justify-center mr-4 shrink-0">
                    <span className="text-white text-sm font-semibold">{t.initials}</span>
                  </div>
                  <div>
                    <div className="text-primary-900 font-semibold text-sm">{t.name}</div>
                    <div className="text-gray-500 dark:text-muted-foreground text-sm">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Support */}
      <section id="support" className="py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-primary-900 mb-4">Support &amp; resources</h2>
            <p className="text-lg text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
              Get the help you need, whenever you need it.
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="bg-gray-50 dark:bg-muted/50 border border-border rounded-xl p-8 text-center">
              <div className="bg-primary-700 w-12 h-12 rounded-lg flex items-center justify-center mb-6 mx-auto">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-primary-900 mb-3">Email Support</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4 text-sm">Get help from our expert support team via email.</p>
              <a href="mailto:hello@zettaz.com" className="text-primary-700 font-medium hover:underline text-sm">
                hello@zettaz.com
              </a>
            </div>

            <div className="bg-gray-50 dark:bg-muted/50 border border-border rounded-xl p-8 text-center">
              <div className="bg-primary-700 w-12 h-12 rounded-lg flex items-center justify-center mb-6 mx-auto">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-primary-900 mb-3">Phone Support</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4 text-sm">Speak directly with our support specialists.</p>
              <a href="tel:+1.314.928.7001" className="text-primary-700 font-medium hover:underline text-sm">
                +1.314.928.7001
              </a>
            </div>

            <div className="bg-gray-50 dark:bg-muted/50 border border-border rounded-xl p-8 text-center">
              <div className="bg-primary-700 w-12 h-12 rounded-lg flex items-center justify-center mb-6 mx-auto">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-primary-900 mb-3">Documentation</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4 text-sm">Access our comprehensive guides and tutorials.</p>
              <a href="#getting-started" className="text-primary-700 font-medium hover:underline text-sm">
                View Guides
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* CTA banner */}
      <section className="py-20 bg-primary-900">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Ready to modernize your business?</h2>
          <p className="text-primary-200 text-lg mb-8">
            Start your free 14-day trial today. No credit card required.
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center bg-white dark:bg-card text-primary-900 px-8 py-3.5 rounded-lg font-semibold hover:bg-primary-50 transition-colors"
          >
            Start Free Trial
            <ArrowRight className="ml-2 w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary-950 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-4 gap-12 mb-12">
            <div className="lg:col-span-2">
              <div className="flex items-center mb-6">
                <img src="/images/zettaz-cloud-logo-light.png" alt="Zettaz Cloud" className="h-9 w-auto" />
              </div>
              <p className="text-primary-200 mb-6 max-w-md text-sm leading-relaxed">
                Empowering businesses worldwide with cloud-native point-of-sale solutions.
                Transform your operations and accelerate growth with Zettaz Cloud.
              </p>
              <div className="flex space-x-3">
                <a href="https://www.facebook.com/zettaz.ltd" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Facebook className="w-4 h-4 text-white" />
                </a>
                <a href="https://www.instagram.com/zettazltd/?hl=en" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Instagram className="w-4 h-4 text-white" />
                </a>
                <a href="#" className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-colors">
                  <Linkedin className="w-4 h-4 text-white" />
                </a>
              </div>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-6 text-sm">Support</h3>
              <p className="text-primary-200 text-sm mb-4">
                Have a question or need help? Our team is ready to talk.
              </p>
              <a
                href="https://zettaz.com/contact/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-colors"
              >
                Contact Us
                <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-6 text-sm">Company</h3>
              <ul className="space-y-3 text-sm">
                <li><a href="#about" className="text-primary-200 hover:text-white transition-colors">About</a></li>
                <li><a href="#pricing" className="text-primary-200 hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#support" className="text-primary-200 hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8">
            <div className="flex flex-col md:flex-row items-center justify-between">
              <p className="text-primary-300 text-sm mb-4 md:mb-0">
                © 2006-2025 Zettaz Ltd. All rights reserved.
              </p>
              <div className="flex items-center space-x-6">
                <Link
                  to="/privacy"
                  className="text-primary-300 hover:text-white transition-colors text-sm flex items-center space-x-2"
                >
                  <Shield className="w-4 h-4" />
                  <span>Privacy Policy</span>
                </Link>
                <Link
                  to="/terms"
                  className="text-primary-300 hover:text-white transition-colors text-sm flex items-center space-x-2"
                >
                  <Scale className="w-4 h-4" />
                  <span>Terms &amp; Conditions</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="fixed bottom-8 right-8 z-50 bg-primary-700 text-white p-3 rounded-full shadow-lg hover:bg-primary-800 transition-colors"
        aria-label="Back to top"
      >
        <ArrowUp className="w-5 h-5" />
      </button>
    </div>
  );
};

export default LandingPage;
