// app/components/BotManager.tsx
'use client';

import { useState, useEffect } from 'react';
import BotFlowBuilder from './BotFlowBuilder';

interface BotResponse {
  id: number;
  trigger_keyword: string;
  response_text: string;
  response_type: string;
  template_name: string | null;
  priority: number;
  is_active: boolean;
}

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  sub_type?: string;
  example?: {
    header_handle?: string[];
    body_text?: string[];
  };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
    flow_id?: string;
    flow_action?: string;
    navigate_screen?: string;
  }>;
}

interface Template {
  name: string;
  status: string;
  language: string;
  category: string;
  components: TemplateComponent[];
  id: string;
  quality_score?: {
    score: string;
  };
}

interface Flow {
  id: number;
  name: string;
  description: string;
  trigger_keyword?: string;
  is_active: boolean;
  created_at: string;
}

// ─── Helper: detect if a template has a Meta Flow button ─────────────────────
function isFlowTemplate(template: Template): boolean {
  const buttonComp = template.components?.find(c => c.type === 'BUTTONS');
  if (!buttonComp?.buttons) return false;
  return buttonComp.buttons.some(
    (btn) =>
      btn.type === 'FLOW' ||
      (btn as { flow_id?: string }).flow_id != null
  );
}

export default function BotManager() {
  const [activeTab, setActiveTab] = useState<'responses' | 'flows'>('responses');
  const [responses, setResponses] = useState<BotResponse[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [flows, setFlows] = useState<Flow[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    trigger_keyword: '',
    response_text: '',
    response_type: 'text',
    template_name: '',
    priority: 0,
    is_active: true
  });
  const [loading, setLoading] = useState(false);
  const [fetchingTemplates, setFetchingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showTemplatePreview, setShowTemplatePreview] = useState(false);
  const [sendTemplatePhone, setSendTemplatePhone] = useState('');
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [showFlowBuilder, setShowFlowBuilder] = useState(false);
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
  const [deletingFlow, setDeletingFlow] = useState(false);

  // Flow Template Sending states
  const [selectedFlowForTemplate, setSelectedFlowForTemplate] = useState<Flow | null>(null);
  const [showFlowTemplateModal, setShowFlowTemplateModal] = useState(false);
  const [flowTemplateSearch, setFlowTemplateSearch] = useState('');
  const [flowSelectedTemplate, setFlowSelectedTemplate] = useState<Template | null>(null);

  // Template sending states
  const [headerMediaFile, setHeaderMediaFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});

  // Flow template extra fields
  const [flowToken, setFlowToken] = useState('unused');
  const [flowActionData, setFlowActionData] = useState('{}');

  useEffect(() => {
    fetchResponses();
    fetchTemplates();
    fetchFlows();
  }, []);

  const fetchResponses = async () => {
    try {
      const response = await fetch('/api/bot/responses');
      const data = await response.json();
      if (data.success) setResponses(data.responses);
    } catch (error) {
      console.error('Error fetching responses:', error);
    }
  };

  const fetchTemplates = async () => {
    setFetchingTemplates(true);
    setTemplateError(null);
    try {
      const response = await fetch('/api/bot/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
        if (data.templates.length === 0) {
          setTemplateError('No templates found. Create templates in Meta WhatsApp Manager first.');
        }
      } else {
        setTemplateError(data.error || 'Failed to fetch templates');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setTemplateError('Network error while fetching templates');
    } finally {
      setFetchingTemplates(false);
    }
  };

  const fetchFlows = async () => {
    try {
      const response = await fetch('/api/bot/flows');
      const data = await response.json();
      if (data.success) setFlows(data.flows);
    } catch (error) {
      console.error('Error fetching flows:', error);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const method = editingId ? 'PUT' : 'POST';
      const body = editingId ? { ...formData, id: editingId } : formData;
      const response = await fetch('/api/bot/responses', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (response.ok) {
        fetchResponses();
        setShowAddForm(false);
        setEditingId(null);
        setFormData({ trigger_keyword: '', response_text: '', response_type: 'text', template_name: '', priority: 0, is_active: true });
      }
    } catch (error) {
      console.error('Error saving response:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this bot response?')) return;
    try {
      const response = await fetch(`/api/bot/responses?id=${id}`, { method: 'DELETE' });
      if (response.ok) fetchResponses();
    } catch (error) {
      console.error('Error deleting response:', error);
    }
  };

  const handleEdit = (response: BotResponse) => {
    setFormData({
      trigger_keyword: response.trigger_keyword,
      response_text: response.response_text,
      response_type: response.response_type,
      template_name: response.template_name || '',
      priority: response.priority,
      is_active: response.is_active
    });
    setEditingId(response.id);
    setShowAddForm(true);
  };

  const handleDeleteFlow = async (id: number) => {
    if (!confirm('Delete this flow? This action cannot be undone.')) return;
    setDeletingFlow(true);
    try {
      const response = await fetch(`/api/bot/flows?id=${id}`, { method: 'DELETE' });
      if (response.ok) fetchFlows();
    } catch (error) {
      console.error('Error deleting flow:', error);
      alert('Failed to delete flow');
    } finally {
      setDeletingFlow(false);
    }
  };

  const uploadMediaToWhatsApp = async (file: File) => {
    setUploadingMedia(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', file.type);
    try {
      const response = await fetch('/api/upload-whatsapp-media', { method: 'POST', body: formData });
      const data = await response.json();
      if (data.success) {
        setMediaId(data.media_id);
        return data.media_id;
      } else {
        alert('Failed to upload media: ' + data.error);
        return null;
      }
    } catch (error) {
      console.error('Error uploading media:', error);
      alert('Error uploading media');
      return null;
    } finally {
      setUploadingMedia(false);
    }
  };

  // ─── CORE SEND FUNCTION ────────────────────────────────────────────────────
  // Handles three cases:
  //   1. Meta Flow template  → POST /api/bot/send-flow-template
  //   2. Image/Video header  → POST /api/bot/send-template  (with components)
  //   3. Regular template    → POST /api/bot/send-template
  const sendTemplateMessage = async (
    template: Template,
    phone: string,
    variables: Record<string, string>,
    mediaFile: File | null,
    flowTokenVal: string = 'unused',
    flowActionDataVal: string = '{}'
  ) => {
    setSendingTemplate(true);
    try {
      // ── Case 1: Meta Flow template ────────────────────────────────────────
      if (isFlowTemplate(template)) {
        let parsedActionData: Record<string, string> = {};
        const trimmed = (flowActionDataVal || '').trim();
        if (trimmed && trimmed !== '{}') {
          try {
            parsedActionData = JSON.parse(trimmed);
          } catch {
            alert('❌ Invalid JSON in Flow Action Data field.');
            setSendingTemplate(false);
            return false;
          }
        }

        const requestBody = {
          phone,
          template_name: template.name,
          language: template.language,
          flow_token: flowTokenVal || 'unused',
          flow_action_data: parsedActionData,
        };

        const response = await fetch('/api/bot/send-flow-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        });

        const data = await response.json();
        if (data.success) {
          alert('✅ Meta Flow template sent successfully!');
          return true;
        } else {
          alert('❌ Failed to send Flow template: ' + (data.error || JSON.stringify(data)));
          return false;
        }
      }

      // ── Case 2 & 3: Regular / image-header templates ──────────────────────
      const headerComponent = template.components?.find(c => c.type === 'HEADER');
      const hasImageHeader = headerComponent?.format === 'IMAGE';
      const hasVideoHeader = headerComponent?.format === 'VIDEO';

      let uploadedMediaId = null;
      if ((hasImageHeader || hasVideoHeader) && mediaFile) {
        uploadedMediaId = await uploadMediaToWhatsApp(mediaFile);
        if (!uploadedMediaId) {
          alert('Please upload media file for the header');
          setSendingTemplate(false);
          return false;
        }
      }

      const components = [];
      if (uploadedMediaId && (hasImageHeader || hasVideoHeader)) {
        components.push({
          type: 'HEADER',
          parameters: [{
            type: hasImageHeader ? 'image' : 'video',
            [hasImageHeader ? 'image' : 'video']: { id: uploadedMediaId }
          }]
        });
      }

      const bodyComponent = template.components?.find(c => c.type === 'BODY');
      if (bodyComponent && Object.keys(variables).length > 0) {
        const bodyParameters = [];
        for (let i = 1; i <= Object.keys(variables).length; i++) {
          bodyParameters.push({ type: 'text', text: variables[`var${i}`] || '' });
        }
        if (bodyParameters.length > 0) {
          components.push({ type: 'BODY', parameters: bodyParameters });
        }
      }

      const requestBody: Record<string, unknown> = {
        phone,
        template_name: template.name,
        language: template.language
      };
      if (components.length > 0) requestBody.components = components;

      const response = await fetch('/api/bot/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      if (data.success) {
        alert('✅ Template message sent successfully!');
        return true;
      } else {
        alert('❌ Failed to send template: ' + data.error);
        return false;
      }
    } catch (error) {
      console.error('Error sending template:', error);
      alert('Failed to send template');
      return false;
    } finally {
      setSendingTemplate(false);
    }
  };

  // Simple responses tab send handler
  const handleSendSimpleTemplate = async () => {
    if (!selectedTemplate || !sendTemplatePhone) return;
    const success = await sendTemplateMessage(
      selectedTemplate, sendTemplatePhone, templateVariables, headerMediaFile,
      flowToken, flowActionData
    );
    if (success) {
      setShowTemplatePreview(false);
      setSendTemplatePhone('');
      setHeaderMediaFile(null);
      setMediaId(null);
      setTemplateVariables({});
      setFlowToken('unused');
      setFlowActionData('{}');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusColors: { [key: string]: string } = {
      'APPROVED': 'bg-green-500',
      'PENDING': 'bg-yellow-500',
      'REJECTED': 'bg-red-500',
      'PAUSED': 'bg-gray-500',
      'DISABLED': 'bg-gray-600',
      'IN_APPEAL': 'bg-orange-500'
    };
    return statusColors[status] || 'bg-gray-500';
  };

  const getHeaderType = (template: Template) => {
    const headerComponent = template.components?.find(c => c.type === 'HEADER');
    if (!headerComponent) return 'none';
    if (headerComponent.format === 'IMAGE') return 'image';
    if (headerComponent.format === 'VIDEO') return 'video';
    if (headerComponent.format === 'DOCUMENT') return 'document';
    return 'text';
  };

  const filteredTemplates = templates.filter(t =>
    t.name.toLowerCase().includes(flowTemplateSearch.toLowerCase()) ||
    t.category.toLowerCase().includes(flowTemplateSearch.toLowerCase())
  );

  return (
    <div className="bg-[#202c33] rounded-lg p-6">
      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b border-[#2a3942]">
        <button
          onClick={() => setActiveTab('responses')}
          className={`pb-2 px-4 transition ${activeTab === 'responses' ? 'text-[#00a884] border-b-2 border-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
        >
          🤖 Simple Responses
        </button>
        <button
          onClick={() => setActiveTab('flows')}
          className={`pb-2 px-4 transition ${activeTab === 'flows' ? 'text-[#00a884] border-b-2 border-[#00a884]' : 'text-[#8696a0] hover:text-white'}`}
        >
          🔗 Visual Flow Builder
        </button>
      </div>

      {/* ── Simple Responses Tab ── */}
      {activeTab === 'responses' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">🤖 Bot Responses</h2>
            <button
              onClick={() => { setShowAddForm(true); setEditingId(null); setFormData({ trigger_keyword: '', response_text: '', response_type: 'text', template_name: '', priority: 0, is_active: true }); }}
              className="bg-[#00a884] text-white px-4 py-2 rounded-lg hover:bg-[#008f6e] transition"
            >
              + Add New Response
            </button>
          </div>

          {showAddForm && (
            <div className="bg-[#2a3942] rounded-lg p-4 mb-6">
              <h3 className="text-white font-medium mb-4">{editingId ? 'Edit Response' : 'Add New Response'}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#8696a0] text-sm mb-1">Trigger Keyword</label>
                  <input type="text" value={formData.trigger_keyword} onChange={(e) => setFormData({ ...formData, trigger_keyword: e.target.value })} placeholder="e.g., price, hello, 1" className="w-full bg-[#111b21] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" />
                </div>
                <div>
                  <label className="block text-[#8696a0] text-sm mb-1">Response Type</label>
                  <select value={formData.response_type} onChange={(e) => setFormData({ ...formData, response_type: e.target.value })} className="w-full bg-[#111b21] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]">
                    <option value="text">Text Message</option>
                    <option value="template">WhatsApp Template</option>
                  </select>
                </div>
                {formData.response_type === 'template' && (
                  <div className="col-span-2">
                    <label className="block text-[#8696a0] text-sm mb-1">Select WhatsApp Template</label>
                    <select value={formData.template_name} onChange={(e) => setFormData({ ...formData, template_name: e.target.value })} className="w-full bg-[#111b21] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]">
                      <option value="">Select a template</option>
                      {templates.map((template) => (
                        <option key={template.name} value={template.name}>
                          {template.name} ({template.category}) - {template.status}
                          {isFlowTemplate(template) ? ' 🔄 FLOW' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[#8696a0] text-sm mb-1">Priority</label>
                  <input type="number" value={formData.priority} onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })} className="w-full bg-[#111b21] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" />
                  <p className="text-xs text-[#8696a0] mt-1">Higher number = higher priority</p>
                </div>
                <div className="col-span-2">
                  <label className="block text-[#8696a0] text-sm mb-1">Response Message</label>
                  <textarea value={formData.response_text} onChange={(e) => setFormData({ ...formData, response_text: e.target.value })} placeholder="Enter bot response message..." rows={4} className="w-full bg-[#111b21] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" />
                </div>
                <div className="col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={formData.is_active} onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 accent-[#00a884]" />
                    <span className="text-[#8696a0] text-sm">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={handleSubmit} disabled={loading} className="bg-[#00a884] text-white px-4 py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition">{loading ? 'Saving...' : 'Save'}</button>
                <button onClick={() => setShowAddForm(false)} className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition">Cancel</button>
              </div>
            </div>
          )}

          <div className="mb-8">
            <h3 className="text-white font-semibold mb-4">📝 Your Bot Responses</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-[#8696a0] border-b border-[#2a3942]">
                    <th className="pb-2">Keyword</th>
                    <th className="pb-2">Response</th>
                    <th className="pb-2">Type</th>
                    <th className="pb-2">Priority</th>
                    <th className="pb-2">Status</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {responses.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-[#8696a0]">No bot responses yet. Click "Add New Response" to create one.</td></tr>
                  ) : (
                    responses.map((response) => (
                      <tr key={response.id} className="border-b border-[#2a3942] hover:bg-[#2a3942]/30 transition">
                        <td className="py-3 text-white font-mono">{response.trigger_keyword}</td>
                        <td className="py-3 text-[#e9edef] max-w-xs truncate">{response.response_text.substring(0, 50)}...</td>
                        <td className="py-3"><span className={`px-2 py-1 rounded-full text-xs ${response.response_type === 'template' ? 'bg-blue-500' : 'bg-green-500'} text-white`}>{response.response_type}</span></td>
                        <td className="py-3 text-[#e9edef]">{response.priority}</td>
                        <td className="py-3"><span className={`px-2 py-1 rounded-full text-xs ${response.is_active ? 'bg-green-500' : 'bg-gray-500'} text-white`}>{response.is_active ? 'Active' : 'Inactive'}</span></td>
                        <td className="py-3">
                          <div className="flex gap-2">
                            <button onClick={() => handleEdit(response)} className="text-blue-400 hover:text-blue-300 transition">Edit</button>
                            <button onClick={() => handleDelete(response.id)} className="text-red-400 hover:text-red-300 transition">Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* WhatsApp Templates Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">📋 WhatsApp Meta Templates</h3>
              <button onClick={fetchTemplates} disabled={fetchingTemplates} className="text-[#00a884] hover:text-[#008f6e] text-sm flex items-center gap-1 transition">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                {fetchingTemplates ? 'Refreshing...' : 'Refresh Templates'}
              </button>
            </div>

            {fetchingTemplates ? (
              <div className="text-center py-8 text-[#8696a0]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884] mx-auto mb-4"></div>
                <p>Loading templates from Meta...</p>
              </div>
            ) : templateError ? (
              <div className="bg-[#2a3942] rounded-lg p-8 text-center">
                <div className="text-yellow-400 text-4xl mb-3">⚠️</div>
                <p className="text-[#8696a0] mb-2">{templateError}</p>
                <button onClick={fetchTemplates} className="mt-4 text-[#00a884] hover:text-[#008f6e] text-sm">Try Again</button>
              </div>
            ) : templates.length === 0 ? (
              <div className="bg-[#2a3942] rounded-lg p-8 text-center">
                <p className="text-[#8696a0] mb-2">No templates found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {templates.map((template) => {
                  const headerType = getHeaderType(template);
                  const hasFlow = isFlowTemplate(template);
                  return (
                    <div
                      key={template.id || template.name}
                      className="bg-[#2a3942] rounded-lg p-4 hover:bg-[#3a4a54] transition cursor-pointer"
                      onClick={() => {
                        setSelectedTemplate(template);
                        setShowTemplatePreview(true);
                        setHeaderMediaFile(null);
                        setMediaId(null);
                        setTemplateVariables({});
                        setFlowToken('unused');
                        setFlowActionData('{}');
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{template.name}</p>
                            {hasFlow && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">🔄 FLOW</span>
                            )}
                          </div>
                          <p className="text-[#8696a0] text-xs mt-1">Category: {template.category || 'Marketing'} • Language: {template.language}</p>
                          {headerType !== 'none' && (
                            <span className={`text-xs px-2 py-0.5 rounded-full inline-block mt-1 ${headerType === 'image' ? 'bg-green-500/20 text-green-400' : headerType === 'video' ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-500/20 text-gray-400'}`}>
                              {headerType === 'image' ? '🖼️ Image Header' : headerType === 'video' ? '🎬 Video Header' : '📄 Document Header'}
                            </span>
                          )}
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(template.status)} text-white ml-2`}>{template.status}</span>
                      </div>
                      <div className="mt-2 text-xs text-[#8696a0] truncate">
                        {template.components?.map((comp, idx) => (
                          <span key={idx}>{comp.type === 'BODY' && (comp.text || comp.example?.body_text?.[0])}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Visual Flow Builder Tab ── */}
      {activeTab === 'flows' && (
        <>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">🔗 Visual Flow Builder</h2>
            <button onClick={() => { setSelectedFlowId(null); setShowFlowBuilder(true); }} className="bg-[#00a884] text-white px-4 py-2 rounded-lg hover:bg-[#008f6e] transition">+ Create New Flow</button>
          </div>

          {flows.length === 0 ? (
            <div className="bg-[#2a3942] rounded-lg p-12 text-center">
              <div className="text-5xl mb-4">🎨</div>
              <p className="text-[#8696a0] mb-2">No flows created yet</p>
              <button onClick={() => { setSelectedFlowId(null); setShowFlowBuilder(true); }} className="bg-[#00a884] text-white px-4 py-2 rounded-lg hover:bg-[#008f6e] transition mt-4">Create Your First Flow</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {flows.map((flow) => (
                <div key={flow.id} className="bg-[#2a3942] rounded-lg p-4 hover:bg-[#3a4a54] transition cursor-pointer" onClick={() => { setSelectedFlowId(flow.id); setShowFlowBuilder(true); }}>
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-white font-semibold">{flow.name}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs ${flow.is_active ? 'bg-green-500' : 'bg-gray-500'} text-white`}>{flow.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <p className="text-[#8696a0] text-sm mb-3">{flow.description || 'No description'}</p>
                  {flow.trigger_keyword && <p className="text-[#00a884] text-xs mb-2">Trigger: {flow.trigger_keyword}</p>}
                  <p className="text-[#6a7a84] text-xs">Created: {new Date(flow.created_at).toLocaleDateString()}</p>
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[#111b21]">
                    <button
                      onClick={(e) => { e.stopPropagation(); setSelectedFlowId(flow.id); setShowFlowBuilder(true); }}
                      className="flex-1 text-blue-400 hover:text-blue-300 text-sm py-1 rounded hover:bg-blue-400/10 transition"
                    >✏️ Edit</button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFlowForTemplate(flow);
                        setFlowSelectedTemplate(null);
                        setFlowTemplateSearch('');
                        setSendTemplatePhone('');
                        setHeaderMediaFile(null);
                        setTemplateVariables({});
                        setFlowToken('unused');
                        setFlowActionData('{}');
                        setShowFlowTemplateModal(true);
                      }}
                      className="flex-1 text-[#00a884] hover:text-[#008f6e] text-sm py-1 rounded hover:bg-[#00a884]/10 transition"
                    >📤 Send Template</button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFlow(flow.id); }}
                      disabled={deletingFlow}
                      className="flex-1 text-red-400 hover:text-red-300 text-sm py-1 rounded hover:bg-red-400/10 transition"
                    >🗑️ Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Simple Responses Template Preview Modal ── */}
      {showTemplatePreview && selectedTemplate && (
        <TemplateSendModal
          template={selectedTemplate}
          phone={sendTemplatePhone}
          onPhoneChange={setSendTemplatePhone}
          variables={templateVariables}
          onVariablesChange={setTemplateVariables}
          headerMediaFile={headerMediaFile}
          onHeaderMediaChange={setHeaderMediaFile}
          uploadingMedia={uploadingMedia}
          sendingTemplate={sendingTemplate}
          flowToken={flowToken}
          onFlowTokenChange={setFlowToken}
          flowActionData={flowActionData}
          onFlowActionDataChange={setFlowActionData}
          onSend={handleSendSimpleTemplate}
          onClose={() => setShowTemplatePreview(false)}
          title="Send Template"
        />
      )}

      {/* ── Flow Template Send Modal ── */}
      {showFlowTemplateModal && selectedFlowForTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="bg-[#2a3942] px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-white font-semibold text-lg">📤 Send Template via Flow</h3>
                <p className="text-[#8696a0] text-xs mt-0.5">
                  Flow: <span className="text-[#00a884]">{selectedFlowForTemplate.name}</span>
                </p>
              </div>
              <button onClick={() => setShowFlowTemplateModal(false)} className="text-[#8696a0] hover:text-white text-2xl transition leading-none">✕</button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Template Picker */}
              {!flowSelectedTemplate ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex-shrink-0">
                    <p className="text-[#8696a0] text-sm mb-3">Select a WhatsApp template to send for this flow:</p>
                    <input
                      type="text"
                      placeholder="🔍 Search templates..."
                      value={flowTemplateSearch}
                      onChange={(e) => setFlowTemplateSearch(e.target.value)}
                      className="w-full bg-[#2a3942] text-white text-sm rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#00a884] placeholder-[#8696a0]"
                    />
                  </div>
                  <div className="flex-1 overflow-y-auto px-4 pb-4">
                    {fetchingTemplates ? (
                      <div className="flex items-center justify-center py-12 text-[#8696a0]">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#00a884] mr-3"></div>
                        Loading templates...
                      </div>
                    ) : filteredTemplates.length === 0 ? (
                      <div className="text-center py-12 text-[#8696a0]">
                        <p className="text-3xl mb-2">📭</p>
                        <p className="text-sm">{flowTemplateSearch ? 'No templates match your search' : 'No templates available'}</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredTemplates.map((template) => {
                          const headerType = getHeaderType(template);
                          const hasFlow = isFlowTemplate(template);
                          const isApproved = template.status === 'APPROVED';
                          return (
                            <button
                              key={template.id || template.name}
                              onClick={() => {
                                if (!isApproved) return;
                                setFlowSelectedTemplate(template);
                                setFlowToken('unused');
                                setFlowActionData('{}');
                              }}
                              disabled={!isApproved}
                              className={`w-full text-left bg-[#2a3942] rounded-lg p-3 transition border-2 ${isApproved ? 'hover:bg-[#3a4a54] border-transparent hover:border-[#00a884]/40 cursor-pointer' : 'opacity-50 cursor-not-allowed border-transparent'}`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-white text-sm font-medium truncate">{template.name}</p>
                                    {hasFlow && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 flex-shrink-0">🔄 FLOW</span>}
                                  </div>
                                  <p className="text-[#8696a0] text-xs mt-0.5">
                                    {template.category} • {template.language}
                                    {headerType !== 'none' && ` • ${headerType === 'image' ? '🖼️' : headerType === 'video' ? '🎬' : '📄'} ${headerType}`}
                                  </p>
                                  <p className="text-[#6a7a84] text-xs mt-1 truncate">
                                    {template.components?.find(c => c.type === 'BODY')?.text?.substring(0, 60)}...
                                  </p>
                                </div>
                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${getStatusBadge(template.status)} text-white`}>{template.status}</span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Send Form for selected template */
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4">
                    <button onClick={() => setFlowSelectedTemplate(null)} className="flex items-center gap-1 text-[#8696a0] hover:text-white text-sm mb-4 transition">← Back to templates</button>

                    {/* Selected template info */}
                    <div className="bg-[#2a3942] rounded-lg p-3 mb-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <p className="text-white font-medium text-sm">{flowSelectedTemplate.name}</p>
                          {isFlowTemplate(flowSelectedTemplate) && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">🔄 FLOW</span>
                          )}
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusBadge(flowSelectedTemplate.status)} text-white`}>{flowSelectedTemplate.status}</span>
                      </div>
                      <p className="text-[#8696a0] text-xs mt-1">{flowSelectedTemplate.category} • {flowSelectedTemplate.language}</p>
                    </div>

                    {/* ── Meta Flow fields (only shown for FLOW templates) ── */}
                    {isFlowTemplate(flowSelectedTemplate) && (
                      <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-3">
                        <p className="text-purple-300 text-sm font-medium">🔄 Meta Flow Configuration</p>
                        <div>
                          <label className="block text-[#8696a0] text-xs mb-1">Flow Token</label>
                          <input
                            type="text"
                            value={flowToken}
                            onChange={(e) => setFlowToken(e.target.value)}
                            placeholder="e.g., order_flow_token_123"
                            className="w-full bg-[#2a3942] text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                          />
                          <p className="text-xs text-[#6a7a84] mt-1">Leave as "unused" if not needed</p>
                        </div>
                        <div>
                          <label className="block text-[#8696a0] text-xs mb-1">Flow Action Data (JSON)</label>
                          <textarea
                            value={flowActionData}
                            onChange={(e) => setFlowActionData(e.target.value)}
                            placeholder={'{\n  "customer_name": "John",\n  "order_id": "ORD001"\n}'}
                            rows={4}
                            className="w-full bg-[#2a3942] text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-purple-400 font-mono resize-none"
                          />
                          <p className="text-xs text-[#6a7a84] mt-1">Pre-fill flow fields with JSON key-value pairs. Use {'{}'} if empty.</p>
                        </div>
                      </div>
                    )}

                    {/* Header media upload (non-flow templates) */}
                    {!isFlowTemplate(flowSelectedTemplate) && (() => {
                      const headerComponent = flowSelectedTemplate.components?.find(c => c.type === 'HEADER');
                      const hasImageHeader = headerComponent?.format === 'IMAGE';
                      const hasVideoHeader = headerComponent?.format === 'VIDEO';
                      if (hasImageHeader || hasVideoHeader) {
                        return (
                          <div className="mb-4 p-3 bg-[#2a3942] rounded-lg">
                            <label className="block text-[#00a884] text-sm mb-2">{hasImageHeader ? '🖼️ Upload Image for Header' : '🎬 Upload Video for Header'}</label>
                            <input type="file" accept={hasImageHeader ? 'image/*' : 'video/*'} onChange={(e) => { if (e.target.files?.[0]) setHeaderMediaFile(e.target.files[0]); }} className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none cursor-pointer" />
                            {headerMediaFile && (
                              <div className="mt-2">
                                <p className="text-green-400 text-xs">✓ {headerMediaFile.name}</p>
                                {hasImageHeader && <img src={URL.createObjectURL(headerMediaFile)} alt="Preview" className="mt-2 max-h-24 rounded-lg object-cover" />}
                              </div>
                            )}
                          </div>
                        );
                      }
                      return null;
                    })()}

                    {/* Template variables (non-flow templates) */}
                    {!isFlowTemplate(flowSelectedTemplate) && flowSelectedTemplate.components?.some(c => c.type === 'BODY' && c.example?.body_text?.[0]?.includes('{{')) && (
                      <div className="mb-4">
                        <label className="block text-[#8696a0] text-sm mb-2">Template Variables</label>
                        <div className="space-y-2">
                          {flowSelectedTemplate.components.filter(c => c.type === 'BODY').map((comp) => {
                            const matches = comp.example?.body_text?.[0]?.match(/\{\{(\d+)\}\}/g) || [];
                            return matches.map((match, varIdx) => (
                              <input key={varIdx} type="text" placeholder={`Variable ${match}`} onChange={(e) => setTemplateVariables({ ...templateVariables, [`var${varIdx + 1}`]: e.target.value })} className="w-full bg-[#2a3942] text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" />
                            ));
                          })}
                        </div>
                      </div>
                    )}

                    {/* Message preview */}
                    <div className="mb-4">
                      <p className="text-[#8696a0] text-sm mb-2">Message Preview</p>
                      <div className="bg-[#111b21] rounded-lg p-3 space-y-1">
                        {flowSelectedTemplate.components?.map((comp, idx) => {
                          if (comp.type === 'HEADER') {
                            if (comp.format === 'IMAGE') return <div key={idx} className="text-[#8696a0] text-sm">🖼️ [Image Header]</div>;
                            if (comp.format === 'VIDEO') return <div key={idx} className="text-[#8696a0] text-sm">🎬 [Video Header]</div>;
                          } else if (comp.type === 'BODY') {
                            let bodyText = comp.text || comp.example?.body_text?.[0] || '';
                            Object.entries(templateVariables).forEach(([key, value]) => {
                              bodyText = bodyText.replace(`{{${key.replace('var', '')}}}`, value);
                            });
                            return <p key={idx} className="text-white text-sm">{bodyText}</p>;
                          } else if (comp.type === 'FOOTER') {
                            return <p key={idx} className="text-[#8696a0] text-xs pt-2 border-t border-[#2a3942]">{comp.text}</p>;
                          } else if (comp.type === 'BUTTONS' && comp.buttons) {
                            return (
                              <div key={idx} className="flex flex-col gap-1 pt-2">
                                {comp.buttons.map((btn, btnIdx) => (
                                  <div key={btnIdx} className={`text-center py-1.5 rounded text-sm ${btn.type === 'FLOW' ? 'bg-purple-500/20 text-purple-300' : 'bg-[#00a884]/20 text-[#00a884]'}`}>
                                    {btn.type === 'FLOW' ? '🔄 ' : ''}{btn.text}
                                  </div>
                                ))}
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    </div>

                    {/* Phone number */}
                    <div className="mb-4">
                      <label className="block text-[#8696a0] text-sm mb-2">Send to Phone Number</label>
                      <input
                        type="tel"
                        value={sendTemplatePhone}
                        onChange={(e) => setSendTemplatePhone(e.target.value)}
                        placeholder="e.g., +919004363902"
                        className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                      />
                      <p className="text-xs text-[#6a7a84] mt-1">Include country code (e.g., +91 for India)</p>
                    </div>

                    {/* Send button */}
                    <button
                      onClick={async () => {
                        const success = await sendTemplateMessage(
                          flowSelectedTemplate,
                          sendTemplatePhone,
                          templateVariables,
                          headerMediaFile,
                          flowToken,
                          flowActionData
                        );
                        if (success) {
                          setShowFlowTemplateModal(false);
                          setFlowSelectedTemplate(null);
                          setSendTemplatePhone('');
                          setHeaderMediaFile(null);
                          setTemplateVariables({});
                          setFlowToken('unused');
                          setFlowActionData('{}');
                        }
                      }}
                      disabled={sendingTemplate || !sendTemplatePhone}
                      className={`w-full py-2.5 rounded-lg disabled:opacity-50 transition font-medium text-white ${isFlowTemplate(flowSelectedTemplate) ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#00a884] hover:bg-[#008f6e]'}`}
                    >
                      {sendingTemplate ? (
                        <span className="flex items-center justify-center gap-2">
                          <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                          Sending...
                        </span>
                      ) : isFlowTemplate(flowSelectedTemplate) ? (
                        '🔄 Send Flow Template'
                      ) : (
                        '📤 Send Template Message'
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Flow Builder Modal ── */}
      {showFlowBuilder && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50">
          <div className="h-full flex flex-col">
            <BotFlowBuilder
              flowId={selectedFlowId || undefined}
              onSave={() => { setShowFlowBuilder(false); fetchFlows(); }}
              onClose={() => setShowFlowBuilder(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Reusable Template Send Modal (Simple Responses tab) ── */
function TemplateSendModal({
  template,
  phone,
  onPhoneChange,
  variables,
  onVariablesChange,
  headerMediaFile,
  onHeaderMediaChange,
  uploadingMedia,
  sendingTemplate,
  flowToken,
  onFlowTokenChange,
  flowActionData,
  onFlowActionDataChange,
  onSend,
  onClose,
  title
}: {
  template: Template;
  phone: string;
  onPhoneChange: (v: string) => void;
  variables: Record<string, string>;
  onVariablesChange: (v: Record<string, string>) => void;
  headerMediaFile: File | null;
  onHeaderMediaChange: (f: File | null) => void;
  uploadingMedia: boolean;
  sendingTemplate: boolean;
  flowToken: string;
  onFlowTokenChange: (v: string) => void;
  flowActionData: string;
  onFlowActionDataChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
  title: string;
}) {
  const headerComponent = template.components?.find(c => c.type === 'HEADER');
  const hasImageHeader = headerComponent?.format === 'IMAGE';
  const hasVideoHeader = headerComponent?.format === 'VIDEO';
  const hasFlow = isFlowTemplate(template);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
      <div className="bg-[#202c33] rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto">
        <div className="sticky top-0 bg-[#202c33] p-4 border-b border-[#2a3942] flex justify-between items-center">
          <div className="flex items-center gap-2">
            <h3 className="text-white font-semibold">{title}</h3>
            {hasFlow && <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">🔄 FLOW</span>}
          </div>
          <button onClick={onClose} className="text-white text-2xl hover:text-gray-300">✕</button>
        </div>

        <div className="p-6">
          <div className="bg-[#2a3942] rounded-lg p-4 mb-4">
            <p className="text-[#00a884] text-sm mb-1">Template: {template.name}</p>
            <p className="text-[#8696a0] text-xs mb-4">Status: {template.status} • Language: {template.language}</p>

            {/* Meta Flow fields */}
            {hasFlow && (
              <div className="mb-4 p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-3">
                <p className="text-purple-300 text-sm font-medium">🔄 Meta Flow Configuration</p>
                <div>
                  <label className="block text-[#8696a0] text-xs mb-1">Flow Token</label>
                  <input
                    type="text"
                    value={flowToken}
                    onChange={(e) => onFlowTokenChange(e.target.value)}
                    placeholder="e.g., order_flow_token_123"
                    className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[#8696a0] text-xs mb-1">Flow Action Data (JSON)</label>
                  <textarea
                    value={flowActionData}
                    onChange={(e) => onFlowActionDataChange(e.target.value)}
                    placeholder={'{\n  "name": "John"\n}'}
                    rows={3}
                    className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none font-mono resize-none"
                  />
                </div>
              </div>
            )}

            {/* Header media (non-flow) */}
            {!hasFlow && (hasImageHeader || hasVideoHeader) && (
              <div className="mb-4 p-3 bg-[#111b21] rounded-lg">
                <label className="block text-[#00a884] text-sm mb-2">{hasImageHeader ? '🖼️ Upload Image for Header' : '🎬 Upload Video for Header'}</label>
                <input type="file" accept={hasImageHeader ? 'image/*' : 'video/*'} onChange={(e) => onHeaderMediaChange(e.target.files?.[0] || null)} className="w-full bg-[#2a3942] text-white text-sm rounded-lg p-2 outline-none cursor-pointer" />
                {headerMediaFile && (
                  <div className="mt-2">
                    <p className="text-green-400 text-xs">✓ File selected: {headerMediaFile.name}</p>
                    {hasImageHeader && <img src={URL.createObjectURL(headerMediaFile)} alt="Preview" className="mt-2 max-h-32 rounded-lg object-cover" />}
                  </div>
                )}
                {uploadingMedia && <div className="flex items-center gap-2 mt-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00a884]"></div><span className="text-xs text-[#8696a0]">Uploading...</span></div>}
              </div>
            )}

            {/* Variables (non-flow) */}
            {!hasFlow && template.components?.some(c => c.type === 'BODY' && c.example?.body_text?.[0]?.includes('{{')) && (
              <div className="mb-4">
                <label className="block text-[#8696a0] text-sm mb-2">Template Variables</label>
                <div className="space-y-2">
                  {template.components.filter(c => c.type === 'BODY').map((comp) => {
                    const matches = comp.example?.body_text?.[0]?.match(/\{\{(\d+)\}\}/g) || [];
                    return matches.map((match, varIdx) => (
                      <input key={varIdx} type="text" placeholder={`Variable ${match}`} onChange={(e) => onVariablesChange({ ...variables, [`var${varIdx + 1}`]: e.target.value })} className="w-full bg-[#2a3942] text-white text-sm rounded-lg p-2 outline-none" />
                    ));
                  })}
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="mb-2">
              <p className="text-[#00a884] text-sm mb-2">Message Preview</p>
              <div className="bg-[#111b21] rounded-lg p-3">
                {template.components?.map((comp, idx) => {
                  if (comp.type === 'HEADER') {
                    if (comp.format === 'IMAGE') return <div key={idx} className="text-[#8696a0] text-sm mb-2">🖼️ [Image Header]</div>;
                    if (comp.format === 'VIDEO') return <div key={idx} className="text-[#8696a0] text-sm mb-2">🎬 [Video Header]</div>;
                  } else if (comp.type === 'BODY') {
                    let bodyText = comp.text || comp.example?.body_text?.[0] || '';
                    Object.entries(variables).forEach(([key, value]) => { bodyText = bodyText.replace(`{{${key.replace('var', '')}}}`, value); });
                    return <p key={idx} className="text-white text-sm mb-2">{bodyText}</p>;
                  } else if (comp.type === 'FOOTER') {
                    return <p key={idx} className="text-[#8696a0] text-xs mt-2 pt-2 border-t border-[#2a3942]">{comp.text}</p>;
                  } else if (comp.type === 'BUTTONS' && comp.buttons) {
                    return (
                      <div key={idx} className="flex flex-col gap-2 mt-3">
                        {comp.buttons.map((btn, btnIdx) => (
                          <div key={btnIdx} className={`text-center py-2 rounded-lg text-sm ${btn.type === 'FLOW' ? 'bg-purple-500/20 text-purple-300' : 'bg-[#00a884] text-white'}`}>
                            {btn.type === 'FLOW' ? '🔄 ' : ''}{btn.text}
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-[#8696a0] text-sm mb-2">Send to Phone Number</label>
            <input type="tel" value={phone} onChange={(e) => onPhoneChange(e.target.value)} placeholder="e.g., +919004363902" className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" />
          </div>

          <div className="flex gap-3">
            <button
              onClick={onSend}
              disabled={sendingTemplate || !phone}
              className={`flex-1 py-2 rounded-lg disabled:opacity-50 transition text-white ${hasFlow ? 'bg-purple-600 hover:bg-purple-700' : 'bg-[#00a884] hover:bg-[#008f6e]'}`}
            >
              {sendingTemplate ? 'Sending...' : hasFlow ? '🔄 Send Flow Template' : 'Send Template Message'}
            </button>
            <button onClick={onClose} className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}