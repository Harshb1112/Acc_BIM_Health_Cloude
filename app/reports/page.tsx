'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Layout from '@/components/Layout';
import { 
  FileText, Trash2, Eye, Calendar, BarChart3, 
  AlertTriangle, CheckCircle, Download, Search
} from 'lucide-react';

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
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
      }
    } catch (error) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this report?')) {
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

  const filteredReports = reports.filter(report =>
    report.projectName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      'A': 'text-green-600 bg-green-100',
      'B': 'text-blue-600 bg-blue-100',
      'C': 'text-yellow-600 bg-yellow-100',
      'D': 'text-orange-600 bg-orange-100',
      'F': 'text-red-600 bg-red-100',
    };
    return colors[grade] || 'text-gray-600 bg-gray-100';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="spinner w-16 h-16 mx-auto mb-4"></div>
            <p className="text-lg text-gray-600">Loading reports...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold gradient-text mb-2">📊 All Reports</h1>
            <p className="text-gray-600 text-lg">
              {reports.length} {reports.length === 1 ? 'report' : 'reports'} available
            </p>
          </div>
          <Link href="/upload" className="btn-primary flex items-center space-x-2">
            <FileText className="w-5 h-5" />
            <span>Upload New</span>
          </Link>
        </div>

        {/* Search Bar */}
        <div className="glass-effect rounded-2xl p-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search reports by project name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
            />
          </div>
        </div>

        {/* Reports Grid */}
        {filteredReports.length === 0 ? (
          <div className="text-center py-16 card">
            <FileText className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {searchQuery ? 'No reports found' : 'No reports yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery 
                ? 'Try a different search term' 
                : 'Upload your first BIM Health Report to get started'}
            </p>
            {!searchQuery && (
              <Link href="/upload" className="btn-primary inline-flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Upload Report</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredReports.map((report, index) => (
              <div
                key={report.id}
                className="card hover:shadow-2xl transform hover:-translate-y-2 transition-all duration-300"
                style={{animationDelay: `${index * 0.1}s`}}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2 line-clamp-2">
                      {report.projectName}
                    </h3>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Calendar className="w-4 h-4" />
                      <span>{new Date(report.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full font-bold text-lg ${getGradeColor(report.overallGrade)}`}>
                    {report.overallGrade}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-blue-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <BarChart3 className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-blue-600 font-medium">Elements</span>
                    </div>
                    <p className="text-lg font-bold text-blue-900">
                      {report.totalElements?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="bg-orange-50 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-1">
                      <AlertTriangle className="w-4 h-4 text-orange-600" />
                      <span className="text-xs text-orange-600 font-medium">Issues</span>
                    </div>
                    <p className="text-lg font-bold text-orange-900">
                      {report.issues?.length || 0}
                    </p>
                  </div>
                </div>

                {/* Additional Info */}
                <div className="flex items-center justify-between text-sm text-gray-600 mb-4 pb-4 border-b border-gray-100">
                  <span className="flex items-center space-x-1">
                    <CheckCircle className="w-4 h-4" />
                    <span>{report.source || 'Upload'}</span>
                  </span>
                  <span>{report.fileSize?.toFixed(1) || 0} MB</span>
                </div>

                {/* Actions */}
                <div className="flex items-center space-x-2">
                  <Link
                    href={`/report/${report.id}`}
                    className="flex-1 btn-primary text-center py-2 text-sm"
                  >
                    <Eye className="w-4 h-4 inline mr-2" />
                    View Report
                  </Link>
                  <button
                    onClick={() => deleteReport(report.id)}
                    disabled={deleting === report.id}
                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                  >
                    {deleting === report.id ? (
                      <div className="spinner w-4 h-4 border-2"></div>
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
