// app/components/TemplateManager.tsx
'use client';

import { useState, useEffect } from 'react';

interface TemplateComponent {
  type: string;
  text?: string;
  format?: string;
  example?: {
    header_handle?: string[];
    body_text?: string[];
  };
  buttons?: Array<{
    type: string;
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

interface Template {
  id: string;
  name: string;
  status: string;
  language: string;
  category: string;
  components: TemplateComponent[];
  quality_score?: {
    score: string;
  };
  created_at?: string;
  last_modified?: string;
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sendTemplatePhone, setSendTemplatePhone] = useState('');
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [headerMediaFile, setHeaderMediaFile] = useState<File | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/bot/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      } else {
        setError(data.error || 'Failed to fetch templates');
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Network error while fetching templates');
    } finally {
      setLoading(false);
    }
  };

  const refreshTemplates = async () => {
    setRefreshing(true);
    await fetchTemplates();
    setRefreshing(false);
  };

  const uploadMediaToWhatsApp = async (file: File) => {
    setUploadingMedia(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('messaging_product', 'whatsapp');
    formData.append('type', file.type);

    try {
      const response = await fetch('/api/upload-whatsapp-media', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (data.success) {
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

  const sendTemplateMessage = async () => {
    if (!selectedTemplate || !sendTemplatePhone) return;
    
    setSendingTemplate(true);
    try {
      // Check if template has header component
      const headerComponent = selectedTemplate.components?.find(c => c.type === 'HEADER');
      const hasImageHeader = headerComponent?.format === 'IMAGE';
      const hasVideoHeader = headerComponent?.format === 'VIDEO';
      
      let uploadedMediaId = null;
      
      // If template has image/video header, upload the media first
      if ((hasImageHeader || hasVideoHeader) && headerMediaFile) {
        uploadedMediaId = await uploadMediaToWhatsApp(headerMediaFile);
        if (!uploadedMediaId) {
          alert('Please upload media file for the header');
          setSendingTemplate(false);
          return;
        }
      }
      
      // Prepare components for the template
      const components = [];
      
      // Add header component if media exists
      if (uploadedMediaId && (hasImageHeader || hasVideoHeader)) {
        components.push({
          type: 'HEADER',
          parameters: [
            {
              type: hasImageHeader ? 'image' : 'video',
              [hasImageHeader ? 'image' : 'video']: {
                id: uploadedMediaId
              }
            }
          ]
        });
      }
      
      // Add body component with variables
      const bodyComponent = selectedTemplate.components?.find(c => c.type === 'BODY');
      if (bodyComponent && Object.keys(templateVariables).length > 0) {
        const bodyParameters = [];
        const variableCount = getVariableCount(bodyComponent);
        for (let i = 1; i <= variableCount; i++) {
          if (templateVariables[`var${i}`]) {
            bodyParameters.push({
              type: 'text',
              text: templateVariables[`var${i}`]
            });
          }
        }
        if (bodyParameters.length > 0) {
          components.push({
            type: 'BODY',
            parameters: bodyParameters
          });
        }
      }
      
      const requestBody: any = {
        phone: sendTemplatePhone,
        template_name: selectedTemplate.name,
        language: selectedTemplate.language
      };
      
      if (components.length > 0) {
        requestBody.components = components;
      }
      
      const response = await fetch('/api/bot/send-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      const data = await response.json();
      if (data.success) {
        alert('✅ Template message sent successfully!');
        setShowPreviewModal(false);
        setSendTemplatePhone('');
        setHeaderMediaFile(null);
        setTemplateVariables({});
      } else {
        alert('❌ Failed to send template: ' + data.error);
      }
    } catch (error) {
      console.error('Error sending template:', error);
      alert('Failed to send template');
    } finally {
      setSendingTemplate(false);
    }
  };

  const getVariableCount = (component: TemplateComponent): number => {
    const bodyText = component.text || component.example?.body_text?.[0] || '';
    const matches = bodyText.match(/{{(\d+)}}/g);
    return matches ? matches.length : 0;
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

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: string } = {
      'MARKETING': '📢',
      'UTILITY': '⚙️',
      'AUTHENTICATION': '🔐',
    };
    return icons[category] || '📝';
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    const matchesStatus = selectedStatus === 'all' || template.status === selectedStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = ['all', ...new Set(templates.map(t => t.category).filter(Boolean))];
  const statuses = ['all', 'APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'];

  const renderTemplatePreview = (template: Template) => {
    const headerComponent = template.components?.find(c => c.type === 'HEADER');
    const bodyComponent = template.components?.find(c => c.type === 'BODY');
    const footerComponent = template.components?.find(c => c.type === 'FOOTER');
    const buttonsComponent = template.components?.find(c => c.type === 'BUTTONS');

    return (
      <div className="bg-[#111b21] rounded-lg p-4">
        {headerComponent && (
          <div className="mb-3">
            {headerComponent.format === 'IMAGE' && (
              <div className="bg-gray-700 rounded-lg p-3 text-center text-white text-sm">
                🖼️ Image Header
              </div>
            )}
            {headerComponent.format === 'VIDEO' && (
              <div className="bg-gray-700 rounded-lg p-3 text-center text-white text-sm">
                🎬 Video Header
              </div>
            )}
            {headerComponent.format === 'DOCUMENT' && (
              <div className="bg-gray-700 rounded-lg p-3 text-center text-white text-sm">
                📄 Document Header
              </div>
            )}
          </div>
        )}
        
        {bodyComponent && (
          <div className="text-white text-sm mb-3">
            {bodyComponent.text || bodyComponent.example?.body_text?.[0] || 'Template body text'}
          </div>
        )}
        
        {footerComponent && (
          <div className="text-[#8696a0] text-xs mb-3 pt-2 border-t border-[#2a3942]">
            {footerComponent.text}
          </div>
        )}
        
        {buttonsComponent?.buttons && (
          <div className="flex flex-col gap-2 mt-3">
            {buttonsComponent.buttons.map((btn, idx) => (
              <div key={idx} className="bg-[#00a884] text-white text-center py-2 rounded-lg text-sm">
                {btn.text}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-xl font-semibold">WhatsApp Templates</h2>
          <p className="text-[#8696a0] text-sm mt-1">Manage and send WhatsApp message templates</p>
        </div>
        <button
          onClick={refreshTemplates}
          disabled={refreshing}
          className="bg-[#2a3942] hover:bg-[#3a4a54] text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
        >
          <svg className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {refreshing ? 'Refreshing...' : 'Refresh Templates'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="bg-[#202c33] rounded-lg p-2 flex items-center gap-2">
            <svg className="w-5 h-5 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search templates..."
              className="bg-transparent flex-1 text-white outline-none text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-[#202c33] text-white rounded-lg px-3 py-2 outline-none text-sm"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {cat === 'all' ? 'All Categories' : cat}
            </option>
          ))}
        </select>
        
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-[#202c33] text-white rounded-lg px-3 py-2 outline-none text-sm"
        >
          {statuses.map(status => (
            <option key={status} value={status}>
              {status === 'all' ? 'All Status' : status}
            </option>
          ))}
        </select>
      </div>

      {/* Stats Summary */}
      {!loading && !error && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-[#202c33] rounded-lg p-3">
            <p className="text-[#8696a0] text-xs">Total Templates</p>
            <p className="text-white text-xl font-bold">{templates.length}</p>
          </div>
          <div className="bg-[#202c33] rounded-lg p-3">
            <p className="text-[#8696a0] text-xs">Approved</p>
            <p className="text-green-400 text-xl font-bold">
              {templates.filter(t => t.status === 'APPROVED').length}
            </p>
          </div>
          <div className="bg-[#202c33] rounded-lg p-3">
            <p className="text-[#8696a0] text-xs">Pending</p>
            <p className="text-yellow-400 text-xl font-bold">
              {templates.filter(t => t.status === 'PENDING').length}
            </p>
          </div>
          <div className="bg-[#202c33] rounded-lg p-3">
            <p className="text-[#8696a0] text-xs">Rejected</p>
            <p className="text-red-400 text-xl font-bold">
              {templates.filter(t => t.status === 'REJECTED').length}
            </p>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00a884] mx-auto mb-4"></div>
            <p className="text-white">Loading templates...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-[#202c33] rounded-lg p-8 text-center">
          <div className="text-yellow-400 text-4xl mb-3">⚠️</div>
          <p className="text-[#8696a0] mb-2">{error}</p>
          <button
            onClick={refreshTemplates}
            className="mt-4 text-[#00a884] hover:text-[#008f6e] text-sm"
          >
            Try Again
          </button>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-[#202c33] rounded-lg p-12 text-center">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-[#8696a0] mb-2">No templates found</p>
          <p className="text-sm text-[#6a7a84]">
            Create templates in your{' '}
            <a 
              href="https://business.facebook.com/wa/manage/message-templates/" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[#00a884] hover:underline"
            >
              Meta WhatsApp Manager
            </a>
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const headerType = getHeaderType(template);
            const variableCount = template.components
              .find(c => c.type === 'BODY')
              ?.text?.match(/{{(\d+)}}/g)?.length || 0;
            
            return (
              <div
                key={template.id}
                className="bg-[#202c33] rounded-lg p-4 hover:bg-[#2a3942] transition cursor-pointer border border-[#2a3942] hover:border-[#00a884]"
                onClick={() => {
                  setSelectedTemplate(template);
                  setTemplateVariables({});
                  setHeaderMediaFile(null);
                  setShowPreviewModal(true);
                }}
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{getCategoryIcon(template.category)}</span>
                      <h3 className="text-white font-semibold truncate">{template.name}</h3>
                    </div>
                    <p className="text-[#8696a0] text-xs">
                      {template.category} • {template.language.toUpperCase()}
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${getStatusBadge(template.status)} text-white`}>
                    {template.status}
                  </span>
                </div>
                
                <div className="mb-3">
                  <p className="text-[#e9edef] text-sm line-clamp-2">
                    {template.components.find(c => c.type === 'BODY')?.text || 'No preview'}
                  </p>
                </div>
                
                <div className="flex flex-wrap gap-2 mt-2">
                  {headerType !== 'none' && (
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      headerType === 'image' ? 'bg-green-500/20 text-green-400' :
                      headerType === 'video' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {headerType === 'image' ? '🖼️ Image' : headerType === 'video' ? '🎬 Video' : '📄 Document'}
                    </span>
                  )}
                  {variableCount > 0 && (
                    <span className="text-xs bg-purple-500/20 text-purple-400 px-2 py-1 rounded-full">
                      {variableCount} variable{variableCount > 1 ? 's' : ''}
                    </span>
                  )}
                  {template.components.some(c => c.type === 'BUTTONS') && (
                    <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">
                      Buttons
                    </span>
                  )}
                </div>
                
                {template.quality_score && (
                  <div className="mt-3 pt-2 border-t border-[#2a3942]">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      template.quality_score.score === 'GREEN' ? 'bg-green-500/20 text-green-400' :
                      template.quality_score.score === 'YELLOW' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    }`}>
                      Quality: {template.quality_score.score}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Template Preview & Send Modal */}
      {showPreviewModal && selectedTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#202c33] p-4 border-b border-[#2a3942] flex justify-between items-center">
              <div>
                <h3 className="text-white font-semibold">Template Preview</h3>
                <p className="text-[#8696a0] text-xs mt-1">{selectedTemplate.name}</p>
              </div>
              <button
                onClick={() => setShowPreviewModal(false)}
                className="text-white text-2xl hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Template Details */}
              <div className="bg-[#2a3942] rounded-lg p-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-[#8696a0] text-xs">Status</p>
                    <span className={`inline-block px-2 py-1 rounded-full text-xs mt-1 ${getStatusBadge(selectedTemplate.status)} text-white`}>
                      {selectedTemplate.status}
                    </span>
                  </div>
                  <div>
                    <p className="text-[#8696a0] text-xs">Language</p>
                    <p className="text-white">{selectedTemplate.language.toUpperCase()}</p>
                  </div>
                  <div>
                    <p className="text-[#8696a0] text-xs">Category</p>
                    <p className="text-white">{selectedTemplate.category}</p>
                  </div>
                  <div>
                    <p className="text-[#8696a0] text-xs">Quality Score</p>
                    <p className="text-white">{selectedTemplate.quality_score?.score || 'N/A'}</p>
                  </div>
                </div>
              </div>

              {/* Media Upload for Header */}
              {(() => {
                const headerComponent = selectedTemplate.components?.find(c => c.type === 'HEADER');
                const hasImageHeader = headerComponent?.format === 'IMAGE';
                const hasVideoHeader = headerComponent?.format === 'VIDEO';
                
                if (hasImageHeader || hasVideoHeader) {
                  return (
                    <div className="bg-[#2a3942] rounded-lg p-3">
                      <label className="block text-[#00a884] text-sm mb-2">
                        {hasImageHeader ? '🖼️ Upload Image for Header' : '🎬 Upload Video for Header'}
                      </label>
                      <input
                        type="file"
                        accept={hasImageHeader ? 'image/*' : 'video/*'}
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            setHeaderMediaFile(e.target.files[0]);
                          }
                        }}
                        className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none cursor-pointer"
                      />
                      {headerMediaFile && (
                        <div className="mt-2">
                          <p className="text-green-400 text-xs">✓ File selected: {headerMediaFile.name}</p>
                          {hasImageHeader && (
                            <img 
                              src={URL.createObjectURL(headerMediaFile)} 
                              alt="Preview" 
                              className="mt-2 max-h-32 rounded-lg object-cover"
                            />
                          )}
                        </div>
                      )}
                      {uploadingMedia && (
                        <div className="flex items-center gap-2 mt-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00a884]"></div>
                          <span className="text-xs text-[#8696a0]">Uploading media...</span>
                        </div>
                      )}
                    </div>
                  );
                }
                return null;
              })()}

              {/* Template Variables */}
              {(() => {
                const bodyComponent = selectedTemplate.components?.find(c => c.type === 'BODY');
                const variableCount = getVariableCount(bodyComponent!);
                
                if (variableCount > 0) {
                  return (
                    <div className="bg-[#2a3942] rounded-lg p-3">
                      <label className="block text-[#8696a0] text-sm mb-2">Template Variables</label>
                      <div className="space-y-2">
                        {Array.from({ length: variableCount }, (_, i) => i + 1).map((num) => (
                          <input
                            key={num}
                            type="text"
                            placeholder={`Variable ${num}`}
                            onChange={(e) => setTemplateVariables({
                              ...templateVariables,
                              [`var${num}`]: e.target.value
                            })}
                            className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                          />
                        ))}
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Preview */}
              <div className="bg-[#2a3942] rounded-lg p-3">
                <p className="text-[#8696a0] text-xs mb-2">Preview</p>
                {renderTemplatePreview(selectedTemplate)}
              </div>

              {/* Send Template */}
              <div className="bg-[#2a3942] rounded-lg p-3">
                <label className="block text-[#8696a0] text-sm mb-2">Send to Phone Number</label>
                <input
                  type="tel"
                  value={sendTemplatePhone}
                  onChange={(e) => setSendTemplatePhone(e.target.value)}
                  placeholder="e.g., +919004363902"
                  className="w-full bg-[#111b21] text-white rounded-lg p-2 outline-none mb-3"
                />
                <button
                  onClick={sendTemplateMessage}
                  disabled={sendingTemplate || !sendTemplatePhone}
                  className="w-full bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50"
                >
                  {sendingTemplate ? 'Sending...' : 'Send Template Message'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}