/**
 * Landing Page Component
 * Professional marketing page for Zettaz Cloud POS
 * Entry point for public signup flow
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  CheckCircle, 
  Star, 
  Shield, 
  Zap, 
  Users, 
  BarChart3, 
  CreditCard,
  ShoppingCart,
  Play,
  Store,
  Receipt,
  TrendingUp,
  DollarSign
} from 'lucide-react';

const LandingPage: React.FC = () => {
  const subscriptionPlans = [
    {
      name: "Starter",
      price: "$29",
      period: "per month",
      description: "Perfect for small businesses just getting started",
      features: [
        "Up to 1,000 transactions/month",
        "Basic inventory management",
        "Customer management",
        "Basic reporting",
        "Email support",
        "1 user account"
      ],
      popular: false,
      color: "blue"
    },
    {
      name: "Professional",
      price: "$79",
      period: "per month",
      description: "Ideal for growing businesses with advanced needs",
      features: [
        "Up to 10,000 transactions/month",
        "Advanced inventory & analytics",
        "Multi-location support",
        "Advanced reporting & insights",
        "Priority support",
        "Up to 5 user accounts",
        "API access",
        "Custom integrations"
      ],
      popular: true,
      color: "purple"
    },
    {
      name: "Enterprise",
      price: "$199",
      period: "per month",
      description: "For large businesses requiring enterprise features",
      features: [
        "Unlimited transactions",
        "Enterprise-grade security",
        "Unlimited locations",
        "Custom reporting & dashboards",
        "24/7 dedicated support",
        "Unlimited user accounts",
        "Advanced API & webhooks",
        "White-label options",
        "Custom integrations"
      ],
      popular: false,
      color: "green"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-pulse animation-delay-4000"></div>
      </div>

      {/* Navigation */}
      <nav className="relative z-50 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">Z</span>
            </div>
            <span className="text-white text-2xl font-bold">Zettaz Cloud</span>
          </div>
          
          <div className="hidden md:flex items-center space-x-8">
            <a href="#features" className="text-gray-300 hover:text-white transition-colors">Features</a>
            <a href="#pricing" className="text-gray-300 hover:text-white transition-colors">Pricing</a>
            <a href="#testimonials" className="text-gray-300 hover:text-white transition-colors">Reviews</a>
            <Link to="/login" className="text-gray-300 hover:text-white transition-colors">Login</Link>
            <Link 
              to="/signup" 
              className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg width="60" height="60" viewBox="0 0 60 60" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.05"%3E%3Ccircle cx="30" cy="30" r="2"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Column - Content */}
            <div className="text-white">
              <div className="inline-flex items-center bg-blue-600/20 backdrop-blur-sm border border-blue-400/30 rounded-full px-4 py-2 mb-6">
                <Zap className="w-4 h-4 mr-2 text-yellow-400" />
                <span className="text-sm font-medium">Trusted by 10,000+ businesses</span>
              </div>
              
              <h1 className="text-4xl lg:text-6xl font-bold mb-6 leading-tight">
                The Future of
                <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  Point of Sale
                </span>
              </h1>
              
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                Transform your business with our intelligent POS system. Process payments, manage inventory, 
                track analytics, and grow your revenue—all from one powerful platform.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link 
                  to="/signup" 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 flex items-center justify-center transform hover:scale-105 shadow-xl"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                <button className="border border-white/30 hover:border-white/50 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-all duration-200 flex items-center justify-center backdrop-blur-sm hover:bg-white/10">
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </button>
              </div>
              
              <div className="flex items-center space-x-6 text-sm text-gray-400 dark:text-muted-foreground">
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                  14-day free trial
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                  No credit card required
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-4 h-4 mr-2 text-green-400" />
                  Cancel anytime
                </div>
              </div>
            </div>
            
            {/* Right Column - Hero Image/Visual */}
            <div className="relative">
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/20">
                {/* Mock POS Interface */}
                <div className="bg-white dark:bg-card rounded-xl shadow-2xl overflow-hidden">
                  {/* Header */}
                  <div className="bg-gray-50 dark:bg-muted/50 px-6 py-4 border-b border-gray-200 dark:border-border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-red-400 rounded-full"></div>
                        <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                        <div className="w-3 h-3 bg-green-400 rounded-full"></div>
                      </div>
                      <div className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Zettaz Cloud POS</div>
                    </div>
                  </div>
                  
                  {/* POS Interface */}
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Today's Sales</span>
                          <TrendingUp className="w-4 h-4 text-green-500" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-foreground">$2,847</div>
                        <div className="text-sm text-green-600">+12.5% from yesterday</div>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-muted-foreground">Transactions</span>
                          <Receipt className="w-4 h-4 text-purple-500" />
                        </div>
                        <div className="text-2xl font-bold text-gray-900 dark:text-foreground">127</div>
                        <div className="text-sm text-purple-600">+8 from last hour</div>
                      </div>
                    </div>
                    
                    {/* Product Grid */}
                    <div className="grid grid-cols-3 gap-3">
                      {['Coffee', 'Sandwich', 'Pastry', 'Tea', 'Salad', 'Juice'].map((item, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-muted/50 p-3 rounded-lg text-center hover:bg-gray-100 dark:bg-muted transition-colors cursor-pointer">
                          <div className="w-8 h-8 bg-blue-100 rounded-full mx-auto mb-2 flex items-center justify-center">
                            <Store className="w-4 h-4 text-blue-600" />
                          </div>
                          <div className="text-xs font-medium text-gray-700 dark:text-foreground">{item}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                
                {/* Floating Elements */}
                <div className="absolute -top-4 -right-4 bg-green-500 text-white p-3 rounded-full shadow-lg">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div className="absolute -bottom-4 -left-4 bg-blue-500 text-white p-3 rounded-full shadow-lg">
                  <Zap className="w-6 h-6" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-foreground mb-4">
              Everything You Need to Run Your Business
            </h2>
            <p className="text-xl text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
              From sales processing to inventory management, our comprehensive POS system 
              has all the tools you need to succeed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1: Sales Processing */}
            <div className="bg-white dark:bg-card p-8 rounded-xl shadow-lg border hover:shadow-xl transition-shadow">
              <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <ShoppingCart className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4">Fast Sales Processing</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                Process transactions quickly with our intuitive interface. Accept multiple payment 
                methods and generate professional receipts instantly.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Multiple payment methods</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Digital receipts</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Tax calculations</li>
              </ul>
            </div>

            {/* Feature 2: Inventory Management */}
            <div className="bg-white dark:bg-card p-8 rounded-xl shadow-lg border hover:shadow-xl transition-shadow">
              <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4">Smart Inventory Control</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                Keep track of your stock levels, set up automatic reorder points, and never 
                run out of your best-selling items again.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Real-time stock tracking</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Low stock alerts</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Product categories</li>
              </ul>
            </div>

            {/* Feature 3: Customer Management */}
            <div className="bg-white dark:bg-card p-8 rounded-xl shadow-lg border hover:shadow-xl transition-shadow">
              <div className="bg-purple-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4">Customer Relationships</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                Build lasting relationships with detailed customer profiles, purchase history, 
                and loyalty program management.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Customer profiles</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Purchase history</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Loyalty programs</li>
              </ul>
            </div>

            {/* Feature 4: Payment Processing */}
            <div className="bg-white dark:bg-card p-8 rounded-xl shadow-lg border hover:shadow-xl transition-shadow">
              <div className="bg-yellow-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <CreditCard className="h-6 w-6 text-yellow-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4">Flexible Payments</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                Accept cash, cards, and digital payments. Split payments, process refunds, 
                and handle complex transactions with ease.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Multiple payment types</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Split payments</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Refund processing</li>
              </ul>
            </div>

            {/* Feature 5: Security */}
            <div className="bg-white dark:bg-card p-8 rounded-xl shadow-lg border hover:shadow-xl transition-shadow">
              <div className="bg-red-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Shield className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4">Enterprise Security</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                Your data is protected with bank-level security, role-based access control, 
                and regular automated backups.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> SSL encryption</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Role-based access</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Automated backups</li>
              </ul>
            </div>

            {/* Feature 6: Performance */}
            <div className="bg-white dark:bg-card p-8 rounded-xl shadow-lg border hover:shadow-xl transition-shadow">
              <div className="bg-indigo-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                <Zap className="h-6 w-6 text-indigo-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-foreground mb-4">Lightning Fast</h3>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                Cloud-based architecture ensures your POS system is always fast, reliable, 
                and accessible from anywhere.
              </p>
              <ul className="space-y-2 text-sm text-gray-600 dark:text-muted-foreground">
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Cloud-based</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> 99.9% uptime</li>
                <li className="flex items-center"><CheckCircle className="h-4 w-4 text-green-500 mr-2" /> Mobile access</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 bg-gray-50 dark:bg-muted/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-foreground mb-4">
              Start Your Free Trial Today
            </h2>
            <p className="text-xl text-gray-600 dark:text-muted-foreground max-w-2xl mx-auto">
              Try all features free for 14 days. No credit card required, no setup fees.
            </p>
          </div>

          <div className="max-w-lg mx-auto">
            <div className="bg-white dark:bg-card rounded-2xl shadow-xl border-2 border-blue-200 p-8">
              <div className="text-center">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-foreground mb-2">Free Trial</h3>
                <div className="text-4xl font-bold text-blue-600 mb-4">
                  $0 <span className="text-lg text-gray-500 dark:text-muted-foreground font-normal">for 14 days</span>
                </div>
                <p className="text-gray-600 dark:text-muted-foreground mb-6">
                  Full access to all features during your trial period
                </p>
                
                <Link 
                  to="/signup" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-lg text-lg font-semibold transition-colors flex items-center justify-center mb-6"
                >
                  Start Free Trial <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
                
                <div className="space-y-3 text-sm text-gray-600 dark:text-muted-foreground">
                  <div className="flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Unlimited products & transactions
                  </div>
                  <div className="flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Up to 5 user accounts
                  </div>
                  <div className="flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    Email support included
                  </div>
                  <div className="flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    No setup or cancellation fees
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 bg-white dark:bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-foreground mb-4">
              Trusted by Businesses Worldwide
            </h2>
            <p className="text-xl text-gray-600 dark:text-muted-foreground">
              See what our customers have to say about Zettaz Cloud POS
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-card p-6 rounded-xl shadow-lg border">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                "Zettaz Cloud POS transformed our retail operations. The inventory management 
                is incredible and the customer support is top-notch."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-blue-600 font-semibold">SM</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-foreground">Sarah Mitchell</div>
                  <div className="text-sm text-gray-500 dark:text-muted-foreground">Boutique Owner</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-card p-6 rounded-xl shadow-lg border">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                "The reporting features give us insights we never had before. We've increased 
                our efficiency by 40% since switching to Zettaz."
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-green-600 font-semibold">MJ</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-foreground">Mike Johnson</div>
                  <div className="text-sm text-gray-500 dark:text-muted-foreground">Restaurant Manager</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-card p-6 rounded-xl shadow-lg border">
              <div className="flex items-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-600 dark:text-muted-foreground mb-4">
                "Easy to set up, intuitive to use, and the mobile app lets me manage my 
                business from anywhere. Highly recommended!"
              </p>
              <div className="flex items-center">
                <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                  <span className="text-purple-600 font-semibold">LC</span>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-foreground">Lisa Chen</div>
                  <div className="text-sm text-gray-500 dark:text-muted-foreground">Coffee Shop Owner</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Business?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Join thousands of businesses already using Zettaz Cloud POS to streamline 
            their operations and boost their profits.
          </p>
          <Link 
            to="/signup" 
            className="bg-white dark:bg-card hover:bg-gray-100 dark:bg-muted text-blue-600 px-8 py-4 rounded-lg text-lg font-semibold transition-colors inline-flex items-center"
          >
            Start Your Free Trial <ArrowRight className="ml-2 h-5 w-5" />
          </Link>
          <p className="text-blue-200 mt-4">
            No credit card required • 14-day free trial • Cancel anytime
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-2xl font-bold text-blue-400 mb-4">Zettaz Cloud POS</h3>
              <p className="text-gray-400 dark:text-muted-foreground">
                The complete point-of-sale solution for modern businesses.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400 dark:text-muted-foreground">
                <li><a href="#" className="hover:text-white">Features</a></li>
                <li><a href="#" className="hover:text-white">Pricing</a></li>
                <li><a href="#" className="hover:text-white">Demo</a></li>
                <li><a href="#" className="hover:text-white">Mobile App</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400 dark:text-muted-foreground">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Training</a></li>
                <li><a href="#" className="hover:text-white">Status</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-gray-400 dark:text-muted-foreground">
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
                <li><a href="#" className="hover:text-white">Careers</a></li>
                <li><a href="#" className="hover:text-white">Privacy</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400 dark:text-muted-foreground">
            <p>&copy; 2025 Zettaz Cloud POS. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
