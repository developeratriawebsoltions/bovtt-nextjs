// app/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import BotManager from './components/BotManager';

interface Message {
  id: number;
  phone: string;
  message: string;
  type: string;
  media_url: string | null;
  media_id: string | null;
  local_file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  message_id: string | null;
  status: string;
  direction: 'incoming' | 'outgoing';
  created_at: string;
  updated_at: string;
  is_read: boolean;
  is_template?: boolean;
  template_name?: string;
}

interface Conversation {
  phone: string;
  last_message: string;
  last_time: string;
  last_type: string;
  unread_count: number;
  contact_name?: string;
  contact_label?: 'green' | 'yellow' | 'red' | 'none';
}

interface User {
  id: number;
  username: string;
  email: string;
  role: string;
}

type FilterType = 'all' | 'green' | 'yellow' | 'red' | 'unlabeled';

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentPhone, setCurrentPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [showContactModal, setShowContactModal] = useState(false);
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [contactName, setContactName] = useState('');
  const [contactLabel, setContactLabel] = useState<'green' | 'yellow' | 'red' | 'none'>('none');
  const [savingContact, setSavingContact] = useState(false);
  const [totalUnread, setTotalUnread] = useState(0);
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState('');
  const [lastUnreadCount, setLastUnreadCount] = useState(0);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [showBotManager, setShowBotManager] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [templatesCache, setTemplatesCache] = useState<Record<string, any>>({}); // ← ADD HERE
  const [showUpdates, setShowUpdates] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollingInterval = useRef<NodeJS.Timeout>(null);
  const lastMessageId = useRef(0);
  const firstMessageId = useRef(0);
  const isScrollingUp = useRef(false);
  const previousScrollHeight = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
      } else {
        router.push('/login');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      router.push('/login');
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };


useEffect(() => {
    if (user) {
      fetchConversations();
      fetchUnreadCounts();
      fetchTemplatesCache(); // ← ADD THIS LINE
      const interval = setInterval(() => {
        fetchConversations();
        fetchUnreadCounts();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Fetch conversations on load
  useEffect(() => {
    if (user) {
      fetchConversations();
      fetchUnreadCounts();
      const interval = setInterval(() => {
        fetchConversations();
        fetchUnreadCounts();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Fetch messages when phone changes
  useEffect(() => {
    if (currentPhone) {
      // Reset pagination state
      setMessages([]);
      lastMessageId.current = 0;
      firstMessageId.current = 0;
      setHasMoreMessages(true);
      fetchMessages(currentPhone, true);
      startPolling(currentPhone);
      markMessagesAsRead(currentPhone);
    }
    return () => {
      if (pollingInterval.current) clearInterval(pollingInterval.current);
    };
  }, [currentPhone]);

  // Update browser title with unread count
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread}) Bovtt`;
    } else {
      document.title = 'Bovtt';
    }
  }, [totalUnread]);

  // Show notification for new messages
  useEffect(() => {
    if (totalUnread > lastUnreadCount && totalUnread > 0 && currentPhone === null) {
      const newMessages = totalUnread - lastUnreadCount;
      setNotificationMessage(`${newMessages} new message${newMessages > 1 ? 's' : ''}`);
      setShowNotification(true);
      
      if (Notification.permission === "granted") {
        new Notification('New WhatsApp Message', {
          body: `You have ${newMessages} new message${newMessages > 1 ? 's' : ''}`,
          icon: '/favicon.ico'
        });
      }
      
      setTimeout(() => setShowNotification(false), 5000);
    }
    setLastUnreadCount(totalUnread);
  }, [totalUnread, currentPhone]);

  // Request notification permission on load
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const fetchUnreadCounts = async () => {
    try {
      const response = await fetch('/api/unread-count');
      const data = await response.json();
      if (data.success) {
        setTotalUnread(data.total_unread);
        
        // Update individual conversation unread counts
        if (data.unread_by_phone) {
          setConversations(prev => prev.map(conv => {
            const unreadData = data.unread_by_phone.find((u: any) => u.phone === conv.phone);
            return {
              ...conv,
              unread_count: unreadData ? unreadData.unread_count : 0
            };
          }));
        }
      }
    } catch (error) {
      console.error('Error fetching unread counts:', error);
    }
  };

  const fetchConversations = async () => {
    try {
      const response = await fetch('/api/conversations');
      const data = await response.json();
      if (data.success) {
        setConversations(data.conversations);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  const fetchTemplatesCache = async () => {
    try {
      const res = await fetch('/api/bot/templates');
      const data = await res.json();
      if (data.success && data.templates) {
        const cache: Record<string, any> = {};
        data.templates.forEach((t: any) => {
          cache[t.name] = t;
        });
        setTemplatesCache(cache);
      }
    } catch (err) {
      console.error('Failed to fetch templates cache:', err);
    }
  };

  const fetchMessages = async (phone: string, isInitial = false, loadMore = false) => {
    try {
      let url = `/api/messages?phone=${encodeURIComponent(phone)}`;
      
      if (loadMore && firstMessageId.current > 0) {
        url += `&beforeId=${firstMessageId.current}`;
      } else if (!isInitial && lastMessageId.current > 0) {
        url += `&lastId=${lastMessageId.current}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success && data.messages.length > 0) {
        if (loadMore) {
          // Load older messages - preserve scroll position
          const container = messagesContainerRef.current;
          if (container) {
            previousScrollHeight.current = container.scrollHeight;
          }
          
          setMessages(prev => [...data.messages, ...prev]);
          
          // Update first message ID for pagination
          firstMessageId.current = data.messages[0]?.id || 0;
          
          // Restore scroll position after adding older messages
          setTimeout(() => {
            if (container && previousScrollHeight.current) {
              const newScrollHeight = container.scrollHeight;
              container.scrollTop = newScrollHeight - previousScrollHeight.current;
            }
          }, 100);
        } else if (isInitial) {
          setMessages(data.messages);
          if (data.messages.length > 0) {
            lastMessageId.current = data.messages[data.messages.length - 1].id;
            firstMessageId.current = data.messages[0]?.id || 0;
          }
          setHasMoreMessages(data.messages.length >= 50);
          
          // Auto-scroll to bottom only on initial load
          setTimeout(() => {
            if (messagesContainerRef.current) {
              messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
            }
          }, 100);
        } else {
          // New messages - append to bottom
          setMessages(prev => [...prev, ...data.messages]);
          lastMessageId.current = data.messages[data.messages.length - 1].id;
          
          // Auto-scroll to bottom only if already at bottom
          const container = messagesContainerRef.current;
          if (container && !isScrollingUp.current) {
            const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
            if (isAtBottom) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }
          }
        }
        
        // Mark new incoming messages as read if this conversation is open
        const newUnreadMessages = data.messages.filter(
          (msg: Message) => msg.direction === 'incoming' && !msg.is_read
        );
        
        if (newUnreadMessages.length > 0 && currentPhone === phone && !loadMore) {
          markMessagesAsRead(phone, newUnreadMessages.map((m: Message) => m.id));
        }
      } else if (loadMore) {
        setHasMoreMessages(false);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const startPolling = (phone: string) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);
    pollingInterval.current = setInterval(() => {
      if (currentPhone === phone) {
        fetchMessages(phone, false, false);
      }
    }, 3000);
  };

  const markMessagesAsRead = async (phone: string, messageIds?: number[]) => {
    try {
      const response = await fetch('/api/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, messageIds })
      });
      
      const data = await response.json();
      if (data.success) {
        // Update unread count in UI immediately
        setConversations(prev => prev.map(conv => 
          conv.phone === phone 
            ? { ...conv, unread_count: 0 }
            : conv
        ));
        
        if (currentPhone === phone) {
          setMessages(prev => prev.map(msg => 
            msg.direction === 'incoming' && !msg.is_read
              ? { ...msg, is_read: true }
              : msg
          ));
        }
        
        fetchUnreadCounts();
      }
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const sendMessage = async () => {
    if ((!inputMessage.trim() && !selectedFile) || !currentPhone) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('phone', currentPhone);
    formData.append('message', inputMessage);
    if (selectedFile) {
      formData.append('file', selectedFile);
    }

    try {
      const response = await fetch('/api/send', {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      
      if (data.success) {
        setInputMessage('');
        setSelectedFile(null);
        fetchMessages(currentPhone, false, false);
      } else {
        alert('Failed to send message: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const loadOlderMessages = async () => {
    if (isLoadingHistory || !hasMoreMessages || !currentPhone) return;
    
    setIsLoadingHistory(true);
    await fetchMessages(currentPhone, false, true);
    setIsLoadingHistory(false);
  };

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // Check if user is scrolling up
    isScrollingUp.current = container.scrollTop < (previousScrollHeight.current - container.scrollHeight);
    
    // Load older messages when scrolling near the top
    if (container.scrollTop < 100 && hasMoreMessages && !isLoadingHistory) {
      loadOlderMessages();
    }
  }, [hasMoreMessages, isLoadingHistory, currentPhone]);

  const saveContactToDatabase = async () => {
    if (!editingPhone || !contactName.trim()) return;
    
    setSavingContact(true);
    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: editingPhone,
          name: contactName.trim(),
          label: contactLabel
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchConversations();
        setShowContactModal(false);
        setEditingPhone(null);
        setContactName('');
        setContactLabel('none');
      } else {
        alert('Failed to save contact: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error saving contact:', error);
      alert('Failed to save contact');
    } finally {
      setSavingContact(false);
    }
  };
const clearChat = async (phone: string) => {
  if (!confirm('Clear all chat messages?')) return;

  try {
    const res = await fetch('/api/clear-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();

    if (data.success) {
      setMessages([]);
      setCurrentPhone(null);
      await fetchConversations();
      await fetchUnreadCounts();
    }
  } catch (err) {
    console.error(err);
  }
};
  const deleteContactFromDatabase = async (phone: string) => {
    if (!confirm('Delete this contact?')) return;
    
    try {
      const response = await fetch(`/api/contacts?phone=${encodeURIComponent(phone)}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchConversations();
        setShowContactModal(false);
        setEditingPhone(null);
      } else {
        alert('Failed to delete contact');
      }
    } catch (error) {
      console.error('Error deleting contact:', error);
      alert('Failed to delete contact');
    }
  };

  const openContactModal = (phone: string) => {
    const contact = conversations.find(c => c.phone === phone);
    setEditingPhone(phone);
    setContactName(contact?.contact_name || '');
    setContactLabel(contact?.contact_label || 'none');
    setShowContactModal(true);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getAvatarColor = (phone: string) => {
    let hash = 0;
    for (let i = 0; i < phone.length; i++) {
      hash = ((hash << 5) - hash) + phone.charCodeAt(i);
      hash = hash & 0x7FFFFFFF;
    }
    return `hsl(${hash % 360}, 55%, 45%)`;
  };

  const getLabelColor = (label?: string) => {
    switch (label) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const renderMessageContent = (msg: Message) => {
    const mediaUrl = msg.local_file_path 
      ? `${process.env.NEXT_PUBLIC_MEDIA_BASE_URL || 'https://your-webhook-domain.com'}${msg.local_file_path}`
      : msg.media_url;


    if (msg.type === 'template' || msg.message?.startsWith('[Template:')) {
      const name = msg.message?.match(/\[Template: (.+?)\]/)?.[1] || 'Template';
      const tpl = templatesCache[name];
      const header  = tpl?.components?.find((c: any) => c.type === 'HEADER');
      const body    = tpl?.components?.find((c: any) => c.type === 'BODY');
      const footer  = tpl?.components?.find((c: any) => c.type === 'FOOTER');
      const buttons = tpl?.components?.find((c: any) => c.type === 'BUTTONS');

      if (!tpl) {
        return (
          <div className="flex items-center gap-2 text-sm">
            <span style={{ fontSize: 16 }}>📨</span>
            <div>
              <p className="text-white font-medium">{name}</p>
              <p className="text-[#8696a0] text-xs">WhatsApp template sent</p>
            </div>
          </div>
        );
      }

      return (
        <div className="min-w-[220px] max-w-[280px]">
          {header?.format === 'TEXT' && (
            <p className="text-white font-semibold text-sm mb-2">{header.text}</p>
          )}
          {header?.format === 'IMAGE' && (
            <div className="bg-[#3a4a54] rounded-lg p-3 text-center mb-2">
              <span style={{ fontSize: 24 }}>🖼️</span>
              <p className="text-[#8696a0] text-xs mt-1">Image header</p>
            </div>
          )}
          {header?.format === 'VIDEO' && (
            <div className="bg-[#3a4a54] rounded-lg p-3 text-center mb-2">
              <span style={{ fontSize: 24 }}>🎬</span>
              <p className="text-[#8696a0] text-xs mt-1">Video header</p>
            </div>
          )}
          {header?.format === 'DOCUMENT' && (
            <div className="bg-[#3a4a54] rounded-lg p-3 text-center mb-2">
              <span style={{ fontSize: 24 }}>📄</span>
              <p className="text-[#8696a0] text-xs mt-1">Document header</p>
            </div>
          )}
          {body?.text && (
            <p className="text-white text-sm whitespace-pre-wrap leading-relaxed">
              {body.text}
            </p>
          )}
          {footer?.text && (
            <p className="text-[#8696a0] text-xs mt-2 pt-2 border-t border-[#3a4a54]">
              {footer.text}
            </p>
          )}
          {buttons?.buttons && (
            <div className="mt-3 flex flex-col gap-1.5">
              {buttons.buttons.map((btn: any, idx: number) => (
                <div
                  key={idx}
                  className={`text-center py-1.5 rounded-lg text-xs font-medium border ${
                    btn.type === 'FLOW'
                      ? 'border-purple-500/40 text-purple-300 bg-purple-500/10'
                      : 'border-[#00a884]/30 text-[#00a884] bg-[#00a884]/10'
                  }`}
                >
                  {btn.type === 'FLOW' ? '🔄 ' : ''}{btn.text}
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 pt-2 border-t border-[#3a4a54] flex items-center gap-1">
            <span style={{ fontSize: 10 }}>📨</span>
            <span className="text-[#8696a0] text-[10px]">{name}</span>
          </div>
        </div>
      );
    }

    // ── FLOW RESPONSE (incoming) ────────────────────────────────────────────
   // ── FLOW RESPONSE (incoming) ────────────────────────────────────────────
if (msg.type === 'flow_response' || 
    (msg.type === 'interactive' && msg.message?.includes('[META FLOW COMPLETED]'))) {
  
  let fields: { label: string; value: string; type: 'text' | 'check' | 'select' }[] = [];
  let templateName = '';

  if (msg.message?.startsWith('📋')) {
    // New clean format: "📋 *template_name*\nField: Value\nField2: Value2"
    const lines = msg.message.split('\n');
    
    // Extract template name from first line "📋 *template_name*"
    const headerLine = lines[0];
    templateName = headerLine.replace('📋 *', '').replace('*', '').trim();
    
    fields = lines.slice(1)
      .filter(line => line.includes(':'))
      .map(line => {
        const colonIdx = line.indexOf(':');
        const label = line.substring(0, colonIdx).trim();
        const value = line.substring(colonIdx + 1).trim();
        
        // Detect field type from value
        let type: 'text' | 'check' | 'select' = 'text';
        if (value === 'true' || value === 'false' || value === 'Yes' || value === 'No') {
          type = 'check';
        } else if (value.includes(',')) {
          type = 'select'; // multiple selections
        }
        
        return { label, value, type };
      })
      .filter(f => f.label && f.value);

  } else if (msg.message?.includes('[META FLOW COMPLETED]')) {
    // Old format fallback
    try {
      const jsonMatch = msg.message.match(/\{.+\}/);
      const templateMatch = msg.message.match(/Template: ([^\s|]+)/);
      templateName = templateMatch?.[1] || '';
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        fields = Object.entries(parsed)
          .filter(([key]) => key !== 'flow_token')
          .map(([key, value]) => {
            const strVal = String(value);
            let type: 'text' | 'check' | 'select' = 'text';
            if (strVal === 'true' || strVal === 'false' || strVal === 'Yes' || strVal === 'No') {
              type = 'check';
            } else if (strVal.includes(',')) {
              type = 'select';
            }
            return {
              label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              value: strVal,
              type,
            };
          });
      }
    } catch {
      return <div className="text-sm text-[#8696a0] italic">Form submitted</div>;
    }
  }

  if (fields.length === 0) {
    return <div className="text-sm text-[#8696a0] italic">Form submitted</div>;
  }

  return (
    <div className="min-w-[240px] max-w-[300px]">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#3a4a54]">
        <span style={{ fontSize: 16 }}>📋</span>
        <div>
          <p className="text-[#00a884] text-xs font-semibold uppercase tracking-wide">
            Your Response
          </p>
          {templateName && (
            <p className="text-[#8696a0] text-[10px] mt-0.5">{templateName}</p>
          )}
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-3">
        {fields.map((field, idx) => (
          <div key={idx}>
            {/* Field label */}
            <p className="text-[#8696a0] text-[10px] uppercase tracking-wide mb-1">
              {field.label}
            </p>

            {/* Checkbox / boolean */}
            {field.type === 'check' && (
              <div className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded flex items-center justify-center ${
                  field.value === 'true' || field.value === 'Yes' 
                    ? 'bg-[#00a884]' 
                    : 'bg-[#3a4a54] border border-[#8696a0]'
                }`}>
                  {(field.value === 'true' || field.value === 'Yes') && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="text-white text-sm font-medium">{field.value}</span>
              </div>
            )}

            {/* Multiple selections (comma separated) */}
            {field.type === 'select' && (
              <div className="flex flex-wrap gap-1">
                {field.value.split(',').map((v, i) => (
                  <span
                    key={i}
                    className="bg-[#00a884]/20 text-[#00a884] text-xs px-2 py-0.5 rounded-full border border-[#00a884]/30"
                  >
                    {v.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Regular text */}
            {field.type === 'text' && (
              <p className="text-white text-sm font-medium">{field.value}</p>
            )}

            {idx < fields.length - 1 && (
              <div className="mt-3 border-b border-[#2a3942]" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
    // ── END OF NEW BLOCK ──────────────────────────────────────────────────────
    if (msg.type === 'image') {
    if (mediaUrl) {
      return (
        <div>
          <img
            src={mediaUrl}
            alt="Image"
            className="max-w-[250px] max-h-[250px] rounded-lg cursor-pointer"
            onClick={() => window.open(mediaUrl, '_blank')}
          />
          {msg.message && msg.message !== '' && (
            <p className="text-sm text-white mt-1 whitespace-pre-wrap">{msg.message}</p>
          )}
        </div>
      );
    }
    // Outgoing bot media node — has media_id but no local URL (sent via WhatsApp media ID)
    return (
      <div className="flex items-center gap-3 bg-[#2a3942] rounded-lg p-3 min-w-[180px]">
        <div className="w-10 h-10 bg-teal-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <span style={{ fontSize: 20 }}>🖼️</span>
        </div>
        <div>
          <p className="text-white text-sm font-medium">Image sent</p>
          {msg.message && msg.message !== '' && (
            <p className="text-[#8696a0] text-xs mt-0.5">{msg.message}</p>
          )}
          <p className="text-teal-400 text-[10px] mt-0.5">via WhatsApp</p>
        </div>
      </div>
    );
  }
 
  // ── VIDEO ────────────────────────────────────────────────────────────────────
  if (msg.type === 'video') {
    if (mediaUrl) {
      return (
        <div>
          <video controls className="max-w-[250px] rounded-lg">
            <source src={mediaUrl} />
          </video>
          {msg.message && msg.message !== '' && (
            <p className="text-sm text-white mt-1 whitespace-pre-wrap">{msg.message}</p>
          )}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 bg-[#2a3942] rounded-lg p-3 min-w-[180px]">
        <div className="w-10 h-10 bg-teal-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <span style={{ fontSize: 20 }}>🎬</span>
        </div>
        <div>
          <p className="text-white text-sm font-medium">Video sent</p>
          {msg.message && msg.message !== '' && (
            <p className="text-[#8696a0] text-xs mt-0.5">{msg.message}</p>
          )}
          <p className="text-teal-400 text-[10px] mt-0.5">via WhatsApp</p>
        </div>
      </div>
    );
  }
 
  // ── AUDIO ────────────────────────────────────────────────────────────────────
  if (msg.type === 'audio') {
    if (mediaUrl) {
      return <audio controls className="w-[200px]"><source src={mediaUrl} /></audio>;
    }
    return (
      <div className="flex items-center gap-3 bg-[#2a3942] rounded-lg p-3 min-w-[180px]">
        <div className="w-10 h-10 bg-teal-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <span style={{ fontSize: 20 }}>🎵</span>
        </div>
        <div>
          <p className="text-white text-sm font-medium">Audio sent</p>
          <p className="text-teal-400 text-[10px] mt-0.5">via WhatsApp</p>
        </div>
      </div>
    );
  }
 
  // ── DOCUMENT ─────────────────────────────────────────────────────────────────
  if (msg.type === 'document') {
    const fileName = msg.message && msg.message !== '' ? msg.message : 'Document';
    if (mediaUrl) {
      return (
        <div
          className="flex items-center gap-2 cursor-pointer hover:bg-[#2a3942] p-2 rounded"
          onClick={() => window.open(mediaUrl, '_blank')}
        >
          <span className="text-2xl">📄</span>
          <div>
            <p className="text-sm font-medium">{fileName}</p>
            <p className="text-xs text-[#8696a0]">
              {msg.file_size ? `${(msg.file_size / 1024).toFixed(1)} KB` : 'Click to download'}
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-3 bg-[#2a3942] rounded-lg p-3 min-w-[180px]">
        <div className="w-10 h-10 bg-teal-600/30 rounded-lg flex items-center justify-center flex-shrink-0">
          <span style={{ fontSize: 20 }}>📄</span>
        </div>
        <div>
          <p className="text-white text-sm font-medium">{fileName}</p>
          <p className="text-teal-400 text-[10px] mt-0.5">Document sent via WhatsApp</p>
        </div>
      </div>
    );
  }
 
  // ── STICKER ───────────────────────────────────────────────────────────────────
  if (msg.type === 'sticker') {
    if (mediaUrl) {
      return (
        <img
          src={mediaUrl}
          alt="Sticker"
          className="max-w-[120px] max-h-[120px]"
        />
      );
    }
    return <span className="text-2xl">🎭</span>;
  }
 
    
    const formattedMessage = msg.message?.replace(/\n/g, '<br/>') || 'Media message';
    
    return (
      <div 
        className="text-sm whitespace-pre-wrap break-words"
        dangerouslySetInnerHTML={{ __html: formattedMessage }}
      />
    );
  };

  const getStatusIcon = (status: string) => {
    if (status === 'read') return '✓✓';
    if (status === 'delivered') return '✓✓';
    if (status === 'sent') return '✓';
    return '⏳';
  };

  const emojis = ['😀', '😂', '❤️', '😍', '👍', '🎉', '🔥', '👋', '😎', '🤔', '😢', '😡', '🥺', '😱', '🤣', '😊'];

  const filteredConversations = conversations.filter(conv => {
    const displayName = conv.contact_name || conv.phone;
    const searchMatch = displayName.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (!searchMatch) return false;
    
    if (filterType === 'all') return true;
    if (filterType === 'unlabeled') return !conv.contact_label || conv.contact_label === 'none';
    return conv.contact_label === filterType;
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#111b21]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00a884] mx-auto mb-4"></div>
          <p className="text-white">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#111b21]">
      {/* Updates Modal */}
{showUpdates && (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
    <div className="bg-[#202c33] rounded-xl w-full max-w-lg shadow-2xl border border-[#00a884]/30">
      {/* Header */}
      <div className="p-5 border-b border-[#2a3942] flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#00a884]/20 flex items-center justify-center animate-pulse">
            <span style={{ fontSize: 18 }}>🚀</span>
          </div>
          <div>
            <h2 className="text-white font-bold text-lg">New Update by <a href="https://atriawebsolutions.com" target="_blank">Atria</a></h2>
            <p className="text-[#00a884] text-xs">Latest updates & features</p>
          </div>
        </div>
        <button onClick={() => setShowUpdates(false)} className="text-[#8696a0] hover:text-white text-xl">✕</button>
      </div>

      {/* Updates List */}
      <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
        {[
           {
            version: 'v1.4.0',
            date: 'May 7 2026',
            color: 'text-[#00a884]',
            bg: 'bg-[#00a884]/10 border-[#00a884]/30',
            dot: 'bg-[#00a884]',
            items: [
              '📎 User Can send flow Images to clients',
              '📎 User Can send flow Videos to clients',
              '📎 User Can send flow Documents to clients',
              '📎 User Can send flow Audios to clients',
            ],
          },
          {
            version: 'v1.3.0',
            date: 'May 2026',
            color: 'text-[#00a884]',
            bg: 'bg-[#00a884]/10 border-[#00a884]/30',
            dot: 'bg-[#00a884]',
            items: [
              '✅ Multi-select & bulk delete contacts',
              '✅ Group Members filtering',
              '✅ CSV / Excel bulk upload with preview',
              '✅ Per-contact chat clear from contact modal',
            ],
          },
          {
            version: 'v1.2.0',
            date: 'Apr 2026',
            color: 'text-blue-400',
            bg: 'bg-blue-500/10 border-blue-500/30',
            dot: 'bg-blue-400',
            items: [
              '🤖 Bot Manager with flow & template support',
              '📋 Flow response renderer in chat',
              '📊 Analytics dashboard',
            ],
          },
          {
            version: 'v1.1.0',
            date: 'Mar 2026',
            color: 'text-yellow-400',
            bg: 'bg-yellow-500/10 border-yellow-500/30',
            dot: 'bg-yellow-400',
            items: [
              '💬 Real-time mail for support messages',
              '📎 File & media message support',
              '🔖 Contact labels & names',
              '🔍 Conversation search & filter',
            ],
          },
        ].map((update) => (
          <div key={update.version} className={`rounded-xl border p-4 ${update.bg}`}>
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-2 h-2 rounded-full ${update.dot}`}></div>
              <span className={`font-bold text-sm ${update.color}`}>{update.version}</span>
              <span className="text-[#8696a0] text-xs ml-auto">{update.date}</span>
            </div>
            <ul className="space-y-1.5">
              {update.items.map((item, i) => (
                <li key={i} className="text-[#e9edef] text-sm">{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-[#2a3942] text-center text-[#8696a0] text-xs">
        Built by Atria Web Solutions
      </div>
    </div>
  </div>
)}

      {/* Bot Manager Modal */}
      {showBotManager && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-5xl max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-[#202c33] p-4 border-b border-[#2a3942] flex justify-between items-center">
              <h2 className="text-xl font-semibold text-white">🤖 Bot Management</h2>
              <button 
                onClick={() => setShowBotManager(false)} 
                className="text-white text-2xl hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <div className="p-6">
              <BotManager />
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {showNotification && (
        <div className="fixed top-4 right-4 bg-[#00a884] text-white px-4 py-3 rounded-lg shadow-lg z-50 animate-bounce flex items-center gap-2">
          <span className="text-xl">🔔</span>
          <span>{notificationMessage}</span>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.*"
        className="hidden"
      />

      {/* Contact Modal */}
      {showContactModal && editingPhone && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg p-6 w-96">
            <h3 className="text-white text-xl font-semibold mb-4">Save Contact</h3>
            <div className="mb-4">
              <label className="block text-[#8696a0] text-sm mb-2">Phone Number</label>
              <input
                type="text"
                value={editingPhone}
                disabled
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none"
              />
            </div>
            <div className="mb-4">
              <label className="block text-[#8696a0] text-sm mb-2">Contact Name</label>
              <input
                type="text"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Enter contact name"
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none"
              />
            </div>
            <div className="mb-6">
              <label className="block text-[#8696a0] text-sm mb-2">Label</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setContactLabel('green')}
                  className={`flex-1 py-2 rounded-lg ${contactLabel === 'green' ? 'bg-green-500' : 'bg-gray-600'} text-white`}
                >
                  🟢 Green
                </button>
                <button
                  onClick={() => setContactLabel('yellow')}
                  className={`flex-1 py-2 rounded-lg ${contactLabel === 'yellow' ? 'bg-yellow-500' : 'bg-gray-600'} text-white`}
                >
                  🟡 Yellow
                </button>
                <button
                  onClick={() => setContactLabel('red')}
                  className={`flex-1 py-2 rounded-lg ${contactLabel === 'red' ? 'bg-red-500' : 'bg-gray-600'} text-white`}
                >
                  🔴 Red
                </button>
                <button
                  onClick={() => setContactLabel('none')}
                  className={`flex-1 py-2 rounded-lg ${contactLabel === 'none' ? 'bg-gray-400' : 'bg-gray-600'} text-white`}
                >
                  None
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={saveContactToDatabase}
                disabled={savingContact || !contactName.trim()}
                className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50"
              >
                {savingContact ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => {
                  setShowContactModal(false);
                  setEditingPhone(null);
                }}
                className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
            {conversations.find(c => c.phone === editingPhone)?.contact_name && (
              <button
                onClick={() => deleteContactFromDatabase(editingPhone)}
                className="w-full mt-3 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700"
              >
                Delete Contact
              </button>
            )}
            {editingPhone && (
            <button
              onClick={() => clearChat(editingPhone)}
              className="w-full mt-3 bg-[#2a3942] text-red-400 py-2 rounded-lg hover:bg-[#323f47] border border-red-400"
            >
              🗑️ Clear Chat
            </button>
          )}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="w-[380px] bg-[#111b21] border-r border-[#2a3942] flex flex-col">
        {/* Header with User Info and Dropdown Menu */}
        <div className="bg-[#202c33] p-4 flex items-center justify-between border-b border-[#2a3942]">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 bg-gradient-to-r from-[#25D366] to-[#128C7E] rounded-full flex items-center justify-center text-white font-bold text-xl">
                {user?.username?.charAt(0).toUpperCase() || 'C'}
              </div>
              {totalUnread > 0 && (
                <div className="absolute -top-1 -right-1 bg-[#00a884] text-white text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center shadow-lg">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-white font-semibold">Bovtt</h1>
              <p className="text-[#25D366] text-xs">Welcome, {user?.username}</p>
            </div>
          </div>
          <div className="flex gap-3 text-[#aebac1] relative">
            <button 
              onClick={() => setShowBotManager(true)} 
              className="hover:text-white transition" 
              title="Bot Settings"
            >
              {/* <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg> */}
            </button>
            {/* <i className="fas fa-camera cursor-pointer hover:text-white"></i> */}
            
            {/* Three Dots Menu Button */}
            <div className="relative" ref={menuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="hover:text-white transition focus:outline-none"
                title="Menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </button>
              
              {/* Dropdown Menu */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-[#202c33] rounded-lg shadow-lg border border-[#2a3942] z-50 overflow-hidden">
                  {/* User Info Section */}
                  <div className="px-4 py-3 border-b border-[#2a3942]">
                    <p className="text-white text-sm font-medium">{user?.username}</p>
                    <p className="text-[#8696a0] text-xs mt-1">{user?.email}</p>
                    <p className="text-[#00a884] text-xs mt-1 capitalize">{user?.role}</p>
                  </div>
                  
                  {/* Menu Items */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        router.push('/dashboard');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a3942] transition flex items-center gap-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      Dashboard
                    </button>
                    
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        router.push('/analytics');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a3942] transition flex items-center gap-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Analytics
                    </button>
                    
                    {/* <button
                      onClick={() => {
                        setShowUserMenu(false);
                        router.push('/settings');
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a3942] transition flex items-center gap-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </button> */}
                    
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        setShowBotManager(true);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a3942] transition flex items-center gap-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Bot Manager
                    </button>

                    <button
                    onClick={() => {
                      setShowUserMenu(false);
                      setShowUpdates(true);
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-white hover:bg-[#2a3942] transition flex items-center gap-3"
                  >
                    <div className="relative">
                      <svg className="w-4 h-4 text-[#00a884]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#00a884] rounded-full animate-ping"></span>
                      <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#00a884] rounded-full"></span>
                    </div>
                    <span className="text-[#00a884] font-medium">What's New</span>
                    <span className="ml-auto bg-[#00a884] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">NEW</span>
                  </button>
                  </div>
                  
                  {/* Divider */}
                  <div className="border-t border-[#2a3942] my-1"></div>
                  
                  {/* Logout Button */}
                  <div className="py-1">
                    <button
                      onClick={() => {
                        setShowUserMenu(false);
                        handleLogout();
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-[#2a3942] transition flex items-center gap-3"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="p-3 bg-[#111b21] border-b border-[#2a3942]">
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setFilterType('all')}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition ${
                filterType === 'all' ? 'bg-[#00a884] text-white' : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('green')}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition ${
                filterType === 'green' ? 'bg-green-500 text-white' : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              🟢 Green
            </button>
            <button
              onClick={() => setFilterType('yellow')}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition ${
                filterType === 'yellow' ? 'bg-yellow-500 text-white' : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              🟡 Yellow
            </button>
            <button
              onClick={() => setFilterType('red')}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition ${
                filterType === 'red' ? 'bg-red-500 text-white' : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              🔴 Red
            </button>
            <button
              onClick={() => setFilterType('unlabeled')}
              className={`flex-1 py-1 px-2 rounded-lg text-xs font-medium transition ${
                filterType === 'unlabeled' ? 'bg-gray-500 text-white' : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              Unlabeled
            </button>
          </div>

          {/* Search */}
          <div className="bg-[#202c33] rounded-lg p-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or phone..."
              className="bg-transparent flex-1 text-white outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="text-center text-[#8696a0] p-8">
              <p>No conversations found</p>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const displayName = conv.contact_name || conv.phone;
              const hasUnread = conv.unread_count > 0;
              
              return (
                <div
                  key={conv.phone}
                  onClick={() => setCurrentPhone(conv.phone)}
                  className={`flex items-center gap-3 p-3 cursor-pointer transition-all duration-200 ${
                    currentPhone === conv.phone 
                      ? 'bg-[#2a3942]' 
                      : hasUnread 
                        ? 'bg-[#1f2c33] hover:bg-[#202c33] border-l-4 border-l-[#00a884]' 
                        : 'hover:bg-[#202c33]'
                  }`}
                >
                  <div className="relative">
                    <div
                      className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
                      style={{ background: getAvatarColor(conv.phone) }}
                    >
                      {displayName.charAt(0).toUpperCase()}
                    </div>
                    {conv.contact_label && conv.contact_label !== 'none' && (
                      <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${getLabelColor(conv.contact_label)} border-2 border-[#111b21]`}></div>
                    )}
                    {hasUnread && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#00a884] rounded-full animate-pulse border-2 border-[#111b21]"></div>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <span className={`${hasUnread ? 'text-[#00a884] font-bold' : 'text-white font-medium'} text-sm truncate`}>
                        {displayName}
                      </span>
                      {conv.last_time && (
                        <span className={`text-xs ${hasUnread ? 'text-[#00a884] font-medium' : 'text-[#8696a0]'}`}>
                          {formatTime(conv.last_time)}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center mt-1">
                      <p className={`${hasUnread ? 'text-[#e9edef] font-medium' : 'text-[#8696a0]'} text-sm truncate flex-1`}>
                        {conv.last_type === 'image' && '📷 '}
                        {conv.last_type === 'video' && '📹 '}
                        {conv.last_type === 'audio' && '🎵 '}
                        {conv.last_type === 'document' && '📄 '}
                        {conv.last_message?.replace(/\n/g, ' ') || 'No messages yet'}
                      </p>
                      
                      {conv.unread_count > 0 && (
                        <div className="bg-[#00a884] text-white text-xs font-bold rounded-full min-w-[22px] h-5 flex items-center justify-center px-1.5 ml-2 shadow-lg">
                          {conv.unread_count > 99 ? '99+' : conv.unread_count}
                        </div>
                      )}
                    </div>
                    
                    {hasUnread && (
                      <div className="text-[10px] text-[#00a884] mt-0.5 flex items-center gap-1">
                        <span className="inline-block w-1.5 h-1.5 bg-[#00a884] rounded-full"></span>
                        <span>New messages</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col bg-[#0b141a]">
        {currentPhone ? (
          <>
            {/* Chat Header */}
            <div className="bg-[#202c33] p-3 flex items-center justify-between border-b border-[#2a3942]">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm cursor-pointer"
                  style={{ background: getAvatarColor(currentPhone) }}
                  onClick={() => openContactModal(currentPhone)}
                >
                  {(conversations.find(c => c.phone === currentPhone)?.contact_name || currentPhone).charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 
                    className="text-white font-medium cursor-pointer hover:underline"
                    onClick={() => openContactModal(currentPhone)}
                  >
                    {conversations.find(c => c.phone === currentPhone)?.contact_name || currentPhone}
                  </h3>
                  <p className="text-[#25D366] text-xs">
                    {conversations.find(c => c.phone === currentPhone)?.contact_label && 
                     conversations.find(c => c.phone === currentPhone)?.contact_label !== 'none' 
                      ? `Label: ${conversations.find(c => c.phone === currentPhone)?.contact_label}` 
                      : 'Click to add contact'}
                  </p>
                </div>
              </div>
              <div className="flex gap-5 text-[#aebac1]">
                <button onClick={() => openContactModal(currentPhone)} className="hover:text-white">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Messages Container */}
            <div 
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-4 space-y-2"
            >
              {isLoadingHistory && (
                <div className="text-center text-[#8696a0] py-2">
                  <div className="inline-flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00a884]"></div>
                    <span className="text-xs">Loading older messages...</span>
                  </div>
                </div>
              )}
              
              {messages.length === 0 ? (
                <div className="text-center text-[#8696a0] mt-20">
                  <p>No messages yet</p>
                  <p className="text-sm">Send a message to start the conversation</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isUnread = msg.direction === 'incoming' && !msg.is_read;
                  
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outgoing' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[75%] p-3 rounded-xl ${
                          msg.direction === 'outgoing'
                            ? 'bg-[#005c4b] text-white rounded-br-none'
                            : isUnread 
                              ? 'bg-[#2a3942] text-white rounded-bl-none border-l-4 border-[#00a884]'
                              : 'bg-[#202c33] text-white rounded-bl-none'
                        }`}
                      >
                        {renderMessageContent(msg)}
                        <div className="flex items-center justify-end gap-1 mt-1">
                          <span className="text-[0.65rem] text-[#8696a0]">
                            {formatTime(msg.created_at)}
                          </span>
                          {msg.direction === 'outgoing' && (
                            <span className="text-[0.65rem] text-[#8696a0]">
                              {getStatusIcon(msg.status)}
                            </span>
                          )}
                          {isUnread && (
                            <span className="text-[0.65rem] text-[#00a884] ml-1 font-bold">
                              ● New
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Selected File Preview */}
            {selectedFile && (
              <div className="bg-[#202c33] p-2 mx-4 mb-2 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-white">
                  <span>📎</span>
                  <span>{selectedFile.name}</span>
                  <span className="text-[#8696a0] text-xs">
                    ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </span>
                </div>
                <button
                  onClick={() => setSelectedFile(null)}
                  className="text-red-400 hover:text-red-300"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Emoji Picker */}
            {showEmojiPicker && (
              <div className="bg-[#202c33] rounded-lg p-2 mx-4 mb-2 grid grid-cols-8 gap-1 max-w-md">
                {emojis.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setInputMessage(prev => prev + emoji);
                      setShowEmojiPicker(false);
                    }}
                    className="text-2xl hover:bg-[#2a3942] p-1 rounded transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <div className="bg-[#202c33] p-3 flex items-center gap-3 border-t border-[#2a3942]">
              <button
                onClick={handleFileSelect}
                className="text-[#aebac1] hover:text-white transition"
                title="Attach file"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                </svg>
              </button>
              
              <button
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="text-[#aebac1] hover:text-white transition"
                title="Emoji"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>

              <textarea
                className="flex-1 bg-[#2a3942] rounded-lg p-2 text-white outline-none resize-none text-sm"
                placeholder="Type a message or choose a quick reply..."
                rows={1}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              
              <button
                onClick={sendMessage}
                disabled={loading || (!inputMessage.trim() && !selectedFile)}
                className="bg-[#00a884] w-10 h-10 rounded-full flex items-center justify-center text-white hover:bg-[#008f6e] disabled:opacity-50 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-6xl mb-4 text-[#2a3942]">💬</div>
              <h2 className="text-[#e9edef] text-2xl mb-2">Bovtt</h2>
              <p className="text-[#8696a0]">Select a conversation to start messaging</p>
              <p className="text-[#8696a0] text-sm mt-4">🔒 End-to-end encrypted</p>
              <p className="text-[#8696a0] text-xs mt-2">✨ Customize bot responses in Bot Management</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}