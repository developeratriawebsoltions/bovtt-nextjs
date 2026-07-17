'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Panel,
  Handle,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

// ============================================================================
// TYPES
// ============================================================================

interface Template {
  name: string;
  status: string;
  language: string;
  category: string;
  components: any[];
  id?: string;
}

type MediaType = 'none' | 'image' | 'video' | 'audio' | 'document';

interface MediaAttachment {
  type: MediaType;
  media_id?: string;
  url?: string;
  filename?: string;
  caption?: string;
  mime_type?: string;
}

interface BotFlowBuilderProps {
  flowId?: number;
  onSave?: () => void;
  onClose?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function isFlowTemplate(template: Template): boolean {
  const buttonComp = template.components?.find((c: any) => c.type === 'BUTTONS');
  if (!buttonComp?.buttons) return false;
  return buttonComp.buttons.some(
    (btn: any) => btn.type === 'FLOW' || btn.flow_id != null
  );
}

const MEDIA_ACCEPT: Record<MediaType, string> = {
  none:     '',
  image:    'image/jpeg,image/png,image/webp',
  video:    'video/mp4,video/3gpp',
  audio:    'audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg',
  document: 'application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const MEDIA_MAX_MB: Record<MediaType, number> = {
  none: 0, image: 5, video: 16, audio: 16, document: 100,
};

const MEDIA_ICON: Record<MediaType, string> = {
  none: '', image: '🖼️', video: '🎬', audio: '🎵', document: '📄',
};

// ============================================================================
// ICONS
// ============================================================================

const Icons = {
  Start: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Message: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  Template: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  Question: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  Condition: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  End: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  Variable: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l5 5a2 2 0 01.586 1.414V19a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  ),
  Image: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  Plus: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  ),
  Trash: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  ),
  Settings: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  Drag: () => (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
    </svg>
  ),
  Flow: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  Media: () => (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  ),
};

// ============================================================================
// CUSTOM NODES
// ============================================================================

const StartNode = ({ data }: { data: any }) => (
  <div className="bg-green-500 rounded-lg w-48 p-3 shadow-lg border-2 border-white cursor-pointer hover:shadow-xl transition relative">
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white" />
    <div className="flex items-center gap-2 text-white">
      <Icons.Start />
      <div className="font-semibold text-sm">Start</div>
    </div>
  </div>
);

// MESSAGE NODE — text only, no media
const MessageNode = ({ data }: { data: any }) => (
  <div className="bg-blue-500 rounded-lg w-64 p-3 shadow-lg border-2 border-white cursor-pointer hover:shadow-xl transition relative">
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-white" />
    <div className="flex items-center gap-2 text-white mb-2">
      <Icons.Message />
      <div className="font-semibold text-sm">Send Message</div>
    </div>
    <div className="text-white text-xs break-words line-clamp-2 bg-white/10 rounded p-2">
      {data.message ? data.message.substring(0, 60) : 'Click to edit message'}
    </div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white" />
  </div>
);

// MEDIA NODE — standalone media send (image / video / audio / document)
const MediaNode = ({ data }: { data: any }) => {
  const media: MediaAttachment | undefined = data.media;
  const type = media?.type || 'none';
  return (
    <div className="bg-teal-600 rounded-lg w-64 p-3 shadow-lg border-2 border-white cursor-pointer hover:shadow-xl transition relative">
      <Handle type="target" position={Position.Left} className="w-3 h-3 bg-white" />
      <div className="flex items-center gap-2 text-white mb-2">
        <Icons.Media />
        <div className="font-semibold text-sm">Send Media</div>
        {type !== 'none' && (
          <span className="ml-auto text-base">{MEDIA_ICON[type]}</span>
        )}
      </div>
      <div className="text-white/80 text-xs bg-white/10 rounded px-2 py-1.5 flex items-center gap-1">
        {type !== 'none' ? (
          <>
            {MEDIA_ICON[type]}
            <span className="capitalize">{type}</span>
            {media?.media_id && <span className="text-green-300 ml-1">✓ uploaded</span>}
            {media?.url && !media.media_id && <span className="text-yellow-300 ml-1">URL</span>}
          </>
        ) : (
          <span className="text-white/50 italic">No media selected — click to add</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white" />
    </div>
  );
};

const TemplateNode = ({ data }: { data: any }) => (
  <div className={`rounded-lg w-64 p-3 shadow-lg border-2 border-white cursor-pointer hover:shadow-xl transition relative ${data.is_flow_template ? 'bg-purple-700' : 'bg-purple-500'}`}>
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-white" />
    <div className="flex items-center gap-2 text-white mb-2">
      {data.is_flow_template ? <Icons.Flow /> : <Icons.Template />}
      <div className="font-semibold text-sm">
        {data.is_flow_template ? 'Meta Flow Template' : 'WhatsApp Template'}
      </div>
    </div>
    <div className="text-white text-xs bg-white/10 rounded p-2">
      {data.template_name || 'Select template'}
    </div>
    {data.is_flow_template && (
      <div className="mt-1 text-xs text-purple-200 flex items-center gap-1">
        🔄 Flow: {data.flow_token || 'unused'}
      </div>
    )}
    {data.has_image_header && !data.is_flow_template && (
      <div className="absolute -top-2 -right-2 bg-green-500 rounded-full p-1">
        <Icons.Image />
      </div>
    )}
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white" />
  </div>
);

const QuestionNode = ({ data }: { data: any }) => (
  <div className="bg-yellow-500 rounded-lg w-80 p-3 shadow-lg border-2 border-white cursor-pointer hover:shadow-xl transition relative">
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-white" />
    <div className="flex items-center gap-2 text-white mb-2">
      <Icons.Question />
      <div className="font-semibold text-sm">Ask Question</div>
    </div>
    <div className="text-white text-xs bg-white/10 rounded p-2 mb-2">
      {data.message?.substring(0, 40) || 'Enter question'}
    </div>
    {data.save_as_variable && (
      <div className="text-white/70 text-[9px] flex items-center gap-1">
        <Icons.Variable />
        Save to: {data.save_as_variable}
      </div>
    )}
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white" />
  </div>
);

const ConditionNode = ({ data }: { data: any }) => (
  <div className="bg-orange-500 rounded-lg w-64 p-3 shadow-lg border-2 border-white cursor-pointer hover:shadow-xl transition relative">
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-white" />
    <div className="flex items-center gap-2 text-white mb-2">
      <Icons.Condition />
      <div className="font-semibold text-sm">Condition</div>
    </div>
    <div className="text-white text-xs bg-white/10 rounded p-2 font-mono">
      {data.condition || 'If condition'}
    </div>
    <Handle type="source" position={Position.Right} className="w-3 h-3 bg-white" />
  </div>
);

const EndNode = ({ data }: { data: any }) => (
  <div className="bg-gray-500 rounded-lg w-48 p-3 shadow-lg border-2 border-white cursor-pointer hover:shadow-xl transition relative">
    <Handle type="target" position={Position.Left} className="w-3 h-3 bg-white" />
    <div className="flex items-center gap-2 text-white">
      <Icons.End />
      <div className="font-semibold text-sm">End</div>
    </div>
  </div>
);

const nodeTypes = {
  start:     StartNode,
  message:   MessageNode,
  media:     MediaNode,       // standalone media node
  template:  TemplateNode,
  question:  QuestionNode,
  condition: ConditionNode,
  end:       EndNode,
};

// ============================================================================
// MEDIA UPLOADER COMPONENT
// ============================================================================

interface MediaUploaderProps {
  media: MediaAttachment;
  onChange: (media: MediaAttachment) => void;
}

function MediaUploader({ media, onChange }: MediaUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [useUrl, setUseUrl] = useState<boolean>(!!media.url && !media.media_id);

  const selectedType = media.type || 'none';

  const handleTypeChange = (type: MediaType) => {
    onChange({ type, caption: media.caption });
    setPreview(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxBytes = MEDIA_MAX_MB[selectedType] * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`File too large. Max size for ${selectedType} is ${MEDIA_MAX_MB[selectedType]} MB.`);
      return;
    }

    if (selectedType === 'image') setPreview(URL.createObjectURL(file));
    if (selectedType === 'video') setPreview(URL.createObjectURL(file));

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', selectedType);

      const res = await fetch('/api/upload-whatsapp-media', { method: 'POST', body: formData });
      const result = await res.json();

      if (result.success) {
        onChange({
          ...media,
          type: selectedType,
          media_id: result.media_id,
          filename: file.name,
          mime_type: file.type,
          url: undefined,
        });
        alert(`✅ ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} uploaded! media_id: ${result.media_id}`);
      } else {
        alert('Upload failed: ' + (result.error || 'Unknown error'));
      }
    } catch {
      alert('Error uploading file');
    } finally {
      setUploading(false);
    }
  };

  const handleUrlChange = (url: string) => {
    onChange({ ...media, url, media_id: undefined });
  };

  const handleCaptionChange = (caption: string) => {
    onChange({ ...media, caption });
  };

  const handleFilenameChange = (filename: string) => {
    onChange({ ...media, filename });
  };

  const clearMedia = () => {
    onChange({ type: 'none' });
    setPreview(null);
  };

  const mediaTypes: { value: MediaType; label: string; emoji: string }[] = [
    { value: 'none',     label: 'None',     emoji: '✉️' },
    { value: 'image',    label: 'Image',    emoji: '🖼️' },
    { value: 'video',    label: 'Video',    emoji: '🎬' },
    { value: 'audio',    label: 'Audio',    emoji: '🎵' },
    { value: 'document', label: 'Document', emoji: '📄' },
  ];

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-[#8696a0] text-sm mb-2 flex items-center gap-2">
          <Icons.Media /> Select Media Type
        </label>
        <div className="flex gap-2 flex-wrap">
          {mediaTypes.map((mt) => (
            <button
              key={mt.value}
              onClick={() => handleTypeChange(mt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition border ${
                selectedType === mt.value
                  ? 'bg-teal-600 border-teal-600 text-white font-medium'
                  : 'bg-[#2a3942] border-[#3a4a52] text-[#8696a0] hover:text-white hover:border-teal-600/50'
              }`}
            >
              <span>{mt.emoji}</span> {mt.label}
            </button>
          ))}
        </div>
      </div>

      {selectedType !== 'none' && (
        <div className="bg-[#2a3942] rounded-lg p-3 space-y-3">

          {/* Upload vs URL toggle */}
          <div className="flex gap-3 text-xs">
            <button
              onClick={() => setUseUrl(false)}
              className={`px-3 py-1 rounded transition ${!useUrl ? 'bg-teal-600 text-white' : 'bg-[#111b21] text-[#8696a0] hover:text-white'}`}
            >
              ⬆️ Upload File
            </button>
            <button
              onClick={() => setUseUrl(true)}
              className={`px-3 py-1 rounded transition ${useUrl ? 'bg-teal-600 text-white' : 'bg-[#111b21] text-[#8696a0] hover:text-white'}`}
            >
              🔗 URL Link
            </button>
          </div>

          {/* Upload file */}
          {!useUrl && (
            <div>
              <input
                type="file"
                accept={MEDIA_ACCEPT[selectedType]}
                onChange={handleFileSelect}
                disabled={uploading}
                className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none cursor-pointer disabled:opacity-50 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:bg-teal-600 file:text-white file:text-xs file:cursor-pointer"
              />
              <p className="text-[#6a7a84] text-xs mt-1">
                {selectedType === 'image'    && 'JPG, PNG, WebP — max 5 MB'}
                {selectedType === 'video'    && 'MP4, 3GPP — max 16 MB'}
                {selectedType === 'audio'    && 'AAC, MP4, MP3, AMR, OGG — max 16 MB'}
                {selectedType === 'document' && 'PDF, DOCX, XLSX, TXT — max 100 MB'}
              </p>

              {uploading && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-teal-400"></div>
                  <span className="text-white text-xs">Uploading to WhatsApp...</span>
                </div>
              )}

              {preview && selectedType === 'image' && (
                <img src={preview} alt="Preview" className="mt-2 rounded-lg max-h-32 object-cover w-full" />
              )}
              {preview && selectedType === 'video' && (
                <video src={preview} controls className="mt-2 rounded-lg max-h-32 w-full" />
              )}

              {media.media_id && (
                <div className="mt-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 flex items-center justify-between">
                  <div>
                    <p className="text-green-400 text-xs font-medium">✓ Uploaded successfully</p>
                    <p className="text-[#6a7a84] text-[10px] font-mono mt-0.5 truncate max-w-[240px]">ID: {media.media_id}</p>
                    {media.filename && <p className="text-[#8696a0] text-[10px] mt-0.5">📎 {media.filename}</p>}
                  </div>
                  <button onClick={clearMedia} className="text-red-400 hover:text-red-300 text-xs px-2 py-1 hover:bg-red-400/10 rounded transition">
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}

          {/* URL input */}
          {useUrl && (
            <div>
              <label className="text-[#8696a0] text-xs mb-1 block">Media URL</label>
              <input
                type="url"
                value={media.url || ''}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={`https://example.com/file.${selectedType === 'image' ? 'jpg' : selectedType === 'video' ? 'mp4' : selectedType === 'audio' ? 'mp3' : 'pdf'}`}
                className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-500"
              />
              <p className="text-[#6a7a84] text-xs mt-1">Must be a publicly accessible URL</p>
            </div>
          )}

          {/* Caption — for image & video */}
          {(selectedType === 'image' || selectedType === 'video') && (
            <div>
              <label className="text-[#8696a0] text-xs mb-1 block">Caption <span className="text-[#6a7a84]">(optional)</span></label>
              <input
                type="text"
                value={media.caption || ''}
                onChange={(e) => handleCaptionChange(e.target.value)}
                placeholder="Caption shown below the media..."
                className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          )}

          {/* Filename — for documents */}
          {selectedType === 'document' && (
            <div>
              <label className="text-[#8696a0] text-xs mb-1 block">Display Filename <span className="text-[#6a7a84]">(optional)</span></label>
              <input
                type="text"
                value={media.filename || ''}
                onChange={(e) => handleFilenameChange(e.target.value)}
                placeholder="e.g., Invoice_Q3.pdf"
                className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          )}

          {/* Info */}
          <div className="bg-[#111b21] rounded-lg p-2 text-xs text-[#6a7a84] space-y-0.5">
            <p className="text-[#8696a0] font-medium mb-1">📡 How this sends:</p>
            {selectedType === 'image'    && <p>Sends as a WhatsApp image message. Caption appears below.</p>}
            {selectedType === 'video'    && <p>Sends as a WhatsApp video message. Caption appears below.</p>}
            {selectedType === 'audio'    && <p>Sends as a WhatsApp audio/voice message.</p>}
            {selectedType === 'document' && <p>Sends as a WhatsApp document. Filename is shown to the user.</p>}
            <p className="mt-1">
              {!useUrl
                ? 'File is uploaded to WhatsApp servers first; the saved media_id is reused each send.'
                : 'URL is fetched by WhatsApp on each send. Make sure it stays accessible.'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CONDITION MODAL
// ============================================================================

interface ConditionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (condition: string) => void;
  currentCondition?: string;
  isRequired?: boolean;
  title?: string;
}

function ConditionModal({ isOpen, onClose, onSave, currentCondition = '', isRequired = false, title = 'Edge Condition' }: ConditionModalProps) {
  const [condition, setCondition] = useState(currentCondition);

  useEffect(() => {
    setCondition(currentCondition);
  }, [currentCondition, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (isRequired && !condition.trim()) {
      alert('Condition is required for this connection!');
      return;
    }
    onSave(condition);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
      <div className="bg-[#202c33] rounded-lg w-full max-w-md">
        <div className="p-4 border-b border-[#2a3942] flex justify-between items-center">
          <h3 className="text-white font-semibold">{title}</h3>
          <button onClick={onClose} className="text-white text-2xl hover:text-gray-300">✕</button>
        </div>
        <div className="p-4">
          <label className="block text-[#8696a0] text-sm mb-2">
            Condition Value {isRequired && <span className="text-red-400">*</span>}
          </label>
          <input
            type="text"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder={isRequired ? 'e.g., 1, 2, yes, no' : 'Optional — leave empty for default path'}
            className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
            autoFocus
          />
          <div className="mt-3 text-[#8696a0] text-xs space-y-1">
            <p className="font-semibold text-[#00a884] mb-1">Examples:</p>
            <p>• <code className="bg-[#2a3942] px-1 rounded">1</code> — exact match for number 1</p>
            <p>• <code className="bg-[#2a3942] px-1 rounded">yes</code> — exact match for yes</p>
            <p>• <code className="bg-[#2a3942] px-1 rounded">user_input == "1"</code> — explicit match pattern</p>
            <p>• <code className="bg-[#2a3942] px-1 rounded">user_input contains "hello"</code> — partial match</p>
            <p>• <code className="bg-[#2a3942] px-1 rounded">flow_completed</code> — after Meta Flow submission</p>
          </div>
        </div>
        <div className="p-4 border-t border-[#2a3942] flex gap-3">
          <button onClick={handleSave} className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] transition">Save</button>
          <button onClick={onClose} className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DRAGGABLE TOOLBAR
// ============================================================================

function DraggableToolbar({ onAddNode }: { onAddNode: (type: string) => void }) {
  const [position, setPosition] = useState({ x: 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (toolbarRef.current) {
      const rect = toolbarRef.current.getBoundingClientRect();
      setDragOffset({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setIsDragging(true);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 100, e.clientX - dragOffset.x)),
        y: Math.max(0, Math.min(window.innerHeight - 400, e.clientY - dragOffset.y)),
      });
    }
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => setIsDragging(false), []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const toolbarItems = [
    { type: 'start',     icon: 'text-green-500',  label: 'Start',     Icon: Icons.Start },
    { type: 'message',   icon: 'text-blue-500',   label: 'Message',   Icon: Icons.Message },
    { type: 'media',     icon: 'text-teal-400',   label: 'Media',     Icon: Icons.Media },
    { type: 'template',  icon: 'text-purple-500', label: 'Template',  Icon: Icons.Template },
    { type: 'question',  icon: 'text-yellow-500', label: 'Question',  Icon: Icons.Question },
    { type: 'condition', icon: 'text-orange-500', label: 'Condition', Icon: Icons.Condition },
    { type: 'end',       icon: 'text-gray-400',   label: 'End',       Icon: Icons.End },
  ];

  return (
    <div
      ref={toolbarRef}
      className="fixed z-20 bg-[#202c33] rounded-lg shadow-xl p-2 flex flex-col gap-1 cursor-move select-none border border-[#2a3942]"
      style={{ left: position.x, top: position.y }}
    >
      <div
        className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-[#2a3942] rounded-t-lg px-2 py-0.5 cursor-move"
        onMouseDown={handleMouseDown}
      >
        <Icons.Drag />
      </div>
      <div className="pt-2">
        {toolbarItems.map((item) => (
          <button
            key={item.type}
            onClick={() => onAddNode(item.type)}
            className="p-1.5 hover:bg-[#2a3942] rounded transition group relative w-full flex items-center justify-center"
            title={item.label}
          >
            <span className={item.icon}><item.Icon /></span>
            <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 bg-[#2a3942] text-white text-xs px-2 py-1 rounded whitespace-nowrap hidden group-hover:block z-30 border border-[#3a4a54]">
              {item.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function BotFlowBuilder({ flowId, onSave, onClose }: BotFlowBuilderProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const [flowName, setFlowName]               = useState('');
  const [flowDescription, setFlowDescription] = useState('');
  const [triggerKeyword, setTriggerKeyword]   = useState('');
  const [isActive, setIsActive]               = useState(true);
  const [templates, setTemplates]             = useState<Template[]>([]);
  const [selectedNode, setSelectedNode]       = useState<Node | null>(null);
  const [editModalOpen, setEditModalOpen]     = useState(false);
  const [editData, setEditData]               = useState<any>({});
  const [saving, setSaving]                   = useState(false);
  const [loading, setLoading]                 = useState(false);

  // Template edit state
  const [templateVariables, setTemplateVariables]         = useState<Record<string, string>>({});
  const [headerImageFile, setHeaderImageFile]             = useState<File | null>(null);
  const [headerImagePreview, setHeaderImagePreview]       = useState<string | null>(null);
  const [uploadingImage, setUploadingImage]               = useState(false);
  const [hasImageHeader, setHasImageHeader]               = useState(false);
  const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState<Template | null>(null);
  const [showTemplatePreview, setShowTemplatePreview]     = useState(false);

  // UI panels
  const [showFlowSettings, setShowFlowSettings]     = useState(false);
  const [showVariablesPanel, setShowVariablesPanel] = useState(false);
  const [showTestModal, setShowTestModal]           = useState(false);
  const [testPhone, setTestPhone]                   = useState('');
  const [testingFlow, setTestingFlow]               = useState(false);

  // Condition modal
  const [showConditionModal, setShowConditionModal] = useState(false);
  const [pendingConnection, setPendingConnection]   = useState<Connection | null>(null);
  const [pendingEdge, setPendingEdge]               = useState<Edge | null>(null);
  const [isEdgeEdit, setIsEdgeEdit]                 = useState(false);
  const [conditionRequired, setConditionRequired]   = useState(false);

  const reactFlowWrapper  = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<any>(null);

  // ── Fetch templates & optionally load existing flow ────────────────────────
  useEffect(() => {
    fetchTemplates();
    if (flowId) loadFlow(flowId);
  }, [flowId]);

  const fetchTemplates = async () => {
    try {
      const res  = await fetch('/api/bot/templates');
      const data = await res.json();
      if (data.success) {
        setTemplates(data.templates.filter((t: any) => t.status === 'APPROVED'));
      }
    } catch (err) {
      console.error('fetchTemplates:', err);
    }
  };

  const loadFlow = async (id: number) => {
    setLoading(true);
    try {
      const res  = await fetch(`/api/bot/flows/${id}`);
      const data = await res.json();

      if (data.success && data.flow) {
        setFlowName(data.flow.name || '');
        setFlowDescription(data.flow.description || '');
        setTriggerKeyword(data.flow.trigger_keyword || '');
        setIsActive(data.flow.is_active === 1 || data.flow.is_active === true);

        let flowData = data.flow.flow_data;
        if (typeof flowData === 'string') flowData = JSON.parse(flowData);

        const loadedNodes = flowData?.nodes || [];
        let   loadedEdges = flowData?.edges || [];

        loadedEdges = loadedEdges.map((edge: any, idx: number) => {
          const condition = edge.condition || edge.data?.condition || '';
          return {
            id: edge.id || `edge_${idx}_${Date.now()}`,
            source: edge.source,
            target: edge.target,
            condition,
            data: { condition },
            markerEnd: { type: 'arrowclosed' },
            style: { stroke: '#00a884', strokeWidth: 2 },
            label: condition || undefined,
            labelStyle: { fill: '#00a884', fontWeight: 500, fontSize: 10 },
          };
        });

        const processedNodes = loadedNodes.map((node: any) => {
          if (node.type === 'template' && node.data.template_variables) {
            const vars = node.data.template_variables;
            if (Array.isArray(vars)) {
              const obj: Record<string, string> = {};
              vars.forEach((v: string, i: number) => { obj[i.toString()] = v; });
              node.data.template_variables = obj;
            }
          }
          if (node.type === 'template') {
            node.data = {
              is_flow_template: false,
              flow_token: 'unused',
              flow_action_data: {},
              ...node.data,
            };
          }
          // Ensure media field exists on media nodes
          if (node.type === 'media' && !node.data.media) {
            node.data.media = { type: 'none' };
          }
          return { ...node, position: node.position || { x: 100, y: 100 }, data: node.data || {} };
        });

        setNodes(processedNodes);
        setEdges(loadedEdges);
      }
    } catch (err) {
      console.error('loadFlow:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Connections ────────────────────────────────────────────────────────────
  const onConnect = useCallback((params: Connection) => {
    setPendingConnection(params);
    setConditionRequired(false);
    setIsEdgeEdit(false);
    setShowConditionModal(true);
  }, []);

  const handleConditionSave = (condition: string) => {
    if (isEdgeEdit && pendingEdge) {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === pendingEdge.id
            ? { ...e, condition, data: { condition }, label: condition || undefined, labelStyle: { fill: '#00a884', fontWeight: 500, fontSize: 10 } }
            : e
        )
      );
    } else if (pendingConnection) {
      const edgeId  = `edge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newEdge = {
        ...pendingConnection,
        id: edgeId,
        condition,
        data: { condition },
        markerEnd: { type: 'arrowclosed' },
        style: { stroke: '#00a884', strokeWidth: 2 },
        label: condition || undefined,
        labelStyle: { fill: '#00a884', fontWeight: 500, fontSize: 10 },
      };
      setEdges((eds) => addEdge(newEdge, eds));
    }
    setShowConditionModal(false);
    setPendingConnection(null);
    setPendingEdge(null);
  };

  const onEdgeClick = (_: React.MouseEvent, edge: Edge) => {
    setPendingEdge(edge);
    setConditionRequired(false);
    setIsEdgeEdit(true);
    setShowConditionModal(true);
  };

  // ── Add node ───────────────────────────────────────────────────────────────
  const addNode = (type: string) => {
    if (!reactFlowInstance) return;
    const position = reactFlowInstance.project({ x: window.innerWidth / 2 - 100, y: window.innerHeight / 2 - 50 });
    const nodeId   = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    setNodes((nds) => [...nds, { id: nodeId, type, position, data: getDefaultNodeData(type) }]);
  };

  const getDefaultNodeData = (type: string) => {
    switch (type) {
      case 'start':     return { label: 'Start' };
      case 'message':   return { label: 'Message', message: 'Enter your message here...' };
      case 'media':     return { label: 'Media', media: { type: 'none' } as MediaAttachment };
      case 'template':  return { label: 'Template', template_name: '', message: '', template_variables: {}, has_image_header: false, header_image_id: null, is_flow_template: false, flow_token: 'unused', flow_action_data: {} };
      case 'question':  return { label: 'Question', message: 'Ask a question...', save_as_variable: 'user_response' };
      case 'condition': return { label: 'Condition', condition: 'user_input == "value"' };
      case 'end':       return { label: 'End', message: 'Thank you! Conversation ended.' };
      default:          return { label: 'Node' };
    }
  };

  // ── Node click → open edit modal ──────────────────────────────────────────
  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);

    let data = { ...node.data };

    if (node.type === 'template') {
      data = {
        is_flow_template: false,
        flow_token: 'unused',
        flow_action_data: {},
        has_image_header: false,
        header_image_id: null,
        template_variables: {},
        ...data,
      };

      setHeaderImageFile(null);
      setHeaderImagePreview(null);
      setHasImageHeader(data.has_image_header || false);

      let vars = data.template_variables;
      if (Array.isArray(vars)) {
        const obj: Record<string, string> = {};
        vars.forEach((v: string, i: number) => { obj[i.toString()] = v; });
        vars = obj;
      }
      setTemplateVariables(vars || {});
      data.template_variables = vars || {};

      if (data.template_name) {
        const tpl = templates.find((t) => t.name === data.template_name);
        if (tpl) {
          setSelectedTemplateForPreview(tpl);
          setShowTemplatePreview(true);
        }
      }
    }

    // Ensure media field exists on media nodes
    if (node.type === 'media' && !data.media) {
      data.media = { type: 'none' } as MediaAttachment;
    }

    setEditData(data);
    setEditModalOpen(true);
  };

  const updateNodeData = () => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((node) => (node.id === selectedNode.id ? { ...node, data: { ...node.data, ...editData } } : node))
    );
    setEditModalOpen(false);
    setSelectedNode(null);
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    if (!confirm(`Delete this ${selectedNode.type} node?`)) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) => eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id));
    setEditModalOpen(false);
    setSelectedNode(null);
  };

  // ── Template helpers ───────────────────────────────────────────────────────
  const getTemplateBodyVariables = (template: Template): string[] => {
    const body = template.components?.find((c: any) => c.type === 'BODY');
    if (!body) return [];
    const matches = (body.text || '').match(/\{\{(\d+)\}\}/g) || [];
    return matches.map((m: string) => m.replace(/\{\{|\}\}/g, ''));
  };

  const checkHasImageHeader = (template: Template) =>
    template.components?.find((c: any) => c.type === 'HEADER')?.format === 'IMAGE';

  // ── Header image upload ────────────────────────────────────────────────────
  const handleHeaderImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5MB'); return; }
    if (!file.type.startsWith('image/')) { alert('Please select an image file'); return; }

    setHeaderImageFile(file);
    setHeaderImagePreview(URL.createObjectURL(file));
    setUploadingImage(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', 'image');

      const res    = await fetch('/api/upload-whatsapp-media', { method: 'POST', body: formData });
      const result = await res.json();

      if (result.success) {
        setEditData((prev: any) => ({ ...prev, has_image_header: true, header_image_id: result.media_id }));
        alert('✅ Image uploaded successfully!');
      } else {
        alert('Failed to upload image: ' + result.error);
      }
    } catch (err) {
      alert('Error uploading image');
    } finally {
      setUploadingImage(false);
    }
  };

  // ── Template preview renderer ──────────────────────────────────────────────
  const renderTemplatePreview = (template: Template) => {
    const header  = template.components?.find((c: any) => c.type === 'HEADER');
    const body    = template.components?.find((c: any) => c.type === 'BODY');
    const footer  = template.components?.find((c: any) => c.type === 'FOOTER');
    const buttons = template.components?.find((c: any) => c.type === 'BUTTONS');

    let previewBody = body?.text || '';
    Object.entries(templateVariables).forEach(([k, v]) => {
      previewBody = previewBody.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), v || `{{${k}}}`);
    });

    return (
      <div className="bg-[#111b21] rounded-lg p-4">
        {header?.format === 'IMAGE' && (
          <div className="mb-3">
            {headerImagePreview
              ? <img src={headerImagePreview} alt="Header" className="rounded-lg max-h-40 w-full object-cover" />
              : <div className="bg-gray-700 rounded-lg p-3 text-center text-white text-sm">🖼️ Image Header</div>
            }
          </div>
        )}
        {header?.format === 'VIDEO'    && <div className="bg-gray-700 rounded-lg p-3 text-center text-white text-sm mb-3">🎬 Video Header</div>}
        {header?.format === 'DOCUMENT' && <div className="bg-gray-700 rounded-lg p-3 text-center text-white text-sm mb-3">📄 Document Header</div>}
        {header?.format === 'TEXT'     && <p className="text-white font-semibold text-sm mb-2">{header.text}</p>}

        <div className="text-white text-sm mb-3 whitespace-pre-wrap">{previewBody}</div>

        {footer && <div className="text-[#8696a0] text-xs mb-3 pt-2 border-t border-[#2a3942]">{footer.text}</div>}

        {buttons?.buttons && (
          <div className="flex flex-col gap-2 mt-3">
            {buttons.buttons.map((btn: any, idx: number) => (
              <div key={idx} className={`text-center py-2 rounded-lg text-sm ${btn.type === 'FLOW' ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40' : 'bg-[#00a884]/20 text-[#00a884]'}`}>
                {btn.type === 'FLOW' ? '🔄 ' : ''}{btn.text}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── Save flow to DB ────────────────────────────────────────────────────────
  const saveFlow = async () => {
    if (!flowName.trim()) { alert('Please enter a flow name'); return; }

    setSaving(true);
    try {
      const processedNodes = nodes.map((node) => {
        if (node.type === 'template') {
          let templateVars: string[] = [];
          if (node.data.template_variables) {
            if (Array.isArray(node.data.template_variables)) {
              templateVars = node.data.template_variables;
            } else if (typeof node.data.template_variables === 'object') {
              templateVars = Object.values(node.data.template_variables);
            }
          }

          let flowActionData = node.data.flow_action_data || {};
          if (Array.isArray(flowActionData)) flowActionData = {};

          return {
            ...node,
            data: {
              ...node.data,
              template_variables: templateVars,
              flow_action_data:   flowActionData,
              is_flow_template:   node.data.is_flow_template || false,
              flow_token:         node.data.flow_token        || 'unused',
            },
          };
        }

        // Normalise media for media nodes: keep the full MediaAttachment object
        if (node.type === 'media') {
          const media: MediaAttachment = node.data.media || { type: 'none' };
          return {
            ...node,
            data: {
              ...node.data,
              media,
            },
          };
        }

        return node;
      });

      const processedEdges = edges.map((edge) => ({
        id:        edge.id,
        source:    edge.source,
        target:    edge.target,
        condition: edge.data?.condition || '',
        data:      { condition: edge.data?.condition || '' },
      }));

      const payload = {
        name:            flowName,
        description:     flowDescription,
        trigger_keyword: triggerKeyword || null,
        is_active:       isActive ? 1 : 0,
        flow_data: {
          nodes: processedNodes.map(({ id, type, position, data }) => ({ id, type, position, data })),
          edges: processedEdges,
        },
      };

      const method = flowId ? 'PUT' : 'POST';
      const body   = flowId ? { id: flowId, ...payload } : payload;

      const res    = await fetch('/api/bot/flows', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await res.json();

      if (result.success) {
        alert(`✅ Flow saved! (${nodes.length} nodes, ${edges.length} edges)`);
        if (onSave) onSave();
      } else {
        alert('❌ Failed to save: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('saveFlow:', err);
      alert('Error saving flow');
    } finally {
      setSaving(false);
    }
  };

  // ── Test flow ──────────────────────────────────────────────────────────────
  const testFlow = async () => {
    if (!testPhone.trim()) { alert('Please enter a phone number'); return; }
    setTestingFlow(true);
    try {
      const res    = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, message: triggerKeyword || 'test', type: 'text' }),
      });
      const result = await res.json();
      if (result.success) { alert(`✅ Test sent to ${testPhone}!`); setShowTestModal(false); setTestPhone(''); }
      else alert('Failed to send test message');
    } catch {
      alert('Error testing flow');
    } finally {
      setTestingFlow(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#111b21]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884] mx-auto mb-3"></div>
          <p className="text-white text-sm">Loading flow...</p>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // RENDER
  // ==========================================================================
  return (
    <div className="h-full flex flex-col bg-[#111b21]">

      {/* ── Header ── */}
      <div className="bg-[#202c33] border-b border-[#2a3942] px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button onClick={() => setShowFlowSettings(!showFlowSettings)} className="text-white hover:text-[#00a884] transition">
              <Icons.Settings />
            </button>
            <input
              type="text"
              value={flowName}
              onChange={(e) => setFlowName(e.target.value)}
              placeholder="Flow Name"
              className="bg-transparent text-white text-base font-medium outline-none w-64 placeholder:text-[#8696a0]"
            />
            {triggerKeyword && (
              <span className="bg-[#00a884]/20 text-[#00a884] text-xs px-2 py-1 rounded-full">
                Trigger: {triggerKeyword}
              </span>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="sr-only peer" />
                <div className="w-10 h-5 bg-gray-600 rounded-full peer peer-checked:bg-[#00a884] transition-all duration-300"></div>
                <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isActive ? 'translate-x-5' : ''}`}></div>
              </div>
              <span className="text-white text-sm">{isActive ? 'Active' : 'Inactive'}</span>
            </label>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowVariablesPanel(!showVariablesPanel)} className="bg-teal-500/20 text-teal-400 px-3 py-1 rounded text-sm hover:bg-teal-500/30 transition flex items-center gap-1">
              <Icons.Variable /> Variables
            </button>
            <button onClick={() => setShowTestModal(true)} className="bg-purple-500/20 text-purple-400 px-3 py-1 rounded text-sm hover:bg-purple-500/30 transition">
              🧪 Test
            </button>
            <button onClick={saveFlow} disabled={saving} className="bg-[#00a884] text-white px-4 py-1 rounded text-sm hover:bg-[#008f6e] disabled:opacity-50 transition">
              {saving ? 'Saving...' : '💾 Save'}
            </button>
            {onClose && (
              <button onClick={onClose} className="text-white text-xl hover:text-gray-300">✕</button>
            )}
          </div>
        </div>

        {/* Flow Settings Panel */}
        {showFlowSettings && (
          <div className="mt-3 pt-3 border-t border-[#2a3942] grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[#8696a0] text-xs mb-1">Description</label>
              <input type="text" value={flowDescription} onChange={(e) => setFlowDescription(e.target.value)} className="w-full bg-[#2a3942] text-white text-sm rounded px-3 py-1.5 outline-none" />
            </div>
            <div>
              <label className="block text-[#8696a0] text-xs mb-1">Trigger Keyword(s) <span className="text-[#6a7a84]">(comma-separated)</span></label>
              <input type="text" value={triggerKeyword} onChange={(e) => setTriggerKeyword(e.target.value.toLowerCase())} placeholder="e.g., hi, hello, start" className="w-full bg-[#2a3942] text-white text-sm rounded px-3 py-1.5 outline-none" />
            </div>
          </div>
        )}

        {/* Variables Panel */}
        {showVariablesPanel && (
          <div className="mt-3 pt-3 border-t border-[#2a3942]">
            <h4 className="text-white text-xs font-semibold mb-2">Available Variables</h4>
            <div className="bg-[#2a3942] rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {[
                ['user_response',       "User's answer to any question"],
                ['last_button_clicked', "Last button text clicked"],
                ['last_input',          "Last raw message from user"],
                ['meta_flow_token',     "Flow token from Meta Flow reply"],
                ['meta_flow_completed', '"yes" after a Meta Flow is submitted'],
                ['meta_flow_raw',       "Raw JSON of Meta Flow reply"],
                ['meta_flow_<field>',   "Any field submitted in the Meta Flow"],
              ].map(([k, v]) => (
                <>
                  <span className="text-[#00a884] font-mono">{`{{${k}}}`}</span>
                  <span className="text-[#8696a0]">{v}</span>
                </>
              ))}
            </div>
            <p className="text-[#6a7a84] text-xs mt-2">Use <code className="bg-[#2a3942] px-1 rounded">{'{{variable_name}}'}</code> in message and template nodes.</p>
          </div>
        )}
      </div>

      {/* ── Draggable Toolbar ── */}
      <DraggableToolbar onAddNode={addNode} />

      {/* ── Canvas ── */}
      <div className="flex-1" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={setReactFlowInstance}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
        >
          <Background color="#2a3942" gap={20} size={1} />
          <Controls className="bg-[#202c33] text-white" />
          <Panel position="bottom-center" className="bg-[#202c33]/80 rounded-lg px-3 py-1 text-white text-xs">
            💡 Drag from dots to connect nodes | Click edges to edit conditions | Drag the toolbar
          </Panel>
          <Panel position="top-right" className="bg-[#202c33]/80 rounded-lg px-3 py-1 text-white text-xs">
            📊 {nodes.length} Nodes | 🔗 {edges.length} Connections
          </Panel>
        </ReactFlow>
      </div>

      {/* ── Condition Modal ── */}
      <ConditionModal
        isOpen={showConditionModal}
        onClose={() => { setShowConditionModal(false); setPendingConnection(null); setPendingEdge(null); }}
        onSave={handleConditionSave}
        currentCondition={isEdgeEdit && pendingEdge ? (pendingEdge.data?.condition || '') : ''}
        isRequired={conditionRequired}
        title={isEdgeEdit ? 'Edit Edge Condition' : 'Add Edge Condition'}
      />

      {/* ── Edit Node Modal ── */}
      {editModalOpen && selectedNode && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#202c33] p-4 border-b border-[#2a3942] flex justify-between items-center z-10">
              <h3 className="text-white font-semibold capitalize flex items-center gap-2">
                {selectedNode.type === 'media' && <span className="text-teal-400"><Icons.Media /></span>}
                Edit {selectedNode.type} Node
              </h3>
              <button onClick={() => setEditModalOpen(false)} className="text-white text-2xl hover:text-gray-300">✕</button>
            </div>

            <div className="p-4 space-y-4">

              {/* ── MESSAGE NODE — text only ── */}
              {selectedNode.type === 'message' && (
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Message Text</label>
                  <textarea
                    value={editData.message || ''}
                    onChange={(e) => setEditData({ ...editData, message: e.target.value })}
                    rows={4}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-3 outline-none focus:ring-1 focus:ring-[#00a884] resize-none"
                    placeholder="Enter your message... Use {{variable_name}} for variables"
                  />
                  <p className="text-[#8696a0] text-xs mt-2">
                    💡 Use <code className="bg-[#2a3942] px-1 rounded">{'{{customer_name}}'}</code>, <code className="bg-[#2a3942] px-1 rounded">{'{{order_id}}'}</code>, etc.
                  </p>
                  <div className="mt-3 bg-teal-500/10 border border-teal-500/30 rounded-lg px-3 py-2 text-xs text-teal-300">
                    💡 Need to send an image, video, audio or document? Add a <strong>Media</strong> node from the toolbar.
                  </div>
                </div>
              )}

              {/* ── MEDIA NODE — standalone media send ── */}
              {selectedNode.type === 'media' && (
                <div className="space-y-4">
                  <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg px-3 py-2 text-xs text-teal-300">
                    🎯 This node sends <strong>only the media file</strong> — no text message is attached. Connect it after a message node if you need text too.
                  </div>
                  <MediaUploader
                    media={editData.media || { type: 'none' }}
                    onChange={(media) => setEditData({ ...editData, media })}
                  />
                </div>
              )}

              {/* ── END NODE ── */}
              {selectedNode.type === 'end' && (
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">End Message</label>
                  <textarea
                    value={editData.message || ''}
                    onChange={(e) => setEditData({ ...editData, message: e.target.value })}
                    rows={4}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-3 outline-none focus:ring-1 focus:ring-[#00a884] resize-none"
                    placeholder="Final message shown to user..."
                  />
                </div>
              )}

              {/* ── TEMPLATE NODE ── */}
              {selectedNode.type === 'template' && (
                <div className="space-y-4">

                  <div>
                    <label className="block text-[#8696a0] text-sm mb-2">Select WhatsApp Template</label>
                    <select
                      value={editData.template_name || ''}
                      onChange={(e) => {
                        const name = e.target.value;
                        const tpl  = templates.find((t) => t.name === name);
                        const flow = tpl ? isFlowTemplate(tpl) : false;
                        const img  = tpl ? checkHasImageHeader(tpl) : false;

                        setHasImageHeader(img);
                        setHeaderImageFile(null);
                        setHeaderImagePreview(null);

                        if (tpl) {
                          const bodyVars = getTemplateBodyVariables(tpl);
                          const vars: Record<string, string> = {};
                          bodyVars.forEach((v) => { vars[v] = editData.template_variables?.[v] || ''; });
                          setTemplateVariables(vars);
                          setSelectedTemplateForPreview(tpl);
                          setShowTemplatePreview(true);
                          setEditData((prev: any) => ({
                            ...prev,
                            template_name:     name,
                            is_flow_template:  flow,
                            has_image_header:  img,
                            template_variables: vars,
                            flow_token:        flow ? (prev.flow_token || 'unused') : 'unused',
                            flow_action_data:  flow ? (prev.flow_action_data || {}) : {},
                          }));
                        } else {
                          setEditData((prev: any) => ({ ...prev, template_name: name, is_flow_template: false }));
                        }
                      }}
                      className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                    >
                      <option value="">— Select a template —</option>
                      {templates.map((t) => (
                        <option key={t.name} value={t.name}>
                          {t.name} ({t.category})
                          {isFlowTemplate(t) ? ' 🔄 FLOW' : ''}
                          {checkHasImageHeader(t) ? ' 📷' : ''}
                        </option>
                      ))}
                    </select>

                    {editData.template_name && (
                      <div className="mt-2">
                        {editData.is_flow_template
                          ? <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">🔄 Meta Flow Template detected</span>
                          : <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-500/30">✓ Regular template</span>
                        }
                      </div>
                    )}
                  </div>

                  {editData.is_flow_template && (
                    <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg space-y-4">
                      <p className="text-purple-300 text-sm font-medium flex items-center gap-2">
                        🔄 Meta Flow Configuration
                        <span className="text-xs text-purple-400 font-normal">(saved to DB with flow)</span>
                      </p>

                      <div>
                        <label className="block text-[#8696a0] text-xs mb-1">Flow Token</label>
                        <input
                          type="text"
                          value={editData.flow_token || 'unused'}
                          onChange={(e) => setEditData({ ...editData, flow_token: e.target.value })}
                          placeholder="e.g., booking_token_001"
                          className="w-full bg-[#2a3942] text-white text-sm rounded-lg p-2 outline-none focus:ring-1 focus:ring-purple-400 font-mono"
                        />
                        <p className="text-xs text-[#6a7a84] mt-1">Leave as <code className="bg-[#2a3942] px-1 rounded">unused</code> if not required</p>
                      </div>

                      <div>
                        <label className="block text-[#8696a0] text-xs mb-1">Flow Action Data <span className="text-[#6a7a64]">(pre-fill form fields)</span></label>
                        <p className="text-xs text-[#6a7a84] mb-2">
                          Use <span className="text-purple-300 font-mono">{'{{variable_name}}'}</span> to inject session variables at runtime
                        </p>

                        <div className="space-y-2">
                          {Object.entries(
                            typeof editData.flow_action_data === 'object' && !Array.isArray(editData.flow_action_data)
                              ? (editData.flow_action_data as Record<string, string>)
                              : {}
                          ).map(([key, value], idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                value={key}
                                onChange={(e) => {
                                  const newKey = e.target.value;
                                  const newData = { ...(editData.flow_action_data as Record<string, string>) };
                                  const val = newData[key];
                                  delete newData[key];
                                  if (newKey) newData[newKey] = val;
                                  setEditData({ ...editData, flow_action_data: newData });
                                }}
                                placeholder="field_name"
                                className="flex-1 bg-[#2a3942] text-white text-sm rounded-lg p-2 outline-none font-mono focus:ring-1 focus:ring-purple-400"
                              />
                              <span className="text-[#8696a0] text-sm">:</span>
                              <input
                                type="text"
                                value={value as string}
                                onChange={(e) => {
                                  const newData = {
                                    ...(editData.flow_action_data as Record<string, string>),
                                    [key]: e.target.value,
                                  };
                                  setEditData({ ...editData, flow_action_data: newData });
                                }}
                                placeholder="value or {{variable}}"
                                className="flex-1 bg-[#2a3942] text-white text-sm rounded-lg p-2 outline-none font-mono focus:ring-1 focus:ring-purple-400"
                              />
                              <button
                                onClick={() => {
                                  const newData = { ...(editData.flow_action_data as Record<string, string>) };
                                  delete newData[key];
                                  setEditData({ ...editData, flow_action_data: newData });
                                }}
                                className="text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-400/10 transition"
                              >✕</button>
                            </div>
                          ))}

                          <button
                            onClick={() => {
                              const existing = editData.flow_action_data as Record<string, string> || {};
                              const newKey = `field_${Object.keys(existing).length + 1}`;
                              setEditData({ ...editData, flow_action_data: { ...existing, [newKey]: '' } });
                            }}
                            className="w-full py-2 border border-dashed border-purple-500/40 text-purple-400 text-xs rounded-lg hover:bg-purple-500/10 transition"
                          >
                            + Add Field
                          </button>
                        </div>
                      </div>

                      <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg p-3 text-xs text-purple-300 space-y-1">
                        <p className="font-semibold">How it works:</p>
                        <p>1. Bot sends this Flow template to the user</p>
                        <p>2. User fills in the Meta Flow form and submits</p>
                        <p>3. PHP webhook receives <code className="bg-purple-900/30 px-1 rounded">nfm_reply</code> and saves to DB</p>
                        <p>4. Flow continues with <code className="bg-purple-900/30 px-1 rounded">{'{{meta_flow_<fieldname>}}'}</code> variables</p>
                        <p>5. Connect an outgoing edge with condition <code className="bg-purple-900/30 px-1 rounded">flow_completed</code> to handle the reply</p>
                      </div>
                    </div>
                  )}

                  {!editData.is_flow_template && hasImageHeader && (
                    <div className="bg-[#2a3942] rounded-lg p-3">
                      <label className="block text-[#00a884] text-sm mb-2 flex items-center gap-2">
                        <Icons.Image /> Upload Header Image
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleHeaderImageSelect}
                        disabled={uploadingImage}
                        className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none cursor-pointer disabled:opacity-50"
                      />
                      {uploadingImage && (
                        <div className="mt-2 flex items-center gap-2">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00a884]"></div>
                          <span className="text-white text-xs">Uploading to WhatsApp...</span>
                        </div>
                      )}
                      {headerImagePreview && (
                        <div className="mt-2">
                          <img src={headerImagePreview} alt="Preview" className="rounded-lg max-h-32 object-cover" />
                          <p className="text-green-400 text-xs mt-1">✓ Image uploaded — media_id saved</p>
                        </div>
                      )}
                      <p className="text-[#8696a0] text-xs mt-2">JPG/PNG, max 5 MB</p>
                    </div>
                  )}

                  {showTemplatePreview && selectedTemplateForPreview && (
                    <div>
                      <label className="block text-[#8696a0] text-sm mb-2">Template Preview</label>
                      {renderTemplatePreview(selectedTemplateForPreview)}
                    </div>
                  )}

                  {!editData.is_flow_template && Object.keys(templateVariables).length > 0 && (
                    <div>
                      <label className="block text-[#8696a0] text-sm mb-2">Template Variables</label>
                      <div className="space-y-2">
                        {Object.entries(templateVariables).map(([key, value]) => (
                          <div key={key}>
                            <label className="text-[#6a7a84] text-xs mb-1 block">Variable {`{{${key}}}`}</label>
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => {
                                const newVars = { ...templateVariables, [key]: e.target.value };
                                setTemplateVariables(newVars);
                                setEditData((prev: any) => ({ ...prev, template_variables: newVars }));
                              }}
                              placeholder={`Value or {{variable}}`}
                              className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884] text-sm"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[#8696a0] text-sm mb-2">Fallback Message <span className="text-[#6a7a84] text-xs">(sent if template fails)</span></label>
                    <textarea
                      value={editData.message || ''}
                      onChange={(e) => setEditData({ ...editData, message: e.target.value })}
                      rows={2}
                      className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none resize-none text-sm"
                      placeholder="Optional fallback text message..."
                    />
                  </div>
                </div>
              )}

              {/* ── QUESTION NODE ── */}
              {selectedNode.type === 'question' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[#8696a0] text-sm mb-2">Question Text</label>
                    <textarea
                      value={editData.message || ''}
                      onChange={(e) => setEditData({ ...editData, message: e.target.value })}
                      rows={4}
                      className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none resize-none focus:ring-1 focus:ring-[#00a884]"
                      placeholder="Ask a question to the user..."
                    />
                  </div>
                  <div className="bg-[#2a3942]/50 rounded-lg p-3">
                    <label className="block text-[#00a884] text-sm mb-2 flex items-center gap-2">
                      <Icons.Variable /> Save Response to Variable
                    </label>
                    <input
                      type="text"
                      value={editData.save_as_variable || ''}
                      onChange={(e) => setEditData({ ...editData, save_as_variable: e.target.value })}
                      placeholder="e.g., user_name, order_quantity"
                      className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                    />
                    <p className="text-[#8696a0] text-xs mt-2">Use <code className="bg-[#111b21] px-1 rounded">{`{{${editData.save_as_variable || 'variable_name'}}}`}</code> in later messages</p>
                  </div>
                </div>
              )}

              {/* ── CONDITION NODE ── */}
              {selectedNode.type === 'condition' && (
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Condition Expression</label>
                  <input
                    type="text"
                    value={editData.condition || ''}
                    onChange={(e) => setEditData({ ...editData, condition: e.target.value })}
                    className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884] font-mono"
                    placeholder='e.g., user_input == "yes"'
                  />
                  <p className="text-[#8696a0] text-xs mt-2">
                    Examples: <code className="bg-[#2a3942] px-1 rounded">user_input == "1"</code> &nbsp;
                    <code className="bg-[#2a3942] px-1 rounded">user_input contains "hello"</code>
                  </p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-[#2a3942] flex gap-3">
              <button onClick={updateNodeData} className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] transition">
                Save Changes
              </button>
              <button onClick={() => setEditModalOpen(false)} className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition">
                Cancel
              </button>
              <button onClick={deleteSelectedNode} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-1">
                <Icons.Trash /> Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Test Modal ── */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-[#202c33] rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-[#2a3942] flex justify-between items-center">
              <h3 className="text-white font-semibold">🧪 Test Flow</h3>
              <button onClick={() => setShowTestModal(false)} className="text-white text-2xl hover:text-gray-300">✕</button>
            </div>
            <div className="p-4">
              <label className="block text-[#8696a0] text-sm mb-2">Phone Number</label>
              <input
                type="tel"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="+919004363902"
                className="w-full bg-[#2a3942] text-white rounded-lg p-2 text-sm outline-none mb-4"
              />
              {triggerKeyword && (
                <div className="bg-[#2a3942] rounded-lg p-3 mb-4">
                  <p className="text-[#8696a0] text-xs mb-1">Will send trigger keyword:</p>
                  <p className="text-[#00a884] text-sm font-mono">"{triggerKeyword}"</p>
                </div>
              )}
              <button
                onClick={testFlow}
                disabled={testingFlow}
                className="w-full bg-purple-500 text-white py-2 rounded-lg hover:bg-purple-600 disabled:opacity-50 transition"
              >
                {testingFlow ? 'Sending...' : '▶ Send Test Message'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}