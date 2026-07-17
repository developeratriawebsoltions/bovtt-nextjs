'use client';

import { useState, useEffect, useCallback } from 'react';

interface Lead {
  id: number;
  name: string;
  phone: string;
  address: string;
  label: 'green' | 'yellow' | 'red' | 'none';
  comment_count: number;
  pending_followups: number;
  created_at: string;
}

interface Comment {
  id: number;
  contact_id: number;
  comment: string;
  created_at: string;
}

interface Followup {
  id: number;
  contact_id: number;
  followup_date: string;
  notes: string;
  status: string;
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showCommentModal, setShowCommentModal] = useState(false);
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showEditLeadModal, setShowEditLeadModal] = useState(false);
  
  // Filter states
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  
  // Export states
  const [exportType, setExportType] = useState<'month' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState(false);
  
  // Form states
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadPhone, setNewLeadPhone] = useState('');
  const [newLeadAddress, setNewLeadAddress] = useState('');
  const [newLeadLabel, setNewLeadLabel] = useState('none');
  
  // Edit lead states
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editLabel, setEditLabel] = useState('');
  
  const [commentText, setCommentText] = useState('');
  const [followupDate, setFollowupDate] = useState('');
  const [followupNotes, setFollowupNotes] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  
  const [alert, setAlert] = useState<{ show: boolean; message: string; type: string }>({ show: false, message: '', type: 'info' });

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchLeads();
  }, [activeFilter, debouncedSearchTerm]);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: 'info' }), 3000);
  };

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const url = `/api/leads?filter=${activeFilter}&search=${encodeURIComponent(debouncedSearchTerm)}`;
      const response = await fetch(url);
      const data = await response.json();
      if (data.success) {
        setLeads(data.leads);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async (leadId: number) => {
    try {
      const response = await fetch(`/api/leads/comments?leadId=${leadId}`);
      const data = await response.json();
      if (data.success) {
        setComments(data.comments);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchFollowups = async (leadId: number) => {
    try {
      const response = await fetch(`/api/leads/followups?leadId=${leadId}`);
      const data = await response.json();
      if (data.success) {
        setFollowups(data.followups);
      }
    } catch (error) {
      console.error('Error fetching followups:', error);
    }
  };

  const handleAddLead = async () => {
    if (!newLeadName || !newLeadPhone) {
      showAlert('Please enter name and phone', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newLeadName,
          phone: newLeadPhone,
          address: newLeadAddress,
          label: newLeadLabel
        })
      });

      const data = await response.json();
      if (data.success) {
        await fetchLeads();
        setShowAddLeadModal(false);
        setNewLeadName('');
        setNewLeadPhone('');
        setNewLeadAddress('');
        setNewLeadLabel('none');
        showAlert('Lead added successfully!', 'success');
      } else {
        showAlert(data.error || 'Failed to add lead', 'error');
      }
    } catch (error) {
      showAlert('Error adding lead', 'error');
    }
  };

  const handleEditLead = async () => {
    if (!editingLead) return;
    
    if (!editName || !editPhone) {
      showAlert('Please enter name and phone', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingLead.id,
          name: editName,
          phone: editPhone,
          address: editAddress,
          label: editLabel
        })
      });

      const data = await response.json();
      if (data.success) {
        await fetchLeads();
        setShowEditLeadModal(false);
        setEditingLead(null);
        showAlert('Lead updated successfully!', 'success');
      } else {
        showAlert(data.error || 'Failed to update lead', 'error');
      }
    } catch (error) {
      showAlert('Error updating lead', 'error');
    }
  };

  const openEditModal = (lead: Lead) => {
    setEditingLead(lead);
    setEditName(lead.name);
    setEditPhone(lead.phone);
    setEditAddress(lead.address || '');
    setEditLabel(lead.label);
    setShowEditLeadModal(true);
  };

  const handleUpdateStatus = async (leadId: number, label: string) => {
    try {
      const response = await fetch('/api/leads', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: leadId, label })
      });

      const data = await response.json();
      if (data.success) {
        await fetchLeads();
        showAlert('Status updated successfully!', 'success');
      }
    } catch (error) {
      showAlert('Error updating status', 'error');
    }
  };

  const handleAddComment = async () => {
    if (!selectedLead || !commentText) {
      showAlert('Please enter a comment', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/leads/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          comment: commentText
        })
      });

      const data = await response.json();
      if (data.success) {
        await fetchComments(selectedLead.id);
        await fetchLeads();
        setCommentText('');
        setShowCommentModal(false);
        showAlert('Comment added successfully!', 'success');
      } else {
        showAlert(data.error || 'Failed to add comment', 'error');
      }
    } catch (error) {
      showAlert('Error adding comment', 'error');
    }
  };

  const handleAddFollowup = async () => {
    if (!selectedLead || !followupDate) {
      showAlert('Please select a followup date', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/leads/followups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: selectedLead.id,
          followupDate: followupDate,
          notes: followupNotes
        })
      });

      const data = await response.json();
      if (data.success) {
        await fetchFollowups(selectedLead.id);
        await fetchLeads();
        setFollowupDate('');
        setFollowupNotes('');
        setShowFollowupModal(false);
        showAlert('Followup scheduled successfully!', 'success');
      } else {
        showAlert(data.error || 'Failed to schedule followup', 'error');
      }
    } catch (error) {
      showAlert('Error scheduling followup', 'error');
    }
  };

  const handleSendMessage = async () => {
    if (!selectedLead || !messageText) {
      showAlert('Please enter a message', 'warning');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/leads/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedLead.phone,
          message: messageText
        })
      });

      const data = await response.json();
      if (data.success) {
        setMessageText('');
        setShowMessageModal(false);
        showAlert('Message sent successfully!', 'success');
      } else {
        showAlert(data.error || 'Failed to send message', 'error');
      }
    } catch (error) {
      showAlert('Error sending message', 'error');
    } finally {
      setSending(false);
    }
  };

  const exportToCSV = async () => {
    setExporting(true);
    try {
      let url = '/api/leads/export?';
      
      if (exportType === 'month' && selectedMonth) {
        url += `month=${selectedMonth}&year=${selectedYear}`;
      } else if (exportType === 'custom' && startDate && endDate) {
        url += `startDate=${startDate}&endDate=${endDate}`;
      } else {
        showAlert('Please select export criteria', 'warning');
        setExporting(false);
        return;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.data.length > 0) {
        const headers = ['ID', 'Name', 'Phone', 'Address', 'Status', 'Comments Count', 'Pending Followups', 'Created At'];
        const csvRows = [headers];
        
        for (const lead of data.data) {
          const statusLabel = getStatusLabel(lead.label);
          csvRows.push([
            lead.id,
            lead.name,
            lead.phone,
            lead.address || '',
            statusLabel,
            lead.comment_count,
            lead.pending_followups,
            new Date(lead.created_at).toLocaleString()
          ]);
        }
        
        const csvContent = csvRows.map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url_ = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url_;
        a.download = `leads_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url_);
        showAlert(`Exported ${data.data.length} leads successfully!`, 'success');
      } else {
        showAlert('No data found for selected criteria', 'warning');
      }
    } catch (error) {
      console.error('Error exporting leads:', error);
      showAlert('Error exporting leads', 'error');
    } finally {
      setExporting(false);
      setShowExportModal(false);
    }
  };

  const getStatusLabel = (label: string) => {
    const labels: Record<string, string> = {
      green: 'Interested',
      yellow: 'Prospect',
      red: 'Not Interested',
      none: 'Yet to Qualify'
    };
    return labels[label] || label;
  };

  const getStatusBadge = (label: string) => {
    const badges: Record<string, string> = {
      green: 'bg-green-500',
      yellow: 'bg-yellow-500',
      red: 'bg-red-500',
      none: 'bg-gray-500'
    };
    const labels: Record<string, string> = {
      green: 'Interested',
      yellow: 'Prospect',
      red: 'Not Interested',
      none: 'Yet to Qualify'
    };
    return { color: badges[label] || 'bg-gray-500', label: labels[label] || label };
  };

  const getFilterCount = (filter: string) => {
    if (filter === 'all') return leads.length;
    let labelValue = '';
    switch(filter) {
      case 'interested': labelValue = 'green'; break;
      case 'prospect': labelValue = 'yellow'; break;
      case 'not_interested': labelValue = 'red'; break;
      case 'yet_to_qualify': labelValue = 'none'; break;
    }
    return leads.filter(l => l.label === labelValue).length;
  };

  const getYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let i = currentYear - 5; i <= currentYear + 1; i++) {
      years.push(i);
    }
    return years;
  };

  const getMonthOptions = () => {
    return [
      { value: '01', label: 'January' },
      { value: '02', label: 'February' },
      { value: '03', label: 'March' },
      { value: '04', label: 'April' },
      { value: '05', label: 'May' },
      { value: '06', label: 'June' },
      { value: '07', label: 'July' },
      { value: '08', label: 'August' },
      { value: '09', label: 'September' },
      { value: '10', label: 'October' },
      { value: '11', label: 'November' },
      { value: '12', label: 'December' }
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00a884] mx-auto mb-4"></div>
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alert Toast */}
      {alert.show && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
          alert.type === 'success' ? 'bg-green-500' :
          alert.type === 'error' ? 'bg-red-500' :
          alert.type === 'warning' ? 'bg-yellow-500' :
          'bg-blue-500'
        } text-white`}>
          {alert.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-xl font-semibold">Leads Management</h2>
          <p className="text-[#8696a0] text-sm mt-1">Manage your leads, comments, followups and send messages</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowExportModal(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
          >
            📊 Export Data
          </button>
          <button
            onClick={() => setShowAddLeadModal(true)}
            className="bg-[#00a884] text-white px-4 py-2 rounded-lg hover:bg-[#008f6e] transition"
          >
            + Add Lead
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        <div className="bg-[#202c33] rounded-lg p-3">
          <p className="text-[#8696a0] text-xs">Total Leads</p>
          <p className="text-white text-xl font-bold">{leads.length}</p>
        </div>
        <div className="bg-[#202c33] rounded-lg p-3">
          <p className="text-[#8696a0] text-xs">Yet to Qualify</p>
          <p className="text-gray-400 text-xl font-bold">{leads.filter(l => l.label === 'none').length}</p>
        </div>
        <div className="bg-[#202c33] rounded-lg p-3">
          <p className="text-[#8696a0] text-xs">Interested</p>
          <p className="text-green-400 text-xl font-bold">{leads.filter(l => l.label === 'green').length}</p>
        </div>
        <div className="bg-[#202c33] rounded-lg p-3">
          <p className="text-[#8696a0] text-xs">Prospects</p>
          <p className="text-yellow-400 text-xl font-bold">{leads.filter(l => l.label === 'yellow').length}</p>
        </div>
        <div className="bg-[#202c33] rounded-lg p-3">
          <p className="text-[#8696a0] text-xs">Not Interested</p>
          <p className="text-red-400 text-xl font-bold">{leads.filter(l => l.label === 'red').length}</p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              activeFilter === 'all'
                ? 'bg-[#00a884] text-white'
                : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
            }`}
          >
            All Leads ({getFilterCount('all')})
          </button>
          <button
            onClick={() => setActiveFilter('yet_to_qualify')}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              activeFilter === 'yet_to_qualify'
                ? 'bg-[#00a884] text-white'
                : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
            }`}
          >
            Yet to Qualify ({getFilterCount('yet_to_qualify')})
          </button>
          <button
            onClick={() => setActiveFilter('interested')}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              activeFilter === 'interested'
                ? 'bg-[#00a884] text-white'
                : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
            }`}
          >
            🟢 Interested ({getFilterCount('interested')})
          </button>
          <button
            onClick={() => setActiveFilter('prospect')}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              activeFilter === 'prospect'
                ? 'bg-[#00a884] text-white'
                : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
            }`}
          >
            🟡 Prospects ({getFilterCount('prospect')})
          </button>
          <button
            onClick={() => setActiveFilter('not_interested')}
            className={`px-3 py-1.5 rounded-lg text-sm transition ${
              activeFilter === 'not_interested'
                ? 'bg-[#00a884] text-white'
                : 'bg-[#2a3942] text-[#8696a0] hover:text-white'
            }`}
          >
            🔴 Not Interested ({getFilterCount('not_interested')})
          </button>
        </div>
        
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-[#2a3942] text-white rounded-lg pl-9 pr-3 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#00a884] w-64"
          />
          <svg className="absolute left-3 top-2 w-4 h-4 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-[#202c33] rounded-lg border border-[#2a3942] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#2a3942]">
              <tr className="text-left text-[#8696a0] text-sm">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Address</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Comments</th>
                <th className="px-4 py-3">Pending Followups</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[#8696a0]">
                    No leads found
                   </td>
                 </tr>
              ) : (
                leads.map((lead) => {
                  const statusBadge = getStatusBadge(lead.label);
                  return (
                    <tr key={lead.id} className="border-t border-[#2a3942] hover:bg-[#2a3942]/30">
                      <td className="px-4 py-3 text-white">{lead.name}</td>
                      <td className="px-4 py-3 text-[#e9edef]">{lead.phone}</td>
                      <td className="px-4 py-3 text-[#e9edef] max-w-xs truncate">{lead.address || '-'}</td>
                      <td className="px-4 py-3">
                        <select
                          value={lead.label}
                          onChange={(e) => handleUpdateStatus(lead.id, e.target.value)}
                          className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge.color} text-white border-none outline-none cursor-pointer`}
                        >
                          <option value="none">Yet to Qualify</option>
                          <option value="green">Interested</option>
                          <option value="yellow">Prospect</option>
                          <option value="red">Not Interested</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-[#8696a0] text-sm">{lead.comment_count}</td>
                      <td className="px-4 py-3">
                        {lead.pending_followups > 0 ? (
                          <span className="text-yellow-400 text-sm">{lead.pending_followups}</span>
                        ) : (
                          <span className="text-[#8696a0] text-sm">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button
                            onClick={async () => {
                              setSelectedLead(lead);
                              await fetchComments(lead.id);
                              await fetchFollowups(lead.id);
                              setShowCommentModal(true);
                            }}
                            className="text-blue-400 hover:text-blue-300 p-1"
                            title="Add Comment"
                          >
                            💬
                          </button>
                          <button
                            onClick={async () => {
                              setSelectedLead(lead);
                              await fetchFollowups(lead.id);
                              setShowFollowupModal(true);
                            }}
                            className="text-yellow-400 hover:text-yellow-300 p-1"
                            title="Schedule Followup"
                          >
                            📅
                          </button>
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setMessageText('');
                              setShowMessageModal(true);
                            }}
                            className="text-[#00a884] hover:text-[#008f6e] p-1"
                            title="Send WhatsApp Message"
                          >
                            💬
                          </button>
                          <button
                            onClick={() => openEditModal(lead)}
                            className="text-purple-400 hover:text-purple-300 p-1"
                            title="Edit Lead"
                          >
                            ✏️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Lead Modal */}
      {showAddLeadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-[#2a3942] flex justify-between">
              <h3 className="text-white font-semibold">Add New Lead</h3>
              <button onClick={() => setShowAddLeadModal(false)} className="text-white text-2xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <input
                type="text"
                placeholder="Name *"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              />
              <input
                type="tel"
                placeholder="Phone *"
                value={newLeadPhone}
                onChange={(e) => setNewLeadPhone(e.target.value)}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              />
              <input
                type="text"
                placeholder="Address"
                value={newLeadAddress}
                onChange={(e) => setNewLeadAddress(e.target.value)}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              />
              <select
                value={newLeadLabel}
                onChange={(e) => setNewLeadLabel(e.target.value)}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              >
                <option value="none">Yet to Qualify</option>
                <option value="green">Interested</option>
                <option value="yellow">Prospect</option>
                <option value="red">Not Interested</option>
              </select>
              <button
                onClick={handleAddLead}
                className="w-full bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] transition"
              >
                Add Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {showEditLeadModal && editingLead && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-[#2a3942] flex justify-between">
              <h3 className="text-white font-semibold">Edit Lead</h3>
              <button onClick={() => setShowEditLeadModal(false)} className="text-white text-2xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <input
                type="text"
                placeholder="Name *"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              />
              <input
                type="tel"
                placeholder="Phone *"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              />
              <input
                type="text"
                placeholder="Address"
                value={editAddress}
                onChange={(e) => setEditAddress(e.target.value)}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              />
              <select
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              >
                <option value="none">Yet to Qualify</option>
                <option value="green">Interested</option>
                <option value="yellow">Prospect</option>
                <option value="red">Not Interested</option>
              </select>
              <button
                onClick={handleEditLead}
                className="w-full bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] transition"
              >
                Update Lead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comment Modal */}
      {showCommentModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b border-[#2a3942] flex justify-between">
              <h3 className="text-white font-semibold">Comments - {selectedLead.name}</h3>
              <button onClick={() => setShowCommentModal(false)} className="text-white text-2xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="max-h-64 overflow-y-auto space-y-2">
                {comments.length === 0 ? (
                  <p className="text-center text-[#8696a0] py-4">No comments yet</p>
                ) : (
                  comments.map((comment) => (
                    <div key={comment.id} className="bg-[#2a3942] rounded-lg p-3">
                      <p className="text-white text-sm">{comment.comment}</p>
                      <p className="text-[#8696a0] text-xs mt-1">{new Date(comment.created_at).toLocaleString()}</p>
                    </div>
                  ))
                )}
              </div>
              
              <div className="border-t border-[#2a3942] pt-4">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={3}
                  className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884] resize-none"
                />
                <button
                  onClick={handleAddComment}
                  className="w-full mt-2 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] transition"
                >
                  Add Comment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Followup Modal */}
      {showFollowupModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-[#2a3942] flex justify-between">
              <h3 className="text-white font-semibold">Schedule Followup - {selectedLead.name}</h3>
              <button onClick={() => setShowFollowupModal(false)} className="text-white text-2xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <input
                type="date"
                value={followupDate}
                onChange={(e) => setFollowupDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
              />
              <textarea
                value={followupNotes}
                onChange={(e) => setFollowupNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={3}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884] resize-none"
              />
              <button
                onClick={handleAddFollowup}
                className="w-full bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] transition"
              >
                Schedule Followup
              </button>

              {followups.length > 0 && (
                <div className="border-t border-[#2a3942] pt-4">
                  <p className="text-[#8696a0] text-sm mb-2">Scheduled Followups</p>
                  <div className="space-y-2">
                    {followups.map((f) => (
                      <div key={f.id} className="bg-[#2a3942] rounded-lg p-2">
                        <p className="text-white text-sm">{new Date(f.followup_date).toLocaleDateString()}</p>
                        {f.notes && <p className="text-[#8696a0] text-xs">{f.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {showMessageModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-[#2a3942] flex justify-between">
              <h3 className="text-white font-semibold">Send WhatsApp Message to {selectedLead.name}</h3>
              <button onClick={() => setShowMessageModal(false)} className="text-white text-2xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="bg-[#2a3942] rounded-lg p-2">
                <p className="text-[#8696a0] text-xs">To:</p>
                <p className="text-white">{selectedLead.phone}</p>
              </div>
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type your message here..."
                rows={5}
                className="w-full bg-[#2a3942] text-white rounded-lg p-3 outline-none focus:ring-1 focus:ring-[#00a884] resize-none"
                autoFocus
              />
              <button
                onClick={handleSendMessage}
                disabled={!messageText.trim() || sending}
                className="w-full bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition"
              >
                {sending ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Sending...</span>
                  </div>
                ) : (
                  'Send Message'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-[#2a3942] flex justify-between">
              <h3 className="text-white font-semibold">Export Leads Data</h3>
              <button onClick={() => setShowExportModal(false)} className="text-white text-2xl">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="month"
                    checked={exportType === 'month'}
                    onChange={() => setExportType('month')}
                    className="accent-[#00a884]"
                  />
                  <span className="text-white">Month-wise</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    value="custom"
                    checked={exportType === 'custom'}
                    onChange={() => setExportType('custom')}
                    className="accent-[#00a884]"
                  />
                  <span className="text-white">Custom Date Range</span>
                </label>
              </div>

              {exportType === 'month' && (
                <div className="space-y-3">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                  >
                    <option value="">Select Month</option>
                    {getMonthOptions().map(month => (
                      <option key={month.value} value={month.value}>{month.label}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                  >
                    {getYearOptions().map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
              )}

              {exportType === 'custom' && (
                <div className="space-y-3">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                    placeholder="Start Date"
                  />
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                    placeholder="End Date"
                  />
                </div>
              )}

              <button
                onClick={exportToCSV}
                disabled={exporting || (exportType === 'month' && !selectedMonth) || (exportType === 'custom' && (!startDate || !endDate))}
                className="w-full bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition"
              >
                {exporting ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Exporting...</span>
                  </div>
                ) : (
                  'Export to CSV'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}