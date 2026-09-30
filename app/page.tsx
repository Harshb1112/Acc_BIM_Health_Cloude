'use client';

import { useRouter } from 'next/navigation';
import { Activity, FileCheck, AlertTriangle, BarChart3, ArrowRight, Sparkles, Zap, Shield, TrendingUp } from 'lucide-react';

export default function Home() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-40 right-20 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between py-6 animate-fade-in">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
              <Activity className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">BIM Health Report</h1>
              <p className="text-xs text-blue-200">Professional Analysis</p>
            </div>
          </div>
        </header>

        {/* Hero Section */}
        <div className="text-center py-20 space-y-8 animate-fade-in">
          <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full border border-white/20">
            <Sparkles className="w-4 h-4 text-yellow-400" />
            <span className="text-sm text-white font-medium">Professional BIM Analysis Platform</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight">
            <span className="bg-gradient-to-r from-white via-blue-100 to-purple-100 bg-clip-text text-transparent">
              Transform Your
            </span>
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
              BIM Workflow
            </span>
          </h1>

          <p className="text-xl text-blue-100 max-w-2xl mx-auto leading-relaxed">
            Advanced Revit model analysis with real-time insights, comprehensive health reports, and intelligent optimization recommendations
          </p>

          <div className="flex flex-wrap justify-center gap-4 pt-4">
            <button
              onClick={() => router.push('/register')}
              className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-semibold shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-105 flex items-center space-x-2"
            >
              <span>Start Free Trial</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={() => router.push('/login')}
              className="px-8 py-4 bg-white/10 backdrop-blur-md text-white rounded-xl font-semibold border border-white/20 hover:bg-white/20 transition-all"
            >
              Sign In
            </button>
          </div>

          <div className="flex justify-center gap-12 pt-8 text-center">
            <div>
              <div className="text-3xl font-bold text-white">99.9%</div>
              <div className="text-sm text-blue-200">Accuracy</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">10x</div>
              <div className="text-sm text-blue-200">Faster</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-white">24/7</div>
              <div className="text-sm text-blue-200">Available</div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 py-16">
          <div className="group bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 rounded-xl p-6 transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <FileCheck className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Model Analysis</h3>
            <p className="text-sm text-blue-200">Comprehensive analysis with detailed statistics and insights</p>
          </div>

          <div className="group bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 rounded-xl p-6 transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <AlertTriangle className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Issue Detection</h3>
            <p className="text-sm text-blue-200">Identify and resolve warnings before they become problems</p>
          </div>

          <div className="group bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 rounded-xl p-6 transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <BarChart3 className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Performance Metrics</h3>
            <p className="text-sm text-blue-200">Track and optimize your model&apos;s performance in real-time</p>
          </div>

          <div className="group bg-white/5 backdrop-blur-md border border-white/10 hover:bg-white/10 rounded-xl p-6 transition-all">
            <div className="w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
              <Zap className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Instant Reports</h3>
            <p className="text-sm text-blue-200">Generate comprehensive health reports in seconds</p>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="grid md:grid-cols-3 gap-8 py-16 text-center">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-bold text-white">Secure & Private</h4>
            <p className="text-blue-200 text-sm">Enterprise-grade security with end-to-end encryption</p>
          </div>

          <div className="space-y-3">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-bold text-white">Continuous Updates</h4>
            <p className="text-blue-200 text-sm">Regular improvements and cutting-edge features</p>
          </div>

          <div className="space-y-3">
            <div className="w-16 h-16 bg-gradient-to-br from-pink-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto shadow-lg">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h4 className="text-lg font-bold text-white">24/7 Processing</h4>
            <p className="text-blue-200 text-sm">Always available whenever you need analysis</p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center py-16 space-y-6">
          <h2 className="text-4xl font-bold text-white">Ready to Get Started?</h2>
          <p className="text-xl text-blue-200">Join thousands of professionals using BIM Health Report</p>
          <button
            onClick={() => router.push('/register')}
            className="px-10 py-5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-lg font-semibold shadow-2xl hover:shadow-blue-500/50 transition-all hover:scale-105"
          >
            Start Your Free Trial
          </button>
          <p className="text-blue-300 text-sm">No credit card required • 30 days free trial • Cancel anytime</p>
        </div>
      </div>
    </div>
  );
}
