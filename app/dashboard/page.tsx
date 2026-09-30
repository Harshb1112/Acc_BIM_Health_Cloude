'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import { useSubscriptionGuard } from '@/lib/useSubscriptionGuard';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, 
  PolarRadiusAxis, Radar
} from 'recharts';
import { 
  AlertCircle, FileText, Calendar, Activity, 
  Layers, Box, Zap, Building2, Eye, AlertTriangle, CheckCircle,
  BarChart3, ArrowRight, Trash2
} from 'lucide-react';

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316'];

export default function DashboardPage() {
  const router = useRouter();
  const sub    = useSubscriptionGuard();   // ← subscription check
  const [user, setUser] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    // Check for welcome message
    const welcome = localStorage.getItem('showWelcome');
    if (welcome === 'true') {
      setShowWelcome(true);
      localStorage.removeItem('showWelcome');
      setTimeout(() => setShowWelcome(false), 5000);
    }

    const userData = localStorage.getItem('user');
    if (userData) setUser(JSON.parse(userData));

    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const response = await fetch('/api/reports', {
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
      });
      const data = await response.json();
      
      if (data.success) {
        setReports(data.reports || []);
        console.log('📊 Loaded reports:', data.reports.length);
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report? This action cannot be undone.')) {
      return;
    }

    setDeleting(reportId);
    try {
      const response = await fetch(`/api/reports?id=${reportId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('accessToken') || ''}` },
      });

      const data = await response.json();
      if (data.success) {
        setReports(reports.filter(r => r.id !== reportId));
      } else {
        alert('Failed to delete report');
      }
    } catch (error) {
      console.error('Error deleting report:', error);
      alert('Failed to delete report');
    } finally {
      setDeleting(null);
    }
  };

  const latestReport = reports[0];
  const totalElements = reports.reduce((sum, r) => sum + (r.statistics?.totalElements || 0), 0);
  const totalIssues = reports.reduce((sum, r) => sum + (r.issues?.length || 0), 0);
  
  // Calculate totals - using correct camelCase field names from JSON
  const totalWorksets = reports.reduce((sum, r) => sum + (r.worksetCount || r.WorksetCount || 0), 0);
  const totalDesignOptions = reports.reduce((sum, r) => sum + (r.designOptionsCount || r.DesignOptionsCount || 0), 0);
  const totalRevitLinks = reports.reduce((sum, r) => sum + (r.linkedRevitFiles || r.LinkedRevitFiles || 0), 0);
  const totalCADLinks = reports.reduce((sum, r) => sum + (r.linkedCADFiles || r.LinkedCADFiles || 0), 0);

  // Chart data
  const elementData = latestReport ? [
    { name: 'Walls', value: latestReport.statistics?.walls || 0, color: '#0ea5e9' },
    { name: 'Floors', value: latestReport.statistics?.floors || 0, color: '#10b981' },
    { name: 'Ceilings', value: latestReport.statistics?.ceilings || 0, color: '#f59e0b' },
    { name: 'Doors', value: latestReport.statistics?.doors || 0, color: '#ef4444' },
    { name: 'Windows', value: latestReport.statistics?.windows || 0, color: '#8b5cf6' },
    { name: 'Columns', value: latestReport.statistics?.columns || 0, color: '#06b6d4' },
    { name: 'Beams', value: latestReport.statistics?.beams || 0, color: '#f97316' },
    { name: 'Rooms', value: latestReport.statistics?.rooms || 0, color: '#ec4899' }
  ].filter(item => item.value > 0) : [];

  const qualityData = latestReport ? [
    { metric: 'Completeness', value: latestReport.quality?.modelCompleteness || 0 },
    { metric: 'Accuracy', value: latestReport.quality?.geometricAccuracy || 0 },
    { metric: 'Richness', value: latestReport.quality?.informationRichness || 0 },
    { metric: 'Performance', value: latestReport.performance?.performanceRating === 'Excellent' ? 95 : latestReport.performance?.performanceRating === 'Good' ? 80 : 65 },
  ].filter(item => item.value > 0) : [];

  if (loading) {
    return (
      <Layout>
        <SubscriptionGuard sub={sub}>
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="spinner w-16 h-16 mx-auto mb-4"></div>
              <p className="text-lg text-gray-600">Loading dashboard...</p>
            </div>
          </div>
        </SubscriptionGuard>
      </Layout>
    );
  }

  if (reports.length === 0) {
    return (
      <Layout>
        <SubscriptionGuard sub={sub}>
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="text-center p-12 bg-white rounded-2xl shadow-2xl max-w-md animate-bounce-in">
              <AlertCircle size={80} className="text-gray-400 mx-auto mb-6" />
              <h2 className="text-3xl font-bold text-gray-900 mb-4">No Reports Yet</h2>
              <p className="text-gray-600 mb-8">Upload your first BIM Health Report to unlock powerful analytics</p>
              <Link href="/upload" className="btn-primary inline-flex items-center">
                <FileText className="mr-2" size={20} />
                Upload Report
              </Link>
            </div>
          </div>
        </SubscriptionGuard>
      </Layout>
    );
  }

  return (
    <Layout>
      <SubscriptionGuard sub={sub}>
      <div className="animate-fade-in">
        {/* Welcome Modal */}
        {showWelcome && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full animate-bounce-in">
              <div className="text-center">
                <div className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome, {user?.name}!</h2>
                <p className="text-gray-600 mb-6">🎉 Your dashboard is ready!</p>
                <button
                  onClick={() => setShowWelcome(false)}
                  className="btn-primary"
                >
                  Get Started
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src="/images/image.png" 
                alt="BIM Health" 
                className="w-16 h-16 object-contain"
              />
              <div>
                <h1 className="text-4xl font-bold gradient-text mb-2">
                  BIM Health Dashboard
                </h1>
                <p className="text-lg text-gray-600">Comprehensive analysis of your BIM models</p>
              </div>
            </div>
            <Link href="/upload" className="btn-primary flex items-center space-x-2">
              <FileText size={20} />
              <span>Upload New</span>
            </Link>
          </div>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="stat-card bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium mb-1">Total Reports</p>
                <p className="text-4xl font-bold">{reports.length}</p>
                <p className="text-blue-100 text-xs mt-2">All time</p>
              </div>
              <BarChart3 size={48} className="text-blue-200 opacity-50" />
            </div>
          </div>

          <div className="stat-card bg-gradient-to-br from-purple-500 to-purple-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium mb-1">Total Elements</p>
                <p className="text-4xl font-bold">{totalElements.toLocaleString()}</p>
                <p className="text-purple-100 text-xs mt-2">Across all models</p>
              </div>
              <Box size={48} className="text-purple-200 opacity-50" />
            </div>
          </div>

          <div className="stat-card bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-orange-100 text-sm font-medium mb-1">Total Issues</p>
                <p className="text-4xl font-bold">{totalIssues}</p>
                <p className="text-orange-100 text-xs mt-2">Needs attention</p>
              </div>
              <AlertTriangle size={48} className="text-orange-200 opacity-50" />
            </div>
          </div>

          <div className="stat-card bg-gradient-to-br from-green-500 to-green-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium mb-1">Latest Grade</p>
                <p className="text-4xl font-bold">{latestReport?.overallGrade || 'N/A'}</p>
                <p className="text-green-100 text-xs mt-2">Model quality</p>
              </div>
              <CheckCircle size={48} className="text-green-200 opacity-50" />
            </div>
          </div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Architectural Elements */}
          {elementData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <Building2 className="mr-2 text-blue-600" size={24} />
                  Architectural Elements
                </h3>
                <span className="text-sm text-gray-500">{elementData.reduce((sum, item) => sum + item.value, 0).toLocaleString()} total</span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={elementData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} style={{ fontSize: '12px' }} />
                  <YAxis style={{ fontSize: '12px' }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                    {elementData.map((item, index) => (
                      <Cell key={`cell-${index}`} fill={item.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Quality Metrics */}
          {qualityData.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                  <Activity className="mr-2 text-green-600" size={24} />
                  Quality Metrics
                </h3>
                <span className="text-sm text-gray-500">Overall health</span>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <RadarChart data={qualityData}>
                  <PolarGrid stroke="#e5e7eb" />
                  <PolarAngleAxis dataKey="metric" style={{ fontSize: '12px' }} />
                  <PolarRadiusAxis domain={[0, 100]} style={{ fontSize: '10px' }} />
                  <Radar dataKey="value" stroke="#0ea5e9" fill="#0ea5e9" fillOpacity={0.6} />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Project Info Cards */}
        {reports.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="card text-center bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="text-3xl font-bold text-blue-600 mb-2">{totalWorksets}</div>
              <div className="text-sm text-blue-700 font-medium">Worksets</div>
            </div>
            <div className="card text-center bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="text-3xl font-bold text-green-600 mb-2">{totalDesignOptions}</div>
              <div className="text-sm text-green-700 font-medium">Design Options</div>
            </div>
            <div className="card text-center bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="text-3xl font-bold text-orange-600 mb-2">{totalRevitLinks}</div>
              <div className="text-sm text-orange-700 font-medium">Revit Links</div>
            </div>
            <div className="card text-center bg-gradient-to-br from-red-50 to-red-100 border-red-200">
              <div className="text-3xl font-bold text-red-600 mb-2">{totalCADLinks}</div>
              <div className="text-sm text-red-700 font-medium">CAD Links</div>
            </div>
          </div>
        )}

        {/* Recent Reports Table */}
        <div className="card">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-900 flex items-center">
              <FileText className="mr-2 text-blue-600" size={24} />
              Recent Reports
            </h3>
            <span className="text-sm text-gray-500">{reports.length} total</span>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Project</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Elements</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Issues</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reports.slice(0, 10).map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{report.projectName}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        report.overallGrade === 'A' ? 'bg-green-100 text-green-800' :
                        report.overallGrade === 'B' ? 'bg-blue-100 text-blue-800' :
                        report.overallGrade === 'C' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {report.overallGrade || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(report.totalElements || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        (report.issues?.length || 0) === 0 ? 'bg-green-100 text-green-800' :
                        (report.issues?.length || 0) < 5 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {report.issues?.length || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <Calendar size={14} className="mr-2" />
                        {new Date(report.uploadedAt).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center space-x-2">
                        <Link 
                          href={`/report/${report.id}`} 
                          className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          View
                          <ArrowRight size={14} className="ml-1" />
                        </Link>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          disabled={deleting === report.id}
                          className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {deleting === report.id ? (
                            <div className="spinner w-3 h-3 border-2"></div>
                          ) : (
                            <Trash2 size={14} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </SubscriptionGuard>
    </Layout>
  );
}
