import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  CheckCircle, 
  Star, 
  Users, 
  TrendingUp, 
  Shield,
  Zap,
  Globe,
  Award,
  Play,
  ChevronRight,
  Mail,
  Phone,
  MapPin,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
  Youtube
} from 'lucide-react';

const LandingPageUnique: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
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

      {/* Hero Section - Diagonal Design */}
      <section className="relative z-10 pt-20 pb-32">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className={`transform transition-all duration-1000 ${isVisible ? 'translate-x-0 opacity-100' : '-translate-x-20 opacity-0'}`}>
              <div className="inline-flex items-center bg-white/10 backdrop-blur-sm rounded-full px-4 py-2 mb-6">
                <Zap className="w-4 h-4 text-yellow-400 mr-2" />
                <span className="text-white text-sm">Revolutionary POS Technology</span>
              </div>
              
              <h1 className="text-5xl lg:text-7xl font-bold text-white mb-6 leading-tight">
                Transform Your
                <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  Business Today
                </span>
              </h1>
              
              <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                Experience the future of point-of-sale with our cloud-native platform. 
                Streamline operations, boost sales, and delight customers with cutting-edge technology.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <Link 
                  to="/signup"
                  className="group bg-gradient-to-r from-purple-500 to-pink-500 text-white px-8 py-4 rounded-2xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105 flex items-center justify-center"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </Link>
                
                <button className="group bg-white/10 backdrop-blur-sm text-white px-8 py-4 rounded-2xl font-semibold hover:bg-white/20 transition-all flex items-center justify-center">
                  <Play className="mr-2 w-5 h-5" />
                  Watch Demo
                </button>
              </div>
              
              <div className="flex items-center space-x-6 text-gray-300">
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                  <span>No Setup Fees</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                  <span>24/7 Support</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-2" />
                  <span>Cancel Anytime</span>
                </div>
              </div>
            </div>

            {/* Right Content - Floating POS Interface */}
            <div className={`relative transform transition-all duration-1000 delay-300 ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-20 opacity-0'}`}>
              <div className="relative">
                {/* Main POS Interface */}
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-semibold">Today's Sales</h3>
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div className="text-3xl font-bold text-white">$12,847</div>
                    <div className="text-purple-100">+23% from yesterday</div>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center mr-3">
                          <CheckCircle className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-white font-medium">Order #1247</div>
                          <div className="text-gray-400 dark:text-muted-foreground text-sm">Completed</div>
                        </div>
                      </div>
                      <div className="text-white font-semibold">$89.50</div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center mr-3">
                          <Users className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <div className="text-white font-medium">New Customer</div>
                          <div className="text-gray-400 dark:text-muted-foreground text-sm">Sarah Johnson</div>
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-gray-400 dark:text-muted-foreground" />
                    </div>
                  </div>
                </div>

                {/* Floating Stats Cards */}
                <div className="absolute -top-6 -left-6 bg-gradient-to-r from-green-400 to-blue-500 rounded-2xl p-4 shadow-xl transform -rotate-12 hover:rotate-0 transition-transform duration-500">
                  <div className="text-white text-sm font-medium">Active Users</div>
                  <div className="text-white text-2xl font-bold">1,247</div>
                </div>
                
                <div className="absolute -bottom-6 -right-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl p-4 shadow-xl transform rotate-12 hover:rotate-0 transition-transform duration-500">
                  <div className="text-white text-sm font-medium">Revenue</div>
                  <div className="text-white text-2xl font-bold">+34%</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section - Floating Cards with Unique Layout */}
      <section id="pricing" className="relative py-32 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">
              Choose Your
              <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Perfect Plan
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Flexible pricing that grows with your business. Start free, upgrade anytime.
            </p>
          </div>

          {/* Floating Pricing Cards */}
          <div className="relative">
            {/* Background Decoration */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-3xl transform rotate-1"></div>
            
            <div className="relative grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Starter Plan */}
              <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-4 hover:rotate-1">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Starter</h3>
                  <p className="text-gray-300 mb-6">Perfect for small businesses</p>
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-white">$29</span>
                    <span className="text-gray-300">/month</span>
                  </div>
                  <Link 
                    to="/signup" 
                    className="block w-full bg-gradient-to-r from-gray-600 to-gray-700 text-white py-3 rounded-2xl font-semibold hover:from-gray-500 hover:to-gray-600 transition-all"
                  >
                    Start Free Trial
                  </Link>
                </div>
                
                <ul className="space-y-4 text-gray-300">
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Up to 1,000 transactions/month
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Basic inventory management
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Email support
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Mobile app access
                  </li>
                </ul>
              </div>

              {/* Professional Plan - Featured */}
              <div className="relative bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-3xl p-8 border-2 border-purple-500/50 transform hover:-translate-y-4 hover:-rotate-1 transition-all duration-500 scale-105">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-2 rounded-full text-sm font-semibold">
                    Most Popular
                  </span>
                </div>
                
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Professional</h3>
                  <p className="text-gray-300 mb-6">For growing businesses</p>
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-white">$79</span>
                    <span className="text-gray-300">/month</span>
                  </div>
                  <Link 
                    to="/signup" 
                    className="block w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 rounded-2xl font-semibold hover:from-purple-600 hover:to-pink-600 transition-all transform hover:scale-105"
                  >
                    Start Free Trial
                  </Link>
                </div>
                
                <ul className="space-y-4 text-gray-300">
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Unlimited transactions
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Advanced inventory & analytics
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Priority support
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Multi-location support
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Custom integrations
                  </li>
                </ul>
              </div>

              {/* Enterprise Plan */}
              <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-4 hover:-rotate-1">
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
                  <p className="text-gray-300 mb-6">For large organizations</p>
                  <div className="mb-6">
                    <span className="text-5xl font-bold text-white">$199</span>
                    <span className="text-gray-300">/month</span>
                  </div>
                  <Link 
                    to="/signup" 
                    className="block w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white py-3 rounded-2xl font-semibold hover:from-yellow-600 hover:to-orange-600 transition-all"
                  >
                    Contact Sales
                  </Link>
                </div>
                
                <ul className="space-y-4 text-gray-300">
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Everything in Professional
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Dedicated account manager
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    24/7 phone support
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    Custom development
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                    SLA guarantee
                  </li>
                </ul>
              </div>
        </div>

        <div className="relative z-10 pt-32 pb-12">
          <div className="max-w-7xl mx-auto px-6">
            {/* Main Footer Content */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 mb-16">
              {/* Company Info */}
              <div className="lg:col-span-2">
                <div className="flex items-center space-x-3 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
                    <span className="text-white font-bold text-xl">Z</span>
                  </div>
                  <span className="text-white text-3xl font-bold">Zettaz Cloud</span>
              <span className="block bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Thousands of Businesses
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              See what our customers are saying about their experience with Zettaz Cloud
            </p>
          </div>

          {/* Testimonials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            {/* Testimonial 1 */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-2 hover:rotate-1">
              <div className="flex items-center mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                "Zettaz Cloud transformed our restaurant operations. The speed and reliability are incredible, and our staff loves how intuitive it is."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold">SM</span>
                </div>
                <div>
                  <div className="text-white font-semibold">Sarah Martinez</div>
                  <div className="text-gray-400 dark:text-muted-foreground">Owner, Bella Vista Restaurant</div>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-2 hover:-rotate-1">
              <div className="flex items-center mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                "The analytics and reporting features have given us insights we never had before. Our sales have increased by 40% since switching."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold">MJ</span>
                </div>
                <div>
                  <div className="text-white font-semibold">Michael Johnson</div>
                  <div className="text-gray-400 dark:text-muted-foreground">CEO, TechMart Electronics</div>
                </div>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-2 hover:rotate-1">
              <div className="flex items-center mb-6">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <p className="text-gray-300 text-lg mb-6 leading-relaxed">
                "Customer support is outstanding. They helped us migrate from our old system seamlessly, and we were up and running in no time."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-bold">EP</span>
                </div>
                <div>
                  <div className="text-white font-semibold">Emily Parker</div>
                  <div className="text-gray-400 dark:text-muted-foreground">Manager, Urban Boutique</div>
                </div>
              </div>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-3xl font-bold text-white mb-2">10,000+</div>
              <div className="text-gray-300">Active Businesses</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-3xl font-bold text-white mb-2">99.9%</div>
              <div className="text-gray-300">Uptime Guarantee</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-3xl font-bold text-white mb-2">24/7</div>
              <div className="text-gray-300">Expert Support</div>
            </div>
            <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10">
              <div className="text-3xl font-bold text-white mb-2">4.9/5</div>
              <div className="text-gray-300">Customer Rating</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - Asymmetrical Floating Cards */}
      <section id="features" className="relative py-32 bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-5xl font-bold text-white mb-6">
              Why Choose 
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Zettaz Cloud?
              </span>
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Discover the features that make us the preferred choice for modern businesses
            </p>
          </div>

          {/* Asymmetrical Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
            {/* Large Feature Card */}
            <div className="lg:col-span-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-2">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center mr-4">
                  <Zap className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">Lightning Fast Performance</h3>
                  <p className="text-gray-300">Process transactions in milliseconds</p>
                </div>
              </div>
              <p className="text-gray-300 text-lg leading-relaxed mb-6">
                Our cloud-native architecture ensures your POS system runs at peak performance, 
                handling thousands of transactions without missing a beat. Experience the speed 
                that keeps your customers happy and your business moving.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="bg-white/10 text-white px-4 py-2 rounded-full text-sm">Real-time Sync</span>
                <span className="bg-white/10 text-white px-4 py-2 rounded-full text-sm">99.9% Uptime</span>
                <span className="bg-white/10 text-white px-4 py-2 rounded-full text-sm">Auto-scaling</span>
              </div>
            </div>

            {/* Tall Feature Card */}
            <div className="bg-gradient-to-br from-blue-500/20 to-cyan-500/20 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-2xl flex items-center justify-center mb-6">
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-4">Bank-Level Security</h3>
              <p className="text-gray-300 mb-6">
                Your data is protected with enterprise-grade encryption and security protocols.
              </p>
              <ul className="space-y-3 text-gray-300">
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                  End-to-end encryption
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                  PCI DSS compliant
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                  Regular security audits
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-5 h-5 text-green-400 mr-3" />
                  24/7 monitoring
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Row - Three Equal Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-r from-green-500 to-emerald-500 rounded-2xl flex items-center justify-center mb-6">
                <Globe className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Multi-Location Support</h3>
              <p className="text-gray-300">
                Manage multiple stores from a single dashboard with centralized reporting and inventory.
              </p>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl flex items-center justify-center mb-6">
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Advanced Analytics</h3>
              <p className="text-gray-300">
                Get deep insights into your business with real-time analytics and customizable reports.
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-500/20 to-pink-500/20 backdrop-blur-lg rounded-3xl p-8 border border-white/10 hover:border-white/20 transition-all duration-500 transform hover:-translate-y-2">
              <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-pink-500 rounded-2xl flex items-center justify-center mb-6">
                <Award className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-white mb-4">Award-Winning Support</h3>
              <p className="text-gray-300">
                Our expert support team is available 24/7 to help you succeed with personalized assistance.
              </p>
            </div>
          </div>
        </div>
      </section>
