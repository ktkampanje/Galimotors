import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { Plus, Edit2, Trash2, Shield, User, X } from 'lucide-react';
import { useModal } from '../components/ui/ModalContext';
import CustomSelect from '../components/ui/CustomSelect';

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'ADMIN',
    phone: '',
    district: '',
    marketId: '',
    sellerType: 'INDIVIDUAL'
  });
  const [markets, setMarkets] = useState<any[]>([]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const [usersRes, marketsRes] = await Promise.all([
        api.get('/users'),
        api.get('/markets')
      ]);
      setUsers(usersRes.data);
      setMarkets(marketsRes.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingUser) {
        // Update existing user
        await api.put(`/users/${editingUser.id}`, formData);
      } else {
        // Create new user
        await api.post('/users', formData);
      }
      
      fetchUsers();
      resetForm();
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  };

  const handleEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFormData({
      name: user.name,
      email: user.email,
      password: '', // Don't pre-fill password
      role: user.role,
      phone: '',
      district: '',
      marketId: '',
      sellerType: 'INDIVIDUAL'
    });
    setShowForm(true);
  };

  const { showConfirm } = useModal();

  const handleDelete = async (userId: string) => {
    const confirmed = await showConfirm({
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this user? This action cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete User'
    });
    
    if (!confirmed) return;
    
    try {
      await api.delete(`/users/${userId}`);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'ADMIN',
      phone: '',
      district: '',
      marketId: '',
      sellerType: 'INDIVIDUAL'
    });
    setEditingUser(null);
    setShowForm(false);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'SUPER_ADMIN': return <Shield size={16} />;
      case 'ADMIN': return <Shield size={16} />;
      case 'SELLER': return <User size={16} className="text-coral" />;
      case 'MARKET_ATTENDANT': return <User size={16} className="text-info" />;
      case 'CUSTOMER': return <User size={16} className="text-success" />;
      default: return <User size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-sm font-medium text-gray-400 animate-pulse flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-gray-200 border-t-coral rounded-full animate-spin"></div>
          Loading personnel records...
        </div>
      </div>
    );
  }

  const roleOptions = [
    { id: 'SUPER_ADMIN', name: 'Super Admin (All Access)' },
    { id: 'SUB_ADMIN', name: 'Sub-Admin (Management)' },
    { id: 'ADMIN', name: 'Admin (Approve Listings)' },
    { id: 'SELLER', name: 'Seller (Manage Own Listings)' },
    { id: 'MARKET_ATTENDANT', name: 'Market Attendant (Manage Floor Cars)' },
    { id: 'CUSTOMER', name: 'Customer / Buyer' },
  ];

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 pb-12 w-full max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-2">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 font-medium">Manage admin access and authority levels</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2"
        >
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center z-[100] animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl relative overflow-hidden">
            <button
               onClick={resetForm}
               className="absolute top-6 right-6 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
            >
               <X size={16} />
            </button>
            <h2 className="text-lg font-bold text-gray-900 mb-6">
              {editingUser ? 'Edit User Details' : 'Provision New User'}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400"
                  placeholder="John Doe"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400"
                  placeholder="user@galimotors.com"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  Password {editingUser && '(Optional to update)'}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all placeholder:text-gray-400"
                  placeholder="••••••••"
                />
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">
                  User Role
                </label>
                <CustomSelect 
                  value={formData.role}
                  onChange={(val) => setFormData(prev => ({ ...prev, role: val }))}
                  options={roleOptions}
                  placeholder="Select Role"
                />
              </div>

              {/* Conditional Profile Fields */}
              {(formData.role === 'SELLER' || formData.role === 'MARKET_ATTENDANT') && (
                <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Profile Details</p>
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600">Phone Number</label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all"
                      placeholder="099..."
                    />
                  </div>

                  {formData.role === 'SELLER' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">District</label>
                      <input
                        type="text"
                        required
                        value={formData.district}
                        onChange={(e) => setFormData(prev => ({ ...prev, district: e.target.value }))}
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium focus:border-dark focus:ring-1 focus:ring-dark outline-none transition-all"
                        placeholder="e.g. Lilongwe"
                      />
                    </div>
                  )}

                  {formData.role === 'MARKET_ATTENDANT' && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600">Assigned Market</label>
                      <CustomSelect 
                        value={formData.marketId}
                        onChange={(val) => setFormData(prev => ({ ...prev, marketId: val }))}
                        options={markets.map(m => ({ id: m.id, name: `${m.name} (${m.district})` }))}
                        placeholder="Select a Market..."
                      />
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="btn-outline flex-1 text-sm font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary flex-1 text-sm font-bold"
                >
                  {editingUser ? 'Save Updates' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Users List */}
      <div className="card-widget overflow-hidden p-0 shadow-sm border border-gray-100 bg-white">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-900">
            Active Users ({users.length})
          </h2>
          <div className="flex gap-2 items-center bg-white px-2 py-1 rounded-md border border-gray-200 shadow-sm transition-all">
             <div className="w-2 h-2 bg-dark rounded-full animate-pulse" />
             <span className="text-xs font-semibold text-gray-500">Live System</span>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-200 bg-white">
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Identity Details</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Role Tier</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 tracking-wider">Date Added</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-xl bg-pharmacore-gray text-dark flex items-center justify-center font-bold text-lg overflow-hidden border border-gray-100">
                         <img src={`https://ui-avatars.com/api/?name=${user.name}&background=f0fdf4&color=15803d&rounded=false`} alt={user.name} className="w-full h-full object-cover" />
                       </div>
                       <div className="flex flex-col">
                         <div className="text-sm font-bold text-gray-900">{user.name}</div>
                         <div className="text-xs font-medium text-gray-500">{user.email}</div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-colors shadow-sm ${
                      user.role === 'SUPER_ADMIN' ? 'bg-pharmacore-gray text-dark border border-gray-100' : 
                      user.role === 'SELLER' ? 'bg-coral/10 text-coral border border-coral/20' :
                      user.role === 'MARKET_ATTENDANT' ? 'bg-info-light text-info border border-info/20' :
                      'bg-gray-100 text-gray-700 border border-gray-200'
                    }`}>
                      {getRoleIcon(user.role)}
                      {user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-gray-700">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(user)}
                        className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:text-dark hover:bg-pharmacore-gray transition-colors"
                        title="Edit User"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(user.id)}
                        className="p-2 rounded-lg bg-gray-50 text-gray-400 hover:text-coral hover:bg-coral/10 transition-colors"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {users.length === 0 && (
          <div className="p-16 text-center flex flex-col items-center gap-4">
            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center">
              <Shield size={32} className="text-gray-300" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-sm font-bold text-gray-900">No Users Found</div>
              <div className="text-xs font-medium text-gray-500">Add staff accounts to grant access to the dashboard.</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
