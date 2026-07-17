'use client';

import { useState, useEffect } from 'react';

interface WhatsAppProfile {
  about?: string;
  address?: string;
  description?: string;
  email?: string;
  websites?: string[];
  vertical?: string;
  profile_picture_url?: string;
}

interface SettingsData {
  whatsappProfile: WhatsAppProfile | null;
  whatsappToken: string;
  whatsappPhoneId: string;
  wabaId: string;
  verifyToken: string;
  appUrl: string;
  dbHost: string;
  dbName: string;
  dbUser: string;
}

export default function Settings() {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'database' | 'bot'>('whatsapp');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<WhatsAppProfile>({
    about: '',
    address: '',
    description: '',
    email: '',
    websites: [''],
    vertical: 'UNDEFINED'
  });
  const [alert, setAlert] = useState<{ show: boolean; message: string; type: string }>({
    show: false,
    message: '',
    type: 'info'
  });
  
  // Database settings state
  const [dbSettings, setDbSettings] = useState({
    host: '',
    port: '3306',
    name: '',
    user: '',
    password: ''
  });

  // Bot settings state
  const [botSettings, setBotSettings] = useState({
    welcomeMessage: '',
    defaultReply: '',
    enableAutoReply: true,
    autoReplyDelay: 0
  });

  useEffect(() => {
    fetchWhatsAppProfile();
    fetchSettings();
  }, []);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: 'info' }), 3000);
  };

  const fetchWhatsAppProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/whatsapp-profile');
      const data = await response.json();
      if (data.success && data.profile) {
        setProfile({
          about: data.profile.about || '',
          address: data.profile.address || '',
          description: data.profile.description || '',
          email: data.profile.email || '',
          websites: data.profile.websites?.length ? data.profile.websites : [''],
          vertical: data.profile.vertical || 'UNDEFINED'
        });
      }
    } catch (error) {
      console.error('Error fetching WhatsApp profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/config');
      const data = await response.json();
      if (data.success) {
        setDbSettings({
          host: data.config.DB_HOST || '',
          port: data.config.DB_PORT || '3306',
          name: data.config.DB_NAME || '',
          user: data.config.DB_USER || '',
          password: ''
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const updateWhatsAppProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/whatsapp-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
      
      const data = await response.json();
      if (data.success) {
        showAlert('WhatsApp Business Profile updated successfully!', 'success');
      } else {
        showAlert(data.error || 'Failed to update profile', 'error');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      showAlert('Error updating profile', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateDatabaseSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/database', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbSettings)
      });
      
      const data = await response.json();
      if (data.success) {
        showAlert('Database settings updated successfully!', 'success');
      } else {
        showAlert(data.error || 'Failed to update database settings', 'error');
      }
    } catch (error) {
      console.error('Error updating database settings:', error);
      showAlert('Error updating database settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const updateBotSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/settings/bot', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(botSettings)
      });
      
      const data = await response.json();
      if (data.success) {
        showAlert('Bot settings updated successfully!', 'success');
      } else {
        showAlert(data.error || 'Failed to update bot settings', 'error');
      }
    } catch (error) {
      console.error('Error updating bot settings:', error);
      showAlert('Error updating bot settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleWebsiteChange = (index: number, value: string) => {
    const newWebsites = [...(profile.websites || [''])];
    newWebsites[index] = value;
    setProfile({ ...profile, websites: newWebsites });
  };

  const addWebsite = () => {
    setProfile({
      ...profile,
      websites: [...(profile.websites || ['']), '']
    });
  };

  const removeWebsite = (index: number) => {
    const newWebsites = (profile.websites || ['']).filter((_, i) => i !== index);
    setProfile({ ...profile, websites: newWebsites.length ? newWebsites : [''] });
  };

  const testDatabaseConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/test-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbSettings)
      });
      
      const data = await response.json();
      if (data.success) {
        showAlert('Database connection successful!', 'success');
      } else {
        showAlert(data.error || 'Database connection failed', 'error');
      }
    } catch (error) {
      console.error('Error testing database:', error);
      showAlert('Error testing database connection', 'error');
    } finally {
      setLoading(false);
    }
  };

  const testWhatsAppConnection = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/settings/test-whatsapp');
      const data = await response.json();
      if (data.success) {
        showAlert('WhatsApp connection successful!', 'success');
      } else {
        showAlert(data.error || 'WhatsApp connection failed', 'error');
      }
    } catch (error) {
      console.error('Error testing WhatsApp:', error);
      showAlert('Error testing WhatsApp connection', 'error');
    } finally {
      setLoading(false);
    }
  };

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
      <div>
        <h2 className="text-white text-xl font-semibold">Settings</h2>
        <p className="text-[#8696a0] text-sm mt-1">
          Configure your WhatsApp Business account and system settings
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2a3942]">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'whatsapp'
              ? 'text-[#00a884] border-b-2 border-[#00a884]'
              : 'text-[#8696a0] hover:text-white'
          }`}
        >
          WhatsApp Business
        </button>
        <button
          onClick={() => setActiveTab('database')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'database'
              ? 'text-[#00a884] border-b-2 border-[#00a884]'
              : 'text-[#8696a0] hover:text-white'
          }`}
        >
          Database
        </button>
        <button
          onClick={() => setActiveTab('bot')}
          className={`px-4 py-2 text-sm font-medium transition ${
            activeTab === 'bot'
              ? 'text-[#00a884] border-b-2 border-[#00a884]'
              : 'text-[#8696a0] hover:text-white'
          }`}
        >
          Bot Settings
        </button>
      </div>

      {/* WhatsApp Business Tab */}
      {activeTab === 'whatsapp' && (
        <div className="space-y-6">
          {/* Connection Status */}
          <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Connection Status</h3>
              <button
                onClick={testWhatsAppConnection}
                disabled={loading}
                className="bg-[#00a884] text-white px-3 py-1 rounded text-sm hover:bg-[#008f6e] disabled:opacity-50"
              >
                {loading ? 'Testing...' : 'Test Connection'}
              </button>
            </div>
            <div className="bg-[#2a3942] rounded-lg p-3">
              <p className="text-[#8696a0] text-xs mb-2">Phone ID: <span className="text-white">1102700929584978</span></p>
              <p className="text-[#8696a0] text-xs">WABA ID: <span className="text-white">1465694725259422</span></p>
            </div>
          </div>

          {/* Business Profile */}
          <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
            <h3 className="text-white font-semibold mb-4">Business Profile</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884] mx-auto mb-2"></div>
                <p className="text-[#8696a0]">Loading profile...</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">About</label>
                  <textarea
                    value={profile.about || ''}
                    onChange={(e) => setProfile({ ...profile, about: e.target.value })}
                    rows={2}
                    maxLength={139}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                    placeholder="Tell customers about your business (max 139 characters)"
                  />
                  <p className="text-[#8696a0] text-xs mt-1">{profile.about?.length || 0}/139 characters</p>
                </div>

                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Address</label>
                  <input
                    type="text"
                    value={profile.address || ''}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                    placeholder="Your business address"
                  />
                </div>

                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Description</label>
                  <textarea
                    value={profile.description || ''}
                    onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                    rows={3}
                    maxLength={512}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                    placeholder="Describe what your business does"
                  />
                  <p className="text-[#8696a0] text-xs mt-1">{profile.description?.length || 0}/512 characters</p>
                </div>

                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={profile.email || ''}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                    placeholder="support@yourbusiness.com"
                  />
                </div>

                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Websites</label>
                  {(profile.websites || ['']).map((website, index) => (
                    <div key={index} className="flex gap-2 mb-2">
                      <input
                        type="url"
                        value={website}
                        onChange={(e) => handleWebsiteChange(index, e.target.value)}
                        className="flex-1 bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                        placeholder="https://yourwebsite.com"
                      />
                      {index > 0 && (
                        <button
                          onClick={() => removeWebsite(index)}
                          className="text-red-400 hover:text-red-300 px-2"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={addWebsite}
                    className="text-[#00a884] text-sm mt-1 flex items-center gap-1"
                  >
                    + Add Website
                  </button>
                </div>

                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Industry Vertical</label>
                  <select
                    value={profile.vertical || 'UNDEFINED'}
                    onChange={(e) => setProfile({ ...profile, vertical: e.target.value })}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                  >
                    <option value="UNDEFINED">Not Specified</option>
                    <option value="OTHER">Other</option>
                    <option value="AUTOMOTIVE">Automotive</option>
                    <option value="BEAUTY_SPA_AND_SALON">Beauty, Spa & Salon</option>
                    <option value="CLOTHING_AND_APPAREL">Clothing & Apparel</option>
                    <option value="EDUCATION">Education</option>
                    <option value="ENTERTAINMENT">Entertainment</option>
                    <option value="EVENT_PLANNING">Event Planning</option>
                    <option value="FINANCE_AND_BANKING">Finance & Banking</option>
                    <option value="FOOD_AND_GROCERY">Food & Grocery</option>
                    <option value="HEALTH_AND_FITNESS">Health & Fitness</option>
                    <option value="HOME_AND_GARDEN">Home & Garden</option>
                    <option value="HOTEL_AND_LODGING">Hotel & Lodging</option>
                    <option value="MEDICAL_AND_HEALTH">Medical & Health</option>
                    <option value="NON_PROFIT">Non-Profit</option>
                    <option value="PROFESSIONAL_SERVICES">Professional Services</option>
                    <option value="REAL_ESTATE">Real Estate</option>
                    <option value="RETAIL">Retail</option>
                    <option value="TRAVEL_AND_TRANSPORTATION">Travel & Transportation</option>
                    <option value="RESTAURANT">Restaurant</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={updateWhatsAppProfile}
                    disabled={saving}
                    className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
                  >
                    {saving ? 'Saving...' : 'Save Profile'}
                  </button>
                  <button
                    onClick={fetchWhatsAppProfile}
                    disabled={loading}
                    className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition"
                  >
                    Refresh
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Database Tab */}
      {activeTab === 'database' && (
        <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
          <h3 className="text-white font-semibold mb-4">Database Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[#8696a0] text-sm mb-2">Host</label>
              <input
                type="text"
                value={dbSettings.host}
                onChange={(e) => setDbSettings({ ...dbSettings, host: e.target.value })}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="localhost or IP address"
              />
            </div>

            <div>
              <label className="block text-[#8696a0] text-sm mb-2">Port</label>
              <input
                type="text"
                value={dbSettings.port}
                onChange={(e) => setDbSettings({ ...dbSettings, port: e.target.value })}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="3306"
              />
            </div>

            <div>
              <label className="block text-[#8696a0] text-sm mb-2">Database Name</label>
              <input
                type="text"
                value={dbSettings.name}
                onChange={(e) => setDbSettings({ ...dbSettings, name: e.target.value })}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="database_name"
              />
            </div>

            <div>
              <label className="block text-[#8696a0] text-sm mb-2">Username</label>
              <input
                type="text"
                value={dbSettings.user}
                onChange={(e) => setDbSettings({ ...dbSettings, user: e.target.value })}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="database_user"
              />
            </div>

            <div>
              <label className="block text-[#8696a0] text-sm mb-2">Password</label>
              <input
                type="password"
                value={dbSettings.password}
                onChange={(e) => setDbSettings({ ...dbSettings, password: e.target.value })}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="••••••••"
              />
              <p className="text-[#8696a0] text-xs mt-1">Leave empty to keep current password</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={testDatabaseConnection}
                disabled={loading}
                className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {loading ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={updateDatabaseSettings}
                disabled={saving}
                className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bot Settings Tab */}
      {activeTab === 'bot' && (
        <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
          <h3 className="text-white font-semibold mb-4">Bot Configuration</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-[#8696a0] text-sm mb-2">Welcome Message</label>
              <textarea
                value={botSettings.welcomeMessage}
                onChange={(e) => setBotSettings({ ...botSettings, welcomeMessage: e.target.value })}
                rows={3}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="Welcome! How can I help you today?"
              />
              <p className="text-[#8696a0] text-xs mt-1">This message will be sent when a user starts a conversation</p>
            </div>

            <div>
              <label className="block text-[#8696a0] text-sm mb-2">Default Reply</label>
              <textarea
                value={botSettings.defaultReply}
                onChange={(e) => setBotSettings({ ...botSettings, defaultReply: e.target.value })}
                rows={2}
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                placeholder="I'm not sure I understand. Could you please rephrase?"
              />
              <p className="text-[#8696a0] text-xs mt-1">Sent when the bot doesn't understand the user's message</p>
            </div>

            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={botSettings.enableAutoReply}
                  onChange={(e) => setBotSettings({ ...botSettings, enableAutoReply: e.target.checked })}
                  className="w-4 h-4 accent-[#00a884]"
                />
                <span className="text-white text-sm">Enable Auto Reply</span>
              </label>
            </div>

            {botSettings.enableAutoReply && (
              <div>
                <label className="block text-[#8696a0] text-sm mb-2">Auto Reply Delay (seconds)</label>
                <input
                  type="number"
                  value={botSettings.autoReplyDelay}
                  onChange={(e) => setBotSettings({ ...botSettings, autoReplyDelay: parseInt(e.target.value) || 0 })}
                  min="0"
                  max="60"
                  className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                />
                <p className="text-[#8696a0] text-xs mt-1">Delay before sending auto-reply (0 for immediate)</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={updateBotSettings}
                disabled={saving}
                className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}