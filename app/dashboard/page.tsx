// app/dashboard/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import ContactManager from '../components/ContactManager';
import TemplateManager from '../components/TemplateManager';
import Broadcasting from '../components/Broadcasting';
import ClientDashboard from '../components/ClientDashboard';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface DashboardStats {
  totalMessages: number;
  totalConversations: number;
  unreadCount: number;
  activeContacts: number;
  messagesToday: number;
  responseRate: number;
  avgResponseTime: number;
}

interface RecentMessage {
  id: number;
  phone: string;
  message: string;
  direction: string;
  created_at: string;
}

export default function Dashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<DashboardStats>({
    totalMessages: 0,
    totalConversations: 0,
    unreadCount: 0,
    activeContacts: 0,
    messagesToday: 0,
    responseRate: 0,
    avgResponseTime: 0,
  });
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('week');
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [contacts, setContacts] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchDashboardData();
    fetchContacts();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const statsRes = await fetch('/api/dashboard/stats');
      const statsData = await statsRes.json();
      if (statsData.success) {
        setStats(statsData.stats);
      }

      const messagesRes = await fetch('/api/dashboard/recent-messages');
      const messagesData = await messagesRes.json();
      if (messagesData.success) {
        setRecentMessages(messagesData.messages);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      if (data.success) {
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedContact || !messageText.trim()) {
      alert('Please select a contact and enter a message');
      return;
    }

    setSending(true);
    try {
      const response = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: selectedContact.phone,
          message: messageText.trim()
        })
      });

      const data = await response.json();
      if (data.success) {
        alert('Message sent successfully!');
        setMessageText('');
        setShowChatModal(false);
        setSelectedContact(null);
      } else {
        alert('Failed to send message: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Error sending message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  const getStatusBadge = (label: string) => {
    switch (label) {
      case 'green': return { color: 'bg-green-500', text: 'Interested' };
      case 'yellow': return { color: 'bg-yellow-500', text: 'Prospect' };
      case 'red': return { color: 'bg-red-500', text: 'Not Interested' };
      default: return { color: 'bg-gray-500', text: 'New Lead' };
    }
  };

  // Chart Data
  const messageTrendData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Incoming Messages',
        data: [65, 78, 90, 81, 56, 55, 40],
        borderColor: 'rgb(0, 168, 132)',
        backgroundColor: 'rgba(0, 168, 132, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Outgoing Messages',
        data: [45, 62, 75, 70, 48, 42, 35],
        borderColor: 'rgb(37, 211, 102)',
        backgroundColor: 'rgba(37, 211, 102, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const conversationData = {
    labels: ['Active', 'New', 'Inactive', 'Resolved'],
    datasets: [
      {
        data: [65, 20, 10, 5],
        backgroundColor: ['#00a884', '#25d366', '#ffc107', '#dc3545'],
        borderWidth: 0,
      },
    ],
  };

  const responseTimeData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        label: 'Response Time (minutes)',
        data: [3.2, 2.8, 2.5, 3.0, 2.2, 1.8, 2.0],
        borderColor: 'rgb(255, 193, 7)',
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: '#e9edef',
        },
      },
    },
    scales: {
      y: {
        grid: {
          color: '#2a3942',
        },
        ticks: {
          color: '#8696a0',
        },
      },
      x: {
        grid: {
          color: '#2a3942',
        },
        ticks: {
          color: '#8696a0',
        },
      },
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: '#e9edef',
        },
      },
    },
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', color: 'text-blue-400' },
    { id: 'clientdashboard', label: 'Client Dashboard', icon: '👥', color: 'text-green-400' },
    { id: 'contacts', label: 'Contacts', icon: '📇', color: 'text-yellow-400' },
    { id: 'broadcasting', label: 'Broadcasting', icon: '📈', color: 'text-purple-400' },
    { id: 'templates', label: 'Templates', icon: '📋', color: 'text-orange-400' },
  ];

  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone.includes(searchTerm)
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942] hover:border-[#00a884] transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8696a0] text-sm">Total Messages</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.totalMessages.toLocaleString()}</p>
                  </div>
                  <div className="w-10 h-10 bg-blue-500/20 rounded-full flex items-center justify-center">
                    <span className="text-xl">💬</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-green-400">↑ 12% from last week</div>
              </div>

              <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942] hover:border-[#00a884] transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8696a0] text-sm">Conversations</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.totalConversations}</p>
                  </div>
                  <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center">
                    <span className="text-xl">👥</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-green-400">Active: {stats.activeContacts}</div>
              </div>

              <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942] hover:border-[#00a884] transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8696a0] text-sm">Unread Messages</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.unreadCount}</p>
                  </div>
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-full flex items-center justify-center">
                    <span className="text-xl">🔔</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-yellow-400">Need attention</div>
              </div>

              <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942] hover:border-[#00a884] transition-all">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[#8696a0] text-sm">Response Rate</p>
                    <p className="text-2xl font-bold text-white mt-1">{stats.responseRate}%</p>
                  </div>
                  <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                    <span className="text-xl">⚡</span>
                  </div>
                </div>
                <div className="mt-2 text-xs text-green-400">Avg {stats.avgResponseTime}min</div>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-white font-semibold">Message Trend</h3>
                  <select 
                    value={selectedPeriod}
                    onChange={(e) => setSelectedPeriod(e.target.value)}
                    className="bg-[#2a3942] text-white text-sm rounded-lg px-3 py-1 outline-none"
                  >
                    <option value="week">This Week</option>
                    <option value="month">This Month</option>
                    <option value="year">This Year</option>
                  </select>
                </div>
                <div className="h-64">
                  <Line data={messageTrendData} options={chartOptions} />
                </div>
              </div>

              <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
                <h3 className="text-white font-semibold mb-4">Conversation Status</h3>
                <div className="h-64">
                  <Doughnut data={conversationData} options={doughnutOptions} />
                </div>
              </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
                <h3 className="text-white font-semibold mb-4">Average Response Time</h3>
                <div className="h-64">
                  <Line data={responseTimeData} options={chartOptions} />
                </div>
              </div>

              <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
                <h3 className="text-white font-semibold mb-4">Recent Messages</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {recentMessages.slice(0, 5).map((msg) => (
                    <div key={msg.id} className="flex items-center gap-3 p-2 hover:bg-[#2a3942] rounded-lg transition">
                      <div className={`w-2 h-2 rounded-full ${msg.direction === 'incoming' ? 'bg-green-500' : 'bg-blue-500'}`}></div>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{msg.phone}</p>
                        <p className="text-[#8696a0] text-xs truncate">{msg.message}</p>
                      </div>
                      <p className="text-[#8696a0] text-xs">{formatTime(msg.created_at)}</p>
                    </div>
                  ))}
                  {recentMessages.length === 0 && (
                    <p className="text-[#8696a0] text-center py-4">No recent messages</p>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-gradient-to-r from-[#00a884] to-[#008f6e] rounded-lg p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white text-xl font-bold mb-2">Quick Actions</h3>
                  <p className="text-white/80 text-sm">Manage your WhatsApp business efficiently</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => router.push('/')}
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition"
                  >
                    Go to Inbox
                  </button>
                  <button 
                    onClick={() => router.push('/bot-management')}
                    className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition"
                  >
                    Bot Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case 'clientdashboard':
        return <ClientDashboard />;

      case 'contacts':
        return <ContactManager />;

      case 'broadcasting':
        return <Broadcasting />;

      case 'templates':
        return <TemplateManager />;

      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen bg-[#111b21] relative">
      {/* Sidebar */}
      <div className="w-72 bg-[#202c33] border-r border-[#2a3942] flex flex-col">
        {/* Logo */}
        <div className="p-6 border-b border-[#2a3942]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-full flex items-center justify-center text-white font-bold text-xl">
              C
            </div>
            <div>
              <h1 className="text-white font-bold text-xl">Bovtt</h1>
              <p className="text-[#00a884] text-xs">Dashboard</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <div className="flex-1 py-6">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 transition-all ${
                activeTab === item.id
                  ? 'bg-[#2a3942] border-l-4 border-l-[#00a884] text-white'
                  : 'text-[#8696a0] hover:bg-[#2a3942] hover:text-white'
              }`}
            >
              <span className={`text-xl ${item.color}`}>{item.icon}</span>
              <span className="font-medium">{item.label}</span>
              {item.id === 'dashboard' && stats.unreadCount > 0 && (
                <span className="ml-auto bg-[#00a884] text-white text-xs rounded-full px-2 py-0.5">
                  {stats.unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* User Info */}
        <div className="p-4 border-t border-[#2a3942]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-full flex items-center justify-center text-white font-bold">
              A
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-medium">Admin User</p>
              <p className="text-[#8696a0] text-xs">admin@yourcompany.com</p>
            </div>
            <button 
              onClick={() => router.push('/')}
              className="text-[#8696a0] hover:text-white transition"
              title="Go to Inbox"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00a884] mx-auto mb-4"></div>
                <p className="text-white">Loading dashboard...</p>
              </div>
            </div>
          ) : (
            renderContent()
          )}
        </div>
      </div>

      {/* Floating Chat Button */}
      <button
  onClick={() => router.push('/')}
  className="fixed bottom-8 right-8 z-50 bg-[#00a884] hover:bg-[#008f6e] text-white rounded-full p-4 shadow-lg transition-all duration-300 hover:scale-110 group"
  title="Go to Inbox"
>
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
  </svg>
</button>

      {/* Chat Modal */}
      {showChatModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#202c33] p-4 border-b border-[#2a3942] flex justify-between items-center">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                Chat with Clients
              </h3>
              <button
                onClick={() => {
                  setShowChatModal(false);
                  setSelectedContact(null);
                  setSearchTerm('');
                }}
                className="text-white text-2xl hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            {!selectedContact ? (
              <div className="p-4">
                <div className="mb-4">
                  <div className="bg-[#2a3942] rounded-lg p-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="bg-transparent flex-1 text-white outline-none text-sm"
                    />
                  </div>
                </div>
                
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredContacts.length === 0 ? (
                    <p className="text-center text-[#8696a0] py-8">No contacts found</p>
                  ) : (
                    filteredContacts.map((contact) => {
                      const status = getStatusBadge(contact.label);
                      return (
                        <button
                          key={contact.id}
                          onClick={() => setSelectedContact(contact)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-[#2a3942] rounded-lg transition text-left"
                        >
                          <div className="w-10 h-10 bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-full flex items-center justify-center text-white font-bold">
                            {contact.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium">{contact.name}</p>
                            <p className="text-[#8696a0] text-xs">{contact.phone}</p>
                          </div>
                          <div className={`w-2 h-2 rounded-full ${status.color}`}></div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : (
              <div className="p-4">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="flex items-center gap-2 text-[#00a884] text-sm mb-4 hover:underline"
                >
                  ← Back to contacts
                </button>
                
                <div className="bg-[#2a3942] rounded-lg p-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {selectedContact.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-semibold">{selectedContact.name}</p>
                      <p className="text-[#8696a0] text-xs">{selectedContact.phone}</p>
                    </div>
                    {(() => {
                      const status = getStatusBadge(selectedContact.label);
                      return (
                        <span className={`px-2 py-1 rounded-full text-xs text-white ${status.color}`}>
                          {status.text}
                        </span>
                      );
                    })()}
                  </div>
                </div>
                
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Message</label>
                  <textarea
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    rows={4}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-3 outline-none focus:ring-1 focus:ring-[#00a884] resize-none"
                    placeholder="Type your message here..."
                    autoFocus
                  />
                </div>
                
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sending}
                    className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
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
                  <button
                    onClick={() => {
                      setSelectedContact(null);
                      setMessageText('');
                    }}
                    className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}