import React, { useState, useEffect } from 'react';
import { Activity, Download, Filter, Eye, X, Clock, Box, FileText, Users, DollarSign, CheckCircle } from 'lucide-react';
import { api } from '../lib/api';
import CustomSelect from '../components/ui/CustomSelect';

interface ActivityLogEntry {
  id: string;
  userId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: {
    name: string;
    email: string;
    role: string;
  }
}

interface ActivitySummary {
  totalActivities: number;
  actionCounts: Record<string, number>;
  entityCounts: Record<string, number>;
  dailyCounts: Record<string, number>;
  period: string;
}

const ActivityLog: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [summary, setSummary] = useState<ActivitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLog, setSelectedLog] = useState<ActivityLogEntry | null>(null);
  const [filters, setFilters] = useState({
    userId: '',
    entityType: '',
    action: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 50
  });

  const fetchLogs = async () => {
    try {
      const params = new URLSearchParams();

      Object.entries(filters).forEach(([key, value]) => {
        if (value) params.append(key, value.toString());
      });

      const [logsRes, summaryRes] = await Promise.all([
        api.get(`/activity?${params}`),
        api.get('/activity/summary')
      ]);

      setLogs(logsRes.data.logs);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Failed to fetch activity logs', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [filters]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value && key !== 'page' && key !== 'limit') params.append(key, value.toString());
      });

      const response = await api.get(`/activity/export?${params}`, {
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'galimotors-audit-log.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Export failed', error);
    }
  };

  // Raw action codes (CREATE_CAR, APPROVE_SOLD...) read as machine noise —
  // every row now states plainly what happened and to which record.
  const ACTION_LABELS: Record<string, string> = {
    CREATE_CAR: 'Added a car',
    UPDATE_CAR: 'Edited a car',
    DELETE_CAR: 'Moved a car to Trash',
    RESTORE_CAR: 'Restored a car from Trash',
    APPROVE_CAR: 'Approved a listing',
    REJECT_CAR: 'Rejected a listing',
    REQUEST_SOLD: 'Requested sold approval',
    CANCEL_SOLD_REQUEST: 'Withdrew a sold request',
    APPROVE_SOLD: 'Confirmed a sale',
    REJECT_SOLD: 'Declined a sold request',
    MARK_SOLD: 'Marked a car sold',
    BULK_UPDATE_STATUS: 'Changed status in bulk',
    CREATE_USER: 'Created a user account',
    UPDATE_USER: 'Edited a user account',
    DELETE_USER: 'Deleted a user account',
    UPDATE_PROFILE: 'Updated their profile',
    VIEW_USERS: 'Opened the users list',
    LOGIN: 'Signed in',
  };

  const actionLabel = (action: string) =>
    ACTION_LABELS[action] ||
    action.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase());

  const actionDetail = (log: ActivityLogEntry): string => {
    const v = log.newValue;
    if (!v || typeof v !== 'object') return '';
    if (v.count && v.status) return `${v.count} car${v.count > 1 ? 's' : ''} → ${v.status}`;
    const parts = [v.title || v.name || ''];
    if (v.email && !parts[0]) parts[0] = v.email;
    if (v.role) parts.push(String(v.role).replace(/_/g, ' '));
    if (v.statusChange) parts.push(v.statusChange);
    if (v.reason) parts.push(`reason: ${v.reason}`);
    return parts.filter(Boolean).join(' · ');
  };

  const actionChip = (action: string) => {
    if (/DELETE|REJECT/.test(action)) return 'bg-coral/10 text-coral border-coral/20';
    if (/RESTORE|APPROVE|CREATE/.test(action)) return 'bg-success/10 text-success border-success/20';
    if (/SOLD/.test(action)) return 'bg-info-light text-info border-info/20';
    if (/LOGIN|SECURITY/.test(action)) return 'bg-gold-light text-gold-dark border-gold/20';
    return 'bg-gray-100 text-gray-600 border-gray-200';
  };

  const getEntityIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'car': return <Box size={14} />;
      case 'lead': return <FileText size={14} />;
      case 'user': return <Users size={14} />;
      case 'commission': return <DollarSign size={14} />;
      default: return <Activity size={14} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-medium text-gray-400 animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin"></div>
          Analyzing audit logs...
        </div>
      </div>
    );
  }

  const actionOptions = [
    { id: '', name: 'All Actions' },
    { id: 'CREATE', name: 'Created' },
    { id: 'UPDATE', name: 'Edited' },
    { id: 'DELETE', name: 'Deleted / Trashed' },
    { id: 'RESTORE', name: 'Restored' },
    { id: 'APPROVE', name: 'Approved' },
    { id: 'SOLD', name: 'Sales & sold requests' },
    { id: 'LOGIN', name: 'Sign-ins' },
  ];

  const entityOptions = [
    { id: '', name: 'All Entities' },
    { id: 'Car', name: 'Vehicles' },
    { id: 'Lead', name: 'Leads / CRM' },
    { id: 'User', name: 'Admin Users' },
    { id: 'Commission', name: 'Commissions' },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-2">
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">System Activity Log</h1>
          <p className="text-sm text-gray-500 font-medium">Monitor dashboard changes and administrative actions</p>
        </div>
        <button 
          onClick={handleExport}
          className="btn-outline flex items-center gap-2 text-sm font-bold"
        >
          <Download size={16} />
          Export to CSV
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-widget p-6 border-none shadow-sm flex items-center justify-between group">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500">Total System Events</span>
            <span className="text-2xl font-bold text-gray-900 leading-none">{summary?.totalActivities || 0}</span>
          </div>
          <div className="w-12 h-12 bg-pharmacore-gray text-dark rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
            <Activity size={24} />
          </div>
        </div>
        <div className="card-widget p-6 border-none shadow-sm flex items-center justify-between group">
          <div className="flex flex-col gap-1">
             <span className="text-xs font-semibold text-gray-500">Vehicle Updates</span>
             <span className="text-2xl font-bold text-gray-900 leading-none">{summary?.entityCounts['Car'] || 0}</span>
          </div>
          <div className="w-12 h-12 bg-coral/10 text-coral rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
            <Box size={24} />
          </div>
        </div>
        <div className="card-widget p-6 border-none shadow-sm flex items-center justify-between group">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500">CRM Actions</span>
            <span className="text-2xl font-bold text-gray-900 leading-none">{summary?.entityCounts['Lead'] || 0}</span>
          </div>
          <div className="w-12 h-12 bg-coral/10 text-coral rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
            <FileText size={24} />
          </div>
        </div>
        <div className="card-widget p-6 border-none shadow-sm flex items-center justify-between group">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-dark">Audit Status</span>
            <span className="text-2xl font-bold text-gray-900 leading-none">Secure</span>
          </div>
          <div className="w-12 h-12 bg-pharmacore-gray text-dark rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
            <CheckCircle size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card-widget overflow-hidden p-0 shadow-sm border border-gray-100 flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
              <Filter size={16} className="text-gray-500" /> 
              <h3 className="text-sm font-bold text-gray-900">Activity Filters</h3>
            </div>
            
            <div className="p-6 space-y-5 bg-white flex-1">
               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Action Type</label>
                  <CustomSelect 
                    value={filters.action}
                    onChange={(val) => setFilters({...filters, action: val})}
                    options={actionOptions}
                    placeholder="All Actions"
                  />
               </div>

               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Target Entity</label>
                  <CustomSelect 
                    value={filters.entityType}
                    onChange={(val) => setFilters({...filters, entityType: val})}
                    options={entityOptions}
                    placeholder="All Entities"
                  />
               </div>

               <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Date Range</label>
                  <div className="flex flex-col gap-2 bg-gray-50 p-2 rounded-xl border border-gray-100">
                    <input 
                      type="date"
                      value={filters.startDate}
                      onChange={(e) => setFilters({...filters, startDate: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-dark outline-none transition-all"
                    />
                    <div className="text-center text-xs font-semibold text-gray-400">TO</div>
                    <input 
                      type="date"
                      value={filters.endDate}
                      onChange={(e) => setFilters({...filters, endDate: e.target.value})}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:border-dark outline-none transition-all"
                    />
                  </div>
               </div>

               <div className="pt-2">
                 <button 
                    onClick={() => setFilters({userId: '', entityType: '', action: '', startDate: '', endDate: '', page: 1, limit: 50})}
                    className="w-full py-2.5 text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-xl transition-all"
                  >
                    Reset Filters
                  </button>
               </div>
            </div>
          </div>
        </div>

        {/* Log Content */}
        <div className="lg:col-span-3 space-y-4">
           <div className="card-widget p-0 overflow-hidden shadow-sm border border-gray-100 bg-white">
             <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
               <h3 className="text-sm font-bold text-gray-900">Activity Log</h3>
               <span className="text-xs font-semibold text-gray-500 px-2 py-1 bg-white rounded-md border border-gray-200 shadow-sm">{logs.length} results</span>
             </div>
             
             <div className="overflow-x-auto">
               <table className="w-full border-collapse">
                 <thead>
                   <tr className="border-b border-gray-200 bg-white">
                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Action Details</th>
                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Entity ID</th>
                     <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Performed By</th>
                     <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 tracking-wider">Time</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100 bg-white">
                   {logs.map((log) => (
                     <tr key={log.id} className="group hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
                       <td className="px-6 py-4">
                         <div className="flex items-center gap-3">
                           <span className={`shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md shadow-sm border ${actionChip(log.action)}`}>
                             {log.action.split('_')[0]}
                           </span>
                           <div className="min-w-0">
                             <div className="flex items-center gap-1.5 text-sm font-bold text-gray-900 group-hover:text-dark transition-colors">
                                {getEntityIcon(log.entityType)}
                                {actionLabel(log.action)}
                             </div>
                             {actionDetail(log) && (
                               <p className="text-xs font-medium text-gray-500 mt-0.5 truncate max-w-[280px]">{actionDetail(log)}</p>
                             )}
                           </div>
                         </div>
                       </td>
                       <td className="px-6 py-4">
                          <span className="text-xs font-semibold px-2 py-1 bg-gray-100/80 text-gray-600 rounded-md shadow-sm border border-gray-200/50">
                            {log.entityId ? `#${log.entityId.substring(0, 6)}` : 'System Core'}
                          </span>
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-full bg-pharmacore-gray text-dark flex items-center justify-center font-bold text-xs overflow-hidden border border-gray-100">
                               <img src={`https://ui-avatars.com/api/?name=${log.user?.name || 'S'}&background=eff6ff&color=1d4ed8&rounded=false`} className="w-full h-full object-cover" />
                             </div>
                             <div className="flex flex-col">
                               <span className="text-sm font-semibold text-gray-900">{log.user?.name || (log.userId ? 'Deleted user' : 'System')}</span>
                               {log.user?.role && (
                                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{(log.user.role === 'SUB_ADMIN' ? 'ADMIN' : log.user.role).replace(/_/g, ' ')}</span>
                               )}
                             </div>
                          </div>
                       </td>
                       <td className="px-6 py-4 text-right">
                          <div className="flex flex-col items-end gap-0.5">
                             <span className="text-sm font-bold text-gray-900 tabular-nums">
                               {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                             <span className="text-xs font-medium text-gray-500">{new Date(log.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
             
             {logs.length === 0 && (
               <div className="py-20 text-center flex flex-col items-center gap-4">
                 <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-300 border border-gray-100">
                   <Activity size={32} />
                 </div>
                 <div className="flex flex-col gap-1">
                   <h4 className="text-sm font-bold text-gray-900">No Activity Logs Found</h4>
                   <p className="text-xs font-medium text-gray-500 max-w-xs mx-auto">Adjust the filters on the left to discover specific dashboard events.</p>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
           <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-pharmacore-gray text-dark flex items-center justify-center">
                       <Eye size={20} />
                    </div>
                    <div className="flex flex-col">
                       <h2 className="text-lg font-bold text-gray-900">Activity Inspection</h2>
                       <p className="text-xs font-medium text-gray-500 mt-0.5 flex items-center gap-1.5">
                         <Clock size={12} className="text-dark" /> {new Date(selectedLog.createdAt).toLocaleString(undefined, { dateStyle: 'full', timeStyle: 'short' })}
                       </p>
                    </div>
                 </div>
                 <button onClick={() => setSelectedLog(null)} className="w-10 h-10 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-500 hover:text-gray-900 transition-colors">
                    <X size={20} />
                 </button>
              </div>

              <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50 flex flex-col gap-8">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1">
                       <span className="text-xs font-semibold text-gray-500">Performed By</span>
                       <span className="text-sm font-bold text-gray-900 flex items-center gap-2">
                           <div className="w-5 h-5 rounded-full bg-gray-100 overflow-hidden"><img src={`https://ui-avatars.com/api/?name=${selectedLog.user?.name || 'S'}&background=f3f4f6&color=111827&rounded=false`} className="w-full h-full object-cover" /></div>
                           {selectedLog.user?.name || (selectedLog.userId ? 'Deleted user' : 'System')}
                       </span>
                       {selectedLog.user && (
                         <span className="text-xs font-medium text-gray-500">
                           {selectedLog.user.email} · {(selectedLog.user.role === 'SUB_ADMIN' ? 'ADMIN' : selectedLog.user.role).replace(/_/g, ' ')}
                         </span>
                       )}
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1">
                       <span className="text-xs font-semibold text-gray-500">Entity Details</span>
                       <span className="text-sm font-bold text-gray-900">{selectedLog.entityType} <span className="text-gray-400 font-medium">#{selectedLog.entityId?.substring(0, 8) || 'N/A'}</span></span>
                    </div>
                    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-col gap-1">
                       <span className="text-xs font-semibold text-gray-500">IP Address</span>
                       <span className="text-sm font-mono font-medium text-gray-600">{selectedLog.ipAddress || '127.0.0.1'}</span>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {selectedLog.oldValue && (
                       <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-coral/50"></span>
                             <h4 className="text-sm font-bold text-gray-700">Previous State</h4>
                          </div>
                          <div className="p-4 bg-gray-100/80 rounded-xl text-xs font-mono text-gray-600 overflow-x-auto shadow-inner border border-gray-200">
                             <pre className="whitespace-pre-wrap leading-relaxed">{JSON.stringify(selectedLog.oldValue, null, 2)}</pre>
                          </div>
                       </div>
                    )}

                    {selectedLog.newValue && (
                       <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-2">
                             <span className="w-2 h-2 rounded-full bg-dark shadow-sm shadow-green-500/50"></span>
                             <h4 className="text-sm font-bold text-gray-900">New State</h4>
                          </div>
                          <div className="p-4 bg-pharmacore-gray/50 rounded-xl text-xs font-mono text-dark overflow-x-auto border border-gray-100 shadow-sm">
                             <pre className="whitespace-pre-wrap leading-relaxed">{JSON.stringify(selectedLog.newValue, null, 2)}</pre>
                          </div>
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
