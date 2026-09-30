'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Upload, FileText, Activity, Settings, Cloud, CreditCard, LogOut, Menu, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { useSubscriptionGuard } from '@/lib/useSubscriptionGuard';

interface LayoutProps {
  children: React.ReactNode;
}

function ProtectedLayoutContent({ children }: LayoutProps) {
  const subscription = useSubscriptionGuard();
  return <SubscriptionGuard sub={subscription}>{children}</SubscriptionGuard>;
}

export default function Layout({ children }: LayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    const handleStorageChange = () => {
      const updatedUserData = localStorage.getItem('user');
      if (updatedUserData) {
        setUser(JSON.parse(updatedUserData));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleMenuItemClick = () => {
    setMenuOpen(false);
  };

  const isActive = (path: string) => pathname === path;

  const handleLogout = async () => {
    localStorage.clear();
    router.push('/login');
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* Sidebar Menu */}
      <div className={`fixed top-0 left-0 h-full w-72 bg-white shadow-2xl z-50 transform transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
            <div className="flex items-center justify-between mb-4">
              {user && (
                <div className="flex items-center space-x-3 flex-1">
                  <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center text-blue-600 font-bold text-xl overflow-hidden">
                    {user.profileImage ? (
                      <img 
                        src={user.profileImage} 
                        alt={user.name} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span>{user.name?.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{user.name}</p>
                    <p className="text-xs text-blue-100">{user.email}</p>
                  </div>
                </div>
              )}
              
              <button 
                onClick={() => setMenuOpen(false)}
                className="p-2 hover:bg-blue-600 rounded-lg transition ml-2"
              >
                <X size={24} className="text-white" />
              </button>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            <Link 
              href="/dashboard" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive('/dashboard')
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={handleMenuItemClick}
            >
              <LayoutDashboard size={20} />
              <span>Dashboard</span>
            </Link>

            <Link 
              href="/upload" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive('/upload')
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={handleMenuItemClick}
            >
              <Upload size={20} />
              <span>Upload</span>
            </Link>

            <Link 
              href="/acc" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive('/acc')
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={handleMenuItemClick}
            >
              <Cloud size={20} />
              <span>ACC Browser</span>
            </Link>

            <Link 
              href="/billing" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive('/billing')
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={handleMenuItemClick}
            >
              <CreditCard size={20} />
              <span>Billing</span>
            </Link>

            <Link 
              href="/settings" 
              className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition ${
                isActive('/settings')
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              onClick={handleMenuItemClick}
            >
              <Settings size={20} />
              <span>Settings</span>
            </Link>
          </nav>

          {/* Logout Button */}
          <div className="p-4 border-t border-gray-200">
            <button
              onClick={() => {
                handleLogout();
                setMenuOpen(false);
              }}
              className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 transition"
            >
              <LogOut size={20} />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="relative z-30 bg-gradient-to-r from-blue-600 via-blue-700 to-blue-800 text-white shadow-2xl">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
                className="relative z-50 p-2 hover:bg-blue-700 rounded-lg transition"
                aria-label="Toggle menu"
              >
                {menuOpen ? (
                  <X size={28} className="text-white" />
                ) : (
                  <Menu size={28} className="text-white" />
                )}
              </button>

              <Link href="/dashboard" className="flex items-center space-x-3 group">
                <div className="p-2 rounded-lg group-hover:scale-110 transition-transform duration-200">
                  <img 
                    src="/images/image.png" 
                    alt="BIM Health Report" 
                    className="w-16 h-16 object-contain"
                    onError={(e) => {
                      // Fallback to icon if image fails to load
                      e.currentTarget.style.display = 'none';
                      e.currentTarget.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <Activity className="w-12 h-12 text-white hidden" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">BIM Health Report</h1>
                  <p className="text-blue-100 text-sm">Professional Model Analysis</p>
                </div>
              </Link>
            </div>

            <div className="flex items-center space-x-2">
              <nav className="hidden lg:flex space-x-2">
                <Link
                  href="/upload"
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-200 ${
                    isActive('/upload')
                      ? 'bg-white text-blue-600 shadow-lg'
                      : 'text-white hover:bg-blue-700'
                  }`}
                >
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Upload</span>
                </Link>
              </nav>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-6 py-8">
        {['/billing', '/dashboard', '/upload'].includes(pathname)
          ? children
          : <ProtectedLayoutContent>{children}</ProtectedLayoutContent>}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <p>© 2026 BIM Health Report. Built with ❤️ for AEC Industry</p>
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4" />
              <span>Powered by Revit API</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
