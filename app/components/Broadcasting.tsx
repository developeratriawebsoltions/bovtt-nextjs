'use client';

import { useState, useEffect } from 'react';

interface Contact {
  id: number;
  phone: string;
  name: string;
  label: string;
  country_code: string;
}

interface BroadcastingGroup {
  id: number;
  name: string;
  description: string;
  contact_count: number;
  post_count: number;
  created_at: string;
}

interface BroadcastHistory {
  id: number;
  group_id: number;
  group_name: string;
  name: string;
  type: 'text' | 'template' | 'media';
  content: string;
  template_name?: string;
  recipients_count: number;
  sent_count: number;
  failed_count: number;
  status: string;
  scheduled_for?: string;
  created_at: string;
}

interface Template {
  name: string;
  status: string;
  language: string;
  category: string;
  components: any[];
}

interface ContactWithGroups extends Contact {
  memberOfGroups: BroadcastingGroup[];
}

const API_BASE = '/api/dashboard/broadcast';

export default function Broadcasting() {
  const [allContacts, setAllContacts] = useState<Contact[]>([]);
  const [broadcastGroups, setBroadcastGroups] = useState<BroadcastingGroup[]>([]);
  const [broadcastHistory, setBroadcastHistory] = useState<BroadcastHistory[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [activeTab, setActiveTab] = useState<'groups' | 'history' | 'contacts'>('groups');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [alert, setAlert] = useState<{ show: boolean; message: string; type: string }>({ show: false, message: '', type: 'info' });

  // Group modal states
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroup, setEditingGroup] = useState<BroadcastingGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  // Member management modal states
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [selectedGroupForMembers, setSelectedGroupForMembers] = useState<BroadcastingGroup | null>(null);
  const [groupMembers, setGroupMembers] = useState<Contact[]>([]);
  const [availableContacts, setAvailableContacts] = useState<Contact[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<number[]>([]);
  const [contactSearchTerm, setContactSearchTerm] = useState('');
  const [addingMembers, setAddingMembers] = useState(false);
  const [memberError, setMemberError] = useState<string | null>(null);
  const [globalMemberGroupMap, setGlobalMemberGroupMap] = useState<Record<number, BroadcastingGroup[]>>({});

  // Send modal states
  const [showSendModal, setShowSendModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<BroadcastingGroup | null>(null);
  const [messageType, setMessageType] = useState<'text' | 'template'>('text');
  const [messageText, setMessageText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [scheduleBroadcast, setScheduleBroadcast] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [sending, setSending] = useState(false);

  // Media header states
  const [headerMediaFile, setHeaderMediaFile] = useState<File | null>(null);
  const [templateHeaderType, setTemplateHeaderType] = useState<string | null>(null);
  const [hasMediaHeader, setHasMediaHeader] = useState<boolean>(false);

  // Contacts view states
  const [contactsWithGroups, setContactsWithGroups] = useState<ContactWithGroups[]>([]);
  const [contactViewSearch, setContactViewSearch] = useState('');
  const [contactViewGroupFilter, setContactViewGroupFilter] = useState<string>('all');
  const [contactViewLabelFilter, setContactViewLabelFilter] = useState<string>('all');
  const [showAddToGroupPanel, setShowAddToGroupPanel] = useState<ContactWithGroups | null>(null);
  const [addToGroupId, setAddToGroupId] = useState<string>('');
  const [addingToGroup, setAddingToGroup] = useState(false);

  // Bulk selection in contacts view
  const [bulkSelectedContactIds, setBulkSelectedContactIds] = useState<number[]>([]);
  const [showBulkGroupPanel, setShowBulkGroupPanel] = useState(false);
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState<string>('');
  const [bulkAdding, setBulkAdding] = useState(false);

  // ── NEW: Bulk remove by group ──────────────────────────────────────────────
  const [showBulkRemovePanel, setShowBulkRemovePanel] = useState(false);
  const [bulkRemoveGroupId, setBulkRemoveGroupId] = useState<string>('');
  const [bulkRemoving, setBulkRemoving] = useState(false);

  const showAlert = (message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setAlert({ show: true, message, type });
    setTimeout(() => setAlert({ show: false, message: '', type: 'info' }), 3000);
  };

  useEffect(() => {
    fetchContacts();
    fetchBroadcastGroups();
    fetchBroadcastHistory();
    fetchTemplates();
  }, []);

  useEffect(() => {
    buildContactsWithGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allContacts, broadcastGroups]);

  const buildContactsWithGroups = async () => {
    if (allContacts.length === 0) return;
    const groupMemberMap: Record<number, number[]> = {};
    await Promise.all(
      broadcastGroups.map(async (group) => {
        try {
          const res = await fetch(`${API_BASE}/group/${group.id}/members`);
          const data = await res.json();
          if (data.success) {
            groupMemberMap[group.id] = (data.members || []).map((m: Contact) => m.id);
          }
        } catch {
          groupMemberMap[group.id] = [];
        }
      })
    );
    const enriched: ContactWithGroups[] = allContacts.map((contact) => ({
      ...contact,
      memberOfGroups: broadcastGroups.filter((g) => (groupMemberMap[g.id] || []).includes(contact.id)),
    }));
    setContactsWithGroups(enriched);
  };

  const fetchContacts = async () => {
    try {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      if (data.success) setAllContacts(data.contacts);
    } catch {
      setError('Failed to fetch contacts');
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch(`${API_BASE}/templates`);
      const data = await response.json();
      if (data.success) {
        setTemplates((data.templates || []).filter((t: any) => t.status === 'APPROVED'));
      }
    } catch {}
  };

  const fetchBroadcastHistory = async () => {
    try {
      const response = await fetch(`${API_BASE}/history`);
      const data = await response.json();
      if (data.success) setBroadcastHistory(data.history || []);
    } catch {}
  };

  const fetchBroadcastGroups = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/group`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const data = await response.json();
      if (data.success) setBroadcastGroups(data.groups || []);
      else setError(data.error || 'Failed to fetch groups');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error fetching groups');
    } finally {
      setLoading(false);
    }
  };

  const fetchGroupMembers = async (groupId: number) => {
    try {
      const response = await fetch(`${API_BASE}/group/${groupId}/members`);
      const data = await response.json();
      if (data.success) {
        setGroupMembers(data.members || []);
        setAvailableContacts(data.availableContacts || []);
      } else {
        setMemberError(data.error || 'Failed to fetch members');
      }
    } catch {
      setMemberError('Error fetching group members');
    }
  };

  const getTemplateHeaderType = (templateName: string) => {
    const template = templates.find((t) => t.name === templateName);
    if (!template) return { type: null, hasMedia: false };
    const headerComponent = template.components?.find((c: any) => c.type === 'HEADER');
    if (!headerComponent) return { type: null, hasMedia: false };
    const format = headerComponent.format?.toLowerCase();
    return { type: format || null, hasMedia: ['image', 'video', 'document'].includes(format) };
  };

  // ── Group CRUD ──────────────────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    if (!groupName.trim()) { setGroupError('Please enter a group name'); return; }
    setCreatingGroup(true); setGroupError(null);
    try {
      const res = await fetch(`${API_BASE}/group`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: groupName.trim(), description: groupDescription.trim() }),
      });
      const data = await res.json();
      if (data.success) { await fetchBroadcastGroups(); resetGroupModal(); showAlert('Group created successfully!', 'success'); }
      else { setGroupError(data.error || 'Failed to create group'); showAlert(data.error || 'Failed to create group', 'error'); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error creating group';
      setGroupError(msg); showAlert(msg, 'error');
    } finally { setCreatingGroup(false); }
  };

  const handleUpdateGroup = async () => {
    if (!editingGroup || !groupName.trim()) { setGroupError('Please enter a group name'); return; }
    setCreatingGroup(true); setGroupError(null);
    try {
      const res = await fetch(`${API_BASE}/group`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingGroup.id, name: groupName.trim(), description: groupDescription.trim() }),
      });
      const data = await res.json();
      if (data.success) { await fetchBroadcastGroups(); resetGroupModal(); showAlert('Group updated successfully!', 'success'); }
      else { setGroupError(data.error || 'Failed to update group'); showAlert(data.error || 'Failed to update group', 'error'); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error updating group';
      setGroupError(msg); showAlert(msg, 'error');
    } finally { setCreatingGroup(false); }
  };

  const handleDeleteGroup = async (groupId: number) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    try {
      const res = await fetch(`${API_BASE}/group?id=${groupId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { await fetchBroadcastGroups(); showAlert('Group deleted successfully!', 'success'); }
      else showAlert(data.error || 'Failed to delete group', 'error');
    } catch { showAlert('Error deleting group', 'error'); }
  };

  // ── Member management ───────────────────────────────────────────────────────
  const handleAddMembers = async () => {
    if (!selectedGroupForMembers) return;
    if (selectedContactIds.length === 0) { showAlert('Please select at least one contact to add', 'warning'); return; }
    setAddingMembers(true); setMemberError(null);
    try {
      const res = await fetch(`${API_BASE}/group/${selectedGroupForMembers.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: selectedContactIds }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchGroupMembers(selectedGroupForMembers.id);
        await fetchBroadcastGroups();
        setSelectedContactIds([]);
        if (data.added > 0) showAlert(`${data.added} contact${data.added > 1 ? 's' : ''} added to group!`, 'success');
        else if (data.failed > 0) showAlert(`${data.failed} contacts already in group`, 'warning');
        else showAlert('No new contacts were added', 'info');
      } else { setMemberError(data.error || 'Failed to add members'); showAlert(data.error || 'Failed to add members', 'error'); }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error adding members';
      setMemberError(msg); showAlert(msg, 'error');
    } finally { setAddingMembers(false); }
  };

  const handleRemoveMember = async (contactId: number) => {
    if (!selectedGroupForMembers || !confirm('Remove this contact from the group?')) return;
    try {
      const res = await fetch(`${API_BASE}/group/${selectedGroupForMembers.id}/members?contactId=${contactId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) { await fetchGroupMembers(selectedGroupForMembers.id); await fetchBroadcastGroups(); showAlert('Contact removed from group', 'success'); }
      else showAlert(data.error || 'Failed to remove contact', 'error');
    } catch { showAlert('Error removing member', 'error'); }
  };

  // ── Send broadcast ──────────────────────────────────────────────────────────
  const handleHeaderMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      if (file.size > 16 * 1024 * 1024) { showAlert('File size must be less than 16MB', 'error'); return; }
      setHeaderMediaFile(file);
    }
  };

  const handleSendBroadcast = async () => {
    if (!selectedGroup) return;
    if (messageType === 'text' && !messageText.trim()) { showAlert('Please enter a message', 'warning'); return; }
    if (messageType === 'template' && !selectedTemplate) { showAlert('Please select a template', 'warning'); return; }
    if (messageType === 'template' && hasMediaHeader && !headerMediaFile) { showAlert(`This template requires a ${templateHeaderType?.toUpperCase()} file.`, 'warning'); return; }
    if (scheduleBroadcast) {
      if (!scheduleDate || !scheduleTime) { showAlert('Please select both date and time', 'warning'); return; }
      if (new Date(`${scheduleDate}T${scheduleTime}`) <= new Date()) { showAlert('Schedule time must be in the future', 'warning'); return; }
    }
    setSending(true);
    try {
      const formData = new FormData();
      formData.append('group_id', selectedGroup.id.toString());
      formData.append('type', messageType);
      formData.append('content', messageText);
      if (messageType === 'template') {
        formData.append('template_name', selectedTemplate);
        formData.append('template_variables', JSON.stringify(templateVariables));
        if (hasMediaHeader && headerMediaFile) { formData.append('header_media', headerMediaFile); formData.append('header_media_type', templateHeaderType || 'image'); }
      }
      if (scheduleBroadcast) formData.append('scheduled_for', new Date(`${scheduleDate}T${scheduleTime}`).toISOString());
      const res = await fetch(`${API_BASE}/send`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        await fetchBroadcastHistory();
        showAlert(scheduleBroadcast ? `Broadcast scheduled to ${data.recipients} contacts!` : `Broadcast completed! Sent: ${data.sent}, Failed: ${data.failed}`, 'success');
        resetSendModal();
      } else showAlert(data.error || 'Failed to send broadcast', 'error');
    } catch { showAlert('Error sending broadcast', 'error'); }
    finally { setSending(false); }
  };

  // ── Add single contact to group from contacts view ──────────────────────────
  const handleAddContactToGroup = async (contact: ContactWithGroups) => {
    if (!addToGroupId) { showAlert('Please select a group', 'warning'); return; }
    setAddingToGroup(true);
    try {
      const res = await fetch(`${API_BASE}/group/${addToGroupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: [contact.id] }),
      });
      const data = await res.json();
      if (data.success) {
        showAlert(`${contact.name} added to group!`, 'success');
        setShowAddToGroupPanel(null);
        setAddToGroupId('');
        await fetchBroadcastGroups();
        await buildContactsWithGroups();
      } else showAlert(data.error || 'Failed to add contact', 'error');
    } catch { showAlert('Error adding contact to group', 'error'); }
    finally { setAddingToGroup(false); }
  };

  // ── Bulk add contacts to group ──────────────────────────────────────────────
  const handleBulkAddToGroup = async () => {
    if (!bulkTargetGroupId) { showAlert('Please select a group', 'warning'); return; }
    if (bulkSelectedContactIds.length === 0) { showAlert('Please select contacts', 'warning'); return; }
    setBulkAdding(true);
    try {
      const res = await fetch(`${API_BASE}/group/${bulkTargetGroupId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: bulkSelectedContactIds }),
      });
      const data = await res.json();
      if (data.success) {
        showAlert(`${data.added} contact${data.added !== 1 ? 's' : ''} added to group!`, 'success');
        setBulkSelectedContactIds([]);
        setShowBulkGroupPanel(false);
        setBulkTargetGroupId('');
        await fetchBroadcastGroups();
        await buildContactsWithGroups();
      } else showAlert(data.error || 'Failed to bulk add', 'error');
    } catch { showAlert('Error adding contacts to group', 'error'); }
    finally { setBulkAdding(false); }
  };

  // ── NEW: Bulk remove selected contacts from a group ─────────────────────────
  // Removes each selected contact from the chosen group one by one (or batched if your API supports it)
  const handleBulkRemoveFromGroup = async () => {
    if (!bulkRemoveGroupId) { showAlert('Please select a group to remove from', 'warning'); return; }
    if (bulkSelectedContactIds.length === 0) { showAlert('Please select contacts', 'warning'); return; }

    // Only remove contacts that are actually in the target group
    const targetGroup = broadcastGroups.find((g) => g.id.toString() === bulkRemoveGroupId);
    const contactsInGroup = contactsWithGroups.filter(
      (c) => bulkSelectedContactIds.includes(c.id) && c.memberOfGroups.some((g) => g.id.toString() === bulkRemoveGroupId)
    );

    if (contactsInGroup.length === 0) {
      showAlert('None of the selected contacts are in that group', 'warning');
      return;
    }

    if (!confirm(`Remove ${contactsInGroup.length} contact${contactsInGroup.length !== 1 ? 's' : ''} from "${targetGroup?.name}"?`)) return;

    setBulkRemoving(true);
    let removed = 0;
    let failed = 0;

    await Promise.all(
      contactsInGroup.map(async (contact) => {
        try {
          const res = await fetch(`${API_BASE}/group/${bulkRemoveGroupId}/members?contactId=${contact.id}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success) removed++;
          else failed++;
        } catch {
          failed++;
        }
      })
    );

    setBulkRemoving(false);
    setBulkSelectedContactIds([]);
    setShowBulkRemovePanel(false);
    setBulkRemoveGroupId('');
    await fetchBroadcastGroups();
    await buildContactsWithGroups();

    if (removed > 0) showAlert(`Removed ${removed} contact${removed !== 1 ? 's' : ''} from group${failed > 0 ? ` (${failed} failed)` : ''}!`, removed > 0 ? 'success' : 'error');
    else showAlert('Failed to remove contacts', 'error');
  };

  // ── Select All helpers ──────────────────────────────────────────────────────
  const allAvailableSelected = filteredAvailableContacts().length > 0 && filteredAvailableContacts().every((c) => selectedContactIds.includes(c.id));
  const someAvailableSelected = selectedContactIds.length > 0 && !allAvailableSelected;

  function toggleSelectAll() {
    const ids = filteredAvailableContacts().map((c) => c.id);
    if (allAvailableSelected) setSelectedContactIds([]);
    else setSelectedContactIds(Array.from(new Set([...selectedContactIds, ...ids])));
  }

  // ── Filter helpers ──────────────────────────────────────────────────────────
  function filteredAvailableContacts() {
    return (availableContacts || []).filter(
      (c) => c.name.toLowerCase().includes(contactSearchTerm.toLowerCase()) || c.phone.includes(contactSearchTerm)
    );
  }

  function filteredContactsView() {
    return contactsWithGroups.filter((c) => {
      const matchSearch =
        c.name.toLowerCase().includes(contactViewSearch.toLowerCase()) || c.phone.includes(contactViewSearch);

      let matchGroup = true;
      if (contactViewGroupFilter === 'all') {
        matchGroup = true;
      } else if (contactViewGroupFilter === 'no-group') {
        // Show ONLY contacts with zero group memberships
        matchGroup = c.memberOfGroups.length === 0;
      } else if (contactViewGroupFilter === 'in-group') {
        matchGroup = c.memberOfGroups.length > 0;
      } else {
        // Specific group ID selected — show only contacts IN that group
        matchGroup = c.memberOfGroups.some((g) => g.id.toString() === contactViewGroupFilter);
      }

      const matchLabel = contactViewLabelFilter === 'all' ? true : c.label === contactViewLabelFilter;
      return matchSearch && matchGroup && matchLabel;
    });
  }

  // When a specific group is selected in the filter, those contacts can be removed from it
  const isSpecificGroupFilter = contactViewGroupFilter !== 'all' && contactViewGroupFilter !== 'no-group' && contactViewGroupFilter !== 'in-group';
  const specificFilteredGroup = isSpecificGroupFilter ? broadcastGroups.find((g) => g.id.toString() === contactViewGroupFilter) : null;

  // Groups that the bulk-selected contacts share (for removal options)
  const bulkSelectedContacts = contactsWithGroups.filter((c) => bulkSelectedContactIds.includes(c.id));
  const commonGroupsForBulk = broadcastGroups.filter((g) =>
    bulkSelectedContacts.some((c) => c.memberOfGroups.some((mg) => mg.id === g.id))
  );

  // ── Modal openers/resetters ─────────────────────────────────────────────────
  const openCreateGroupModal = () => { setEditingGroup(null); setGroupName(''); setGroupDescription(''); setGroupError(null); setShowGroupModal(true); };
  const openEditGroupModal = (g: BroadcastingGroup) => { setEditingGroup(g); setGroupName(g.name); setGroupDescription(g.description || ''); setGroupError(null); setShowGroupModal(true); };
  const openMembersModal = async (g: BroadcastingGroup) => {
    setSelectedGroupForMembers(g);
    setSelectedContactIds([]);
    setContactSearchTerm('');
    setMemberError(null);
    await fetchGroupMembers(g.id);
    const map: Record<number, BroadcastingGroup[]> = {};
    await Promise.all(
      broadcastGroups.map(async (group) => {
        try {
          const res = await fetch(`${API_BASE}/group/${group.id}/members`);
          const data = await res.json();
          if (data.success) {
            (data.members || []).forEach((m: Contact) => {
              if (!map[m.id]) map[m.id] = [];
              map[m.id].push(group);
            });
          }
        } catch {}
      })
    );
    setGlobalMemberGroupMap(map);
    setShowMembersModal(true);
  };
  const openSendModal = (g: BroadcastingGroup) => {
    if (g.contact_count === 0) { showAlert('This group has no members. Please add members first.', 'warning'); return; }
    setSelectedGroup(g); setMessageType('text'); setMessageText(''); setSelectedTemplate(''); setTemplateVariables({});
    setTemplateHeaderType(null); setHasMediaHeader(false); setHeaderMediaFile(null);
    setScheduleBroadcast(false); setScheduleDate(''); setScheduleTime(''); setShowSendModal(true);
  };
  const resetGroupModal = () => { setShowGroupModal(false); setEditingGroup(null); setGroupName(''); setGroupDescription(''); setGroupError(null); };
  const resetSendModal = () => { setShowSendModal(false); setSelectedGroup(null); setMessageText(''); setSelectedTemplate(''); setTemplateVariables({}); setTemplateHeaderType(null); setHasMediaHeader(false); setHeaderMediaFile(null); setScheduleBroadcast(false); setScheduleDate(''); setScheduleTime(''); };

  const toggleContactSelection = (contactId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedContactIds((prev) => prev.includes(contactId) ? prev.filter((id) => id !== contactId) : [...prev, contactId]);
  };

  const getTemplateVariables = (template: Template) => {
    const body = template.components?.find((c: any) => c.type === 'BODY');
    if (!body) return [];
    return (body.text?.match(/{{(\d+|[^}]+)}}/g) || []).map((m: string) => m.replace(/{{|}}/g, ''));
  };

  const handleTemplateSelect = (name: string) => {
    const template = templates.find((t) => t.name === name);
    if (template) {
      setSelectedTemplate(name);
      const vars = getTemplateVariables(template);
      const initialVars: Record<string, string> = {};
      vars.forEach((v: string) => { initialVars[v] = ''; });
      setTemplateVariables(initialVars);
      const { type, hasMedia } = getTemplateHeaderType(name);
      setTemplateHeaderType(type); setHasMediaHeader(hasMedia); setHeaderMediaFile(null);
    }
  };

  const formatDate = (d: string) => d ? new Date(d).toLocaleString() : '';
  const selectedTemplateObj = templates.find((t) => t.name === selectedTemplate);

  const labelColor = (label: string) =>
    label === 'green' ? 'bg-green-500' : label === 'yellow' ? 'bg-yellow-500' : label === 'red' ? 'bg-red-500' : 'bg-gray-500';

  if (error && broadcastGroups.length === 0 && !loading) {
    return (
      <div className="bg-[#202c33] rounded-lg p-8 text-center">
        <p className="text-red-400">{error}</p>
        <button onClick={fetchBroadcastGroups} className="mt-4 text-[#00a884] hover:underline">Try Again</button>
      </div>
    );
  }

  const displayedContacts = filteredContactsView();
  const allBulkSelected = displayedContacts.length > 0 && displayedContacts.every((c) => bulkSelectedContactIds.includes(c.id));

  return (
    <div className="space-y-6">
      {/* Alert Toast */}
      {alert.show && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${
          alert.type === 'success' ? 'bg-green-500 text-white' :
          alert.type === 'error' ? 'bg-red-500 text-white' :
          alert.type === 'warning' ? 'bg-yellow-500 text-white' :
          'bg-blue-500 text-white'
        }`}>
          <p className="text-sm">{alert.message}</p>
        </div>
      )}

      <div>
        <h2 className="text-white text-xl font-semibold">Broadcasting</h2>
        <p className="text-[#8696a0] text-sm mt-1">Create groups, add members, and send WhatsApp messages</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#2a3942]">
        {(['groups', 'history', 'contacts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition capitalize ${
              activeTab === tab ? 'text-[#00a884] border-b-2 border-[#00a884]' : 'text-[#8696a0] hover:text-white'
            }`}
          >
            {tab === 'contacts' ? 'Contacts' : tab === 'history' ? 'Broadcast History' : 'Groups'}
          </button>
        ))}
      </div>

      {/* ── GROUPS TAB ── */}
      {activeTab === 'groups' && (
        <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-semibold">Your Broadcast Groups</h3>
            <button onClick={openCreateGroupModal} className="bg-[#00a884] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#008f6e] transition font-medium">
              + Create Group
            </button>
          </div>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884] mx-auto mb-2"></div>
              <p className="text-[#8696a0]">Loading groups...</p>
            </div>
          ) : broadcastGroups.length === 0 ? (
            <div className="text-center py-12 text-[#8696a0]">
              <p>No groups created yet</p>
              <p className="text-sm mt-2">Create a group to organize your contacts for broadcasting</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {broadcastGroups.map((group) => (
                <div key={group.id} className="bg-[#2a3942] rounded-lg p-4 hover:bg-[#3a4a54] transition">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h4 className="text-white font-semibold">{group.name}</h4>
                      <p className="text-[#8696a0] text-xs mt-1">
                        {group.contact_count} member{group.contact_count !== 1 ? 's' : ''} • {group.post_count || 0} broadcast{group.post_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex gap-2 ml-2">
                      <button onClick={() => openEditGroupModal(group)} className="text-blue-400 hover:text-blue-300 text-sm">Edit</button>
                      <button onClick={() => handleDeleteGroup(group.id)} className="text-red-400 hover:text-red-300 text-sm">Delete</button>
                    </div>
                  </div>
                  {group.description && <p className="text-[#8696a0] text-xs mt-2 line-clamp-2">{group.description}</p>}
                  <div className="flex gap-2 mt-3 pt-3 border-t border-[#2a3942]">
                    <button onClick={() => openMembersModal(group)} className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition font-medium">Manage Members</button>
                    <button
                      onClick={() => openSendModal(group)}
                      disabled={group.contact_count === 0}
                      className={`flex-1 px-3 py-2 rounded text-sm font-medium transition ${group.contact_count > 0 ? 'bg-[#00a884] text-white hover:bg-[#008f6e]' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}
                    >
                      Send Broadcast
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === 'history' && (
        <div className="bg-[#202c33] rounded-lg border border-[#2a3942] overflow-hidden">
          {broadcastHistory.length === 0 ? (
            <div className="text-center py-12 text-[#8696a0]">
              <p>No broadcast history yet</p>
              <p className="text-sm mt-2">Your sent broadcasts will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-[#2a3942] sticky top-0">
                  <tr className="text-left text-[#8696a0] text-sm">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Group</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Content</th>
                    <th className="px-4 py-3">Recipients</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Sent/Failed</th>
                  </tr>
                </thead>
                <tbody>
                  {broadcastHistory.map((entry, index) => (
                    <tr key={`${entry.id}-${index}`} className="border-t border-[#2a3942] hover:bg-[#2a3942]/30">
                      <td className="px-4 py-3 text-[#e9edef] text-sm whitespace-nowrap">{formatDate(entry.created_at)}</td>
                      <td className="px-4 py-3 text-white text-sm">{entry.group_name || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${entry.type === 'text' ? 'bg-blue-500/20 text-blue-400' : entry.type === 'template' ? 'bg-purple-500/20 text-purple-400' : 'bg-green-500/20 text-green-400'}`}>
                          {entry.type === 'text' ? 'Text' : entry.type === 'template' ? 'Template' : 'Media'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white text-sm max-w-xs truncate">{entry.type === 'text' ? entry.content : entry.type === 'template' ? entry.template_name : 'Media file'}</td>
                      <td className="px-4 py-3 text-white text-sm">{entry.recipients_count}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${entry.status === 'completed' ? 'bg-green-500/20 text-green-400' : entry.status === 'scheduled' ? 'bg-yellow-500/20 text-yellow-400' : entry.status === 'processing' ? 'bg-blue-500/20 text-blue-400' : 'bg-red-500/20 text-red-400'}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white text-sm whitespace-nowrap">✅ {entry.sent_count || 0} / ❌ {entry.failed_count || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── CONTACTS MANAGER TAB ── */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          {/* Filter bar */}
          <div className="bg-[#202c33] rounded-lg p-4 border border-[#2a3942] space-y-3">
            <div className="flex flex-wrap gap-3 items-center">
              {/* Search */}
              <div className="flex-1 min-w-[180px] bg-[#2a3942] rounded-lg p-2 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#8696a0] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search by name or phone..."
                  value={contactViewSearch}
                  onChange={(e) => setContactViewSearch(e.target.value)}
                  className="bg-transparent flex-1 text-white outline-none text-sm"
                />
              </div>

              {/* Group filter */}
              <select
                value={contactViewGroupFilter}
                onChange={(e) => {
                  setContactViewGroupFilter(e.target.value);
                  // Clear bulk selection when filter changes
                  setBulkSelectedContactIds([]);
                  setShowBulkGroupPanel(false);
                  setShowBulkRemovePanel(false);
                }}
                className="bg-[#2a3942] text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#00a884]"
              >
                <option value="all">All Contacts</option>
                <option value="no-group">🚫 Not in any group</option>
                <option value="in-group">✅ In at least one group</option>
                <optgroup label="── Specific Group ──">
                  {broadcastGroups.map((g) => (
                    <option key={g.id} value={g.id.toString()}>📂 {g.name}</option>
                  ))}
                </optgroup>
              </select>

              {/* Label filter */}
              <select
                value={contactViewLabelFilter}
                onChange={(e) => setContactViewLabelFilter(e.target.value)}
                className="bg-[#2a3942] text-white rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-[#00a884]"
              >
                <option value="all">All Labels</option>
                <option value="green">🟢 Green</option>
                <option value="yellow">🟡 Yellow</option>
                <option value="red">🔴 Red</option>
              </select>

              <span className="text-[#8696a0] text-sm whitespace-nowrap">{displayedContacts.length} contact{displayedContacts.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Active filter badge */}
            {contactViewGroupFilter === 'no-group' && (
              <div className="flex items-center gap-2 bg-orange-500/10 border border-orange-500/30 rounded-lg px-3 py-2">
                <span className="text-orange-400 text-xs">🚫 Showing contacts not assigned to any group</span>
                <button
                  onClick={() => setContactViewGroupFilter('all')}
                  className="ml-auto text-orange-400 hover:text-orange-300 text-xs"
                >
                  Clear filter
                </button>
              </div>
            )}

            {specificFilteredGroup && (
              <div className="flex items-center gap-2 bg-[#00a884]/10 border border-[#00a884]/30 rounded-lg px-3 py-2">
                <span className="text-[#00a884] text-xs">📂 Showing members of: <strong>{specificFilteredGroup.name}</strong></span>
                <button
                  onClick={() => setContactViewGroupFilter('all')}
                  className="ml-auto text-[#8696a0] hover:text-white text-xs"
                >
                  Clear filter
                </button>
              </div>
            )}

            {/* Bulk action bar */}
            {bulkSelectedContactIds.length > 0 && (
              <div className="border border-[#2a3942] rounded-lg overflow-hidden">
                {/* Action row */}
                <div className="flex items-center gap-3 bg-[#00a884]/10 px-3 py-2">
                  <span className="text-[#00a884] text-sm font-medium">{bulkSelectedContactIds.length} selected</span>

                  {/* Add to group button */}
                  <button
                    onClick={() => { setShowBulkGroupPanel(true); setShowBulkRemovePanel(false); }}
                    className={`px-3 py-1 rounded text-sm font-medium transition ${showBulkGroupPanel ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#00a884] border border-[#00a884]/40 hover:bg-[#00a884]/20'}`}
                  >
                    + Add to Group
                  </button>

                  {/* Remove from group button — only show if selected contacts belong to any group */}
                  {commonGroupsForBulk.length > 0 && (
                    <button
                      onClick={() => { setShowBulkRemovePanel(true); setShowBulkGroupPanel(false); }}
                      className={`px-3 py-1 rounded text-sm font-medium transition ${showBulkRemovePanel ? 'bg-red-600 text-white' : 'bg-[#2a3942] text-red-400 border border-red-500/40 hover:bg-red-500/10'}`}
                    >
                      − Remove from Group
                    </button>
                  )}

                  <button onClick={() => { setBulkSelectedContactIds([]); setShowBulkGroupPanel(false); setShowBulkRemovePanel(false); }} className="ml-auto text-[#8696a0] hover:text-white text-sm transition">
                    Clear selection
                  </button>
                </div>

                {/* Add to group panel */}
                {showBulkGroupPanel && (
                  <div className="flex items-center gap-2 bg-[#2a3942] px-3 py-2 border-t border-[#374a56]">
                    <span className="text-[#8696a0] text-xs whitespace-nowrap">Add to:</span>
                    <select
                      value={bulkTargetGroupId}
                      onChange={(e) => setBulkTargetGroupId(e.target.value)}
                      className="flex-1 bg-[#111b21] text-white rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-[#00a884]"
                    >
                      <option value="">Select group...</option>
                      {broadcastGroups.map((g) => <option key={g.id} value={g.id.toString()}>{g.name}</option>)}
                    </select>
                    <button
                      onClick={handleBulkAddToGroup}
                      disabled={!bulkTargetGroupId || bulkAdding}
                      className="bg-[#00a884] text-white px-3 py-1.5 rounded text-sm hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
                    >
                      {bulkAdding ? 'Adding...' : 'Confirm Add'}
                    </button>
                    <button onClick={() => { setShowBulkGroupPanel(false); setBulkTargetGroupId(''); }} className="text-[#8696a0] hover:text-white text-sm px-1">✕</button>
                  </div>
                )}

                {/* Remove from group panel */}
                {showBulkRemovePanel && (
                  <div className="flex items-center gap-2 bg-red-900/20 px-3 py-2 border-t border-red-900/30">
                    <span className="text-red-400 text-xs whitespace-nowrap">Remove from:</span>
                    <select
                      value={bulkRemoveGroupId}
                      onChange={(e) => setBulkRemoveGroupId(e.target.value)}
                      className="flex-1 bg-[#111b21] text-white rounded px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-red-500"
                    >
                      <option value="">Select group...</option>
                      {/* Only show groups that at least one selected contact belongs to */}
                      {commonGroupsForBulk.map((g) => (
                        <option key={g.id} value={g.id.toString()}>
                          {g.name} ({bulkSelectedContacts.filter((c) => c.memberOfGroups.some((mg) => mg.id === g.id)).length} of {bulkSelectedContactIds.length} selected)
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleBulkRemoveFromGroup}
                      disabled={!bulkRemoveGroupId || bulkRemoving}
                      className="bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700 disabled:opacity-50 transition font-medium"
                    >
                      {bulkRemoving ? 'Removing...' : 'Confirm Remove'}
                    </button>
                    <button onClick={() => { setShowBulkRemovePanel(false); setBulkRemoveGroupId(''); }} className="text-[#8696a0] hover:text-white text-sm px-1">✕</button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick-remove banner when viewing a specific group */}
          {specificFilteredGroup && bulkSelectedContactIds.length === 0 && displayedContacts.length > 0 && (
            <div className="bg-[#2a3942] rounded-lg px-4 py-2 text-xs text-[#8696a0] flex items-center gap-2">
              <span>💡 Tip: Select contacts using the checkboxes, then use <strong className="text-white">− Remove from Group</strong> to remove them from <strong className="text-white">{specificFilteredGroup.name}</strong></span>
            </div>
          )}

          {/* Contacts table */}
          <div className="bg-[#202c33] rounded-lg border border-[#2a3942] overflow-hidden">
            {contactsWithGroups.length === 0 ? (
              <div className="text-center py-12 text-[#8696a0]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884] mx-auto mb-3"></div>
                <p>Loading contact data...</p>
              </div>
            ) : displayedContacts.length === 0 ? (
              <div className="text-center py-12 text-[#8696a0]">
                {contactViewGroupFilter === 'no-group' ? (
                  <>
                    <p className="text-lg mb-1">🎉 All contacts are in at least one group!</p>
                    <p className="text-sm">No ungrouped contacts found.</p>
                  </>
                ) : (
                  <p>No contacts match your filters</p>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-[#2a3942] sticky top-0">
                    <tr className="text-left text-[#8696a0] text-sm">
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allBulkSelected}
                          onChange={() => {
                            if (allBulkSelected) {
                              setBulkSelectedContactIds((prev) => prev.filter((id) => !displayedContacts.map((c) => c.id).includes(id)));
                            } else {
                              setBulkSelectedContactIds((prev) => Array.from(new Set([...prev, ...displayedContacts.map((c) => c.id)])));
                            }
                          }}
                          className="w-4 h-4 accent-[#00a884] cursor-pointer"
                        />
                      </th>
                      <th className="px-4 py-3">Contact</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Label</th>
                      <th className="px-4 py-3">Groups</th>
                      <th className="px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedContacts.map((contact) => (
                      <tr key={contact.id} className="border-t border-[#2a3942] hover:bg-[#2a3942]/30 transition">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={bulkSelectedContactIds.includes(contact.id)}
                            onChange={() => setBulkSelectedContactIds((prev) =>
                              prev.includes(contact.id) ? prev.filter((id) => id !== contact.id) : [...prev, contact.id]
                            )}
                            className="w-4 h-4 accent-[#00a884] cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white text-sm font-medium">{contact.name}</p>
                        </td>
                        <td className="px-4 py-3 text-[#8696a0] text-sm">{contact.phone}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block w-3 h-3 rounded-full ${labelColor(contact.label)}`}></span>
                        </td>
                        <td className="px-4 py-3">
                          {contact.memberOfGroups.length === 0 ? (
                            <span className="text-[#8696a0] text-xs italic">No groups</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {contact.memberOfGroups.map((g) => (
                                <span key={g.id} className="bg-[#00a884]/20 text-[#00a884] text-xs px-2 py-0.5 rounded-full border border-[#00a884]/30">
                                  {g.name}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {showAddToGroupPanel?.id === contact.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                value={addToGroupId}
                                onChange={(e) => setAddToGroupId(e.target.value)}
                                className="bg-[#2a3942] text-white rounded px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-[#00a884]"
                              >
                                <option value="">Select group...</option>
                                {broadcastGroups
                                  .filter((g) => !contact.memberOfGroups.some((mg) => mg.id === g.id))
                                  .map((g) => <option key={g.id} value={g.id.toString()}>{g.name}</option>)
                                }
                              </select>
                              <button
                                onClick={() => handleAddContactToGroup(contact)}
                                disabled={!addToGroupId || addingToGroup}
                                className="bg-[#00a884] text-white px-2 py-1 rounded text-xs hover:bg-[#008f6e] disabled:opacity-50 transition"
                              >
                                {addingToGroup ? '...' : 'Add'}
                              </button>
                              <button onClick={() => { setShowAddToGroupPanel(null); setAddToGroupId(''); }} className="text-[#8696a0] hover:text-white text-xs">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setShowAddToGroupPanel(contact); setAddToGroupId(''); }}
                              className="text-[#00a884] hover:text-[#008f6e] text-xs font-medium transition"
                            >
                              + Add to Group
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── CREATE/EDIT GROUP MODAL ── */}
      {showGroupModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-[#2a3942] flex justify-between items-center">
              <h3 className="text-white font-semibold">{editingGroup ? 'Edit Broadcast Group' : 'Create Broadcast Group'}</h3>
              <button onClick={resetGroupModal} className="text-white text-2xl hover:text-gray-300">✕</button>
            </div>
            <div className="p-4 space-y-4">
              {groupError && <div className="bg-red-500/10 border border-red-500 rounded-lg p-3"><p className="text-red-400 text-sm">{groupError}</p></div>}
              <div>
                <label className="block text-[#8696a0] text-sm mb-2">Group Name *</label>
                <input type="text" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="e.g., VIP Customers" className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" autoFocus />
              </div>
              <div>
                <label className="block text-[#8696a0] text-sm mb-2">Description (optional)</label>
                <textarea value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} rows={2} className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" placeholder="Describe what this group is for..." />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={editingGroup ? handleUpdateGroup : handleCreateGroup}
                  disabled={!groupName.trim() || creatingGroup}
                  className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
                >
                  {creatingGroup ? <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>{editingGroup ? 'Updating...' : 'Creating...'}</span></div> : editingGroup ? 'Update Group' : 'Create Group'}
                </button>
                <button onClick={resetGroupModal} className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition">Cancel</button>
              </div>
              {!editingGroup && <p className="text-[#8696a0] text-xs text-center pt-2">You can add members to the group after creation</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── MANAGE MEMBERS MODAL ── */}
      {showMembersModal && selectedGroupForMembers && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-lg w-full max-w-3xl max-h-[85vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#202c33] p-4 border-b border-[#2a3942] flex justify-between items-center">
              <h3 className="text-white font-semibold">Manage Members — {selectedGroupForMembers.name}</h3>
              <button onClick={() => setShowMembersModal(false)} className="text-white text-2xl hover:text-gray-300">✕</button>
            </div>
            <div className="p-4 space-y-6">
              {memberError && <div className="bg-red-500/10 border border-red-500 rounded-lg p-3"><p className="text-red-400 text-sm">{memberError}</p></div>}

              {/* Current Members */}
              <div>
                <h4 className="text-white font-medium mb-3">Current Members ({groupMembers.length})</h4>
                <div className="max-h-64 overflow-y-auto space-y-2 bg-[#2a3942] rounded-lg p-2">
                  {groupMembers.length === 0 ? (
                    <p className="text-center text-[#8696a0] py-4">No members in this group</p>
                  ) : (
                    groupMembers.map((member) => {
                      const otherGroups = (globalMemberGroupMap[member.id] || []).filter((g) => g.id !== selectedGroupForMembers.id);
                      return (
                        <div key={member.id} className="flex items-start justify-between p-2 hover:bg-[#111b21] rounded gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${labelColor(member.label)}`}></span>
                              <p className="text-white text-sm font-medium">{member.name}</p>
                            </div>
                            <p className="text-[#8696a0] text-xs mt-0.5 ml-4">{member.phone}</p>
                            {otherGroups.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5 ml-4">
                                {otherGroups.map((g) => (
                                  <span key={g.id} className="bg-blue-500/15 text-blue-400 text-xs px-2 py-0.5 rounded-full border border-blue-500/25">{g.name}</span>
                                ))}
                              </div>
                            )}
                            {otherGroups.length === 0 && (
                              <p className="text-[#4a5568] text-xs mt-1 ml-4 italic">Only in this group</p>
                            )}
                          </div>
                          <button onClick={() => handleRemoveMember(member.id)} className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded shrink-0">Remove</button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Add Members */}
              <div className="border-t border-[#2a3942] pt-4">
                <h4 className="text-white font-medium mb-3">Add Members</h4>
                <div className="mb-3">
                  <div className="bg-[#2a3942] rounded-lg p-2 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#8696a0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search contacts..."
                      value={contactSearchTerm}
                      onChange={(e) => setContactSearchTerm(e.target.value)}
                      className="bg-transparent flex-1 text-white outline-none text-sm"
                    />
                  </div>
                </div>

                {filteredAvailableContacts().length > 0 && (
                  <div className="flex items-center gap-3 px-2 py-2 mb-1 bg-[#111b21] rounded-lg">
                    <input
                      type="checkbox"
                      checked={allAvailableSelected}
                      ref={(el) => { if (el) el.indeterminate = someAvailableSelected; }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-[#00a884] cursor-pointer"
                    />
                    <span className="text-[#8696a0] text-sm">
                      {allAvailableSelected ? 'Deselect all' : `Select all ${filteredAvailableContacts().length} contacts`}
                    </span>
                    {selectedContactIds.length > 0 && (
                      <span className="ml-auto text-[#00a884] text-xs font-medium">{selectedContactIds.length} selected</span>
                    )}
                  </div>
                )}

                <div className="max-h-48 overflow-y-auto space-y-1 bg-[#2a3942] rounded-lg p-2">
                  {filteredAvailableContacts().length === 0 ? (
                    <p className="text-center text-[#8696a0] py-4">{contactSearchTerm ? 'No matching contacts found' : 'No contacts available to add'}</p>
                  ) : (
                    filteredAvailableContacts().map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-2 p-2 hover:bg-[#111b21] rounded cursor-pointer transition-colors"
                        onClick={(e) => toggleContactSelection(contact.id, e)}
                      >
                        <div onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" checked={selectedContactIds.includes(contact.id)} onChange={() => {}} className="w-4 h-4 accent-[#00a884] cursor-pointer" />
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm">{contact.name}</p>
                          <p className="text-[#8696a0] text-xs">{contact.phone}</p>
                        </div>
                        <span className={`w-2 h-2 rounded-full ${labelColor(contact.label)}`}></span>
                      </div>
                    ))
                  )}
                </div>

                <div className="flex gap-3 mt-4">
                  <button
                    onClick={handleAddMembers}
                    disabled={selectedContactIds.length === 0 || addingMembers}
                    className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
                  >
                    {addingMembers ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Adding...</span>
                      </div>
                    ) : `Add Selected (${selectedContactIds.length})`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── SEND BROADCAST MODAL ── */}
      {showSendModal && selectedGroup && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#202c33] p-4 border-b border-[#2a3942] flex justify-between items-center">
              <h3 className="text-white font-semibold">Send Broadcast to: {selectedGroup.name} ({selectedGroup.contact_count} members)</h3>
              <button onClick={resetSendModal} className="text-white text-2xl hover:text-gray-300">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={() => setMessageType('text')} className={`flex-1 py-2 rounded-lg transition ${messageType === 'text' ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'}`}>💬 Text Message</button>
                <button onClick={() => setMessageType('template')} className={`flex-1 py-2 rounded-lg transition ${messageType === 'template' ? 'bg-[#00a884] text-white' : 'bg-[#2a3942] text-[#8696a0] hover:text-white'}`}>📋 WhatsApp Template</button>
              </div>

              {messageType === 'text' && (
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Message</label>
                  <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={6} className="w-full bg-[#2a3942] text-white rounded-lg p-3 outline-none focus:ring-1 focus:ring-[#00a884] resize-none" placeholder="Type your broadcast message here..." />
                  <p className="text-[#8696a0] text-xs mt-2">Characters: {messageText.length}</p>
                </div>
              )}

              {messageType === 'template' && (
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Select WhatsApp Template</label>
                  <select value={selectedTemplate} onChange={(e) => handleTemplateSelect(e.target.value)} className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884] mb-4">
                    <option value="">Choose a template...</option>
                    {templates.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.category})</option>)}
                  </select>

                  {hasMediaHeader && templateHeaderType && (
                    <div className="bg-[#2a3942] rounded-lg p-3 mb-4">
                      <label className="block text-[#00a884] text-sm mb-2">
                        {templateHeaderType === 'image' ? '🖼️ Upload Image for Header' : templateHeaderType === 'video' ? '🎬 Upload Video for Header' : templateHeaderType === 'document' ? '📄 Upload Document for Header' : '📎 Upload Media for Header'}
                      </label>
                      <input type="file" accept={templateHeaderType === 'image' ? 'image/*' : templateHeaderType === 'video' ? 'video/*' : templateHeaderType === 'document' ? '.pdf,.doc,.docx' : '*/*'} onChange={handleHeaderMediaSelect} className="w-full bg-[#111b21] text-white text-sm rounded-lg p-2 outline-none cursor-pointer" />
                      {headerMediaFile && (
                        <div className="mt-2">
                          <p className="text-green-400 text-xs">✓ File selected: {headerMediaFile.name}</p>
                          {templateHeaderType === 'image' && <img src={URL.createObjectURL(headerMediaFile)} alt="Preview" className="mt-2 max-h-32 rounded-lg object-cover" />}
                        </div>
                      )}
                    </div>
                  )}

                  {selectedTemplateObj && Object.keys(templateVariables).length > 0 && (
                    <div className="space-y-3 mb-4">
                      <label className="block text-[#8696a0] text-sm mb-2">Template Variables</label>
                      {Object.entries(templateVariables).map(([key, value]) => (
                        <input key={key} type="text" value={value} onChange={(e) => setTemplateVariables({ ...templateVariables, [key]: e.target.value })} placeholder={key} className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" />
                      ))}
                    </div>
                  )}

                  {selectedTemplateObj && (
                    <div className="bg-[#2a3942] rounded-lg p-4 mt-4">
                      <p className="text-[#8696a0] text-xs mb-3">Template Preview</p>
                      <div className="bg-[#111b21] rounded-lg p-4">
                        {hasMediaHeader && headerMediaFile && templateHeaderType === 'image' && <img src={URL.createObjectURL(headerMediaFile)} alt="Header preview" className="max-h-40 rounded-lg object-cover mb-3" />}
                        {selectedTemplateObj.components?.map((comp: any, idx: number) => {
                          if (comp.type === 'BODY') {
                            let bodyText = comp.text || '';
                            Object.entries(templateVariables).forEach(([key, value]) => { bodyText = bodyText.replace(new RegExp(`{{${key}}}`, 'g'), value || `{{${key}}}`); });
                            return <p key={idx} className="text-white text-sm whitespace-pre-wrap">{bodyText}</p>;
                          }
                          return null;
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-[#2a3942]">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input type="checkbox" checked={scheduleBroadcast} onChange={(e) => setScheduleBroadcast(e.target.checked)} className="w-4 h-4 accent-[#00a884]" />
                  <span className="text-white text-sm">Schedule broadcast for later</span>
                </label>
                {scheduleBroadcast && (
                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} min={new Date().toISOString().split('T')[0]} className="bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" />
                    <input type="time" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]" />
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleSendBroadcast}
                  disabled={sending || (messageType === 'text' && !messageText.trim()) || (messageType === 'template' && !selectedTemplate) || (hasMediaHeader && !headerMediaFile)}
                  className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
                >
                  {sending ? <div className="flex items-center justify-center gap-2"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div><span>{scheduleBroadcast ? 'Scheduling...' : 'Sending...'}</span></div> : scheduleBroadcast ? 'Schedule Broadcast' : 'Send Now'}
                </button>
                <button onClick={resetSendModal} className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}