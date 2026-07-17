'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';

interface Contact {
  id: number;
  phone: string;
  name: string;
  label: 'green' | 'yellow' | 'red' | 'none';
  country_code: string;
  created_at: string;
  updated_at: string;
}

export default function ContactManager() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    country_code: '+91',
    label: 'none' as 'green' | 'yellow' | 'red' | 'none',
  });
  const [uploadData, setUploadData] = useState<any[]>([]);
  const [uploadPreview, setUploadPreview] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [filterLabel, setFilterLabel] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedPhones, setSelectedPhones] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // FIX: use a ref for country_code so handleFileUpload always reads current value
  // without this, the closure inside FileReader always sees the initial '+91'
  const countryCodeRef = useRef('+91');
  useEffect(() => {
    countryCodeRef.current = formData.country_code;
  }, [formData.country_code]);

  const [uploadCountryCode, setUploadCountryCode] = useState('+91');

  // Toast
  const [toast, setToast] = useState<{ show: boolean; message: string; type: string }>({
    show: false, message: '', type: 'info',
  });
  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 4000);
  };

  const countryCodes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' },
    { code: '+971', country: 'UAE', flag: '🇦🇪' },
    { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦' },
    { code: '+65', country: 'Singapore', flag: '🇸🇬' },
    { code: '+60', country: 'Malaysia', flag: '🇲🇾' },
    { code: '+62', country: 'Indonesia', flag: '🇮🇩' },
    { code: '+66', country: 'Thailand', flag: '🇹🇭' },
    { code: '+84', country: 'Vietnam', flag: '🇻🇳' },
    { code: '+63', country: 'Philippines', flag: '🇵🇭' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+39', country: 'Italy', flag: '🇮🇹' },
    { code: '+34', country: 'Spain', flag: '🇪🇸' },
  ];

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/contacts');
      const data = await response.json();
      if (data.success) setContacts(data.contacts);
    } catch (error) {
      console.error('Error fetching contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!formData.name || (!editingContact && !formData.phone)) {
      showToast('Please fill in all required fields', 'warning');
      return;
    }

    const fullPhone = formData.country_code + formData.phone.replace(/[^0-9]/g, '');

    try {
      const response = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          phone: fullPhone,
          label: formData.label,
          country_code: formData.country_code,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchContacts();
        setShowAddModal(false);
        setFormData({ name: '', phone: '', country_code: '+91', label: 'none' });
        showToast('Contact added successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to add contact', 'error');
      }
    } catch {
      showToast('Failed to add contact', 'error');
    }
  };

  const handleUpdateContact = async () => {
    if (!editingContact) return;
    if (!formData.name.trim()) {
      showToast('Name is required', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/contacts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingContact.id,
          name: formData.name,
          label: formData.label,
        }),
      });

      const data = await response.json();
      if (data.success) {
        await fetchContacts();
        closeAddModal();
        showToast('Contact updated successfully!', 'success');
      } else {
        showToast(data.error || 'Failed to update contact', 'error');
      }
    } catch {
      showToast('Failed to update contact', 'error');
    }
  };

  const handleDeleteContact = async (phone: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;

    setDeletingId(phone);
    try {
      const response = await fetch(`/api/contacts/delete?phone=${encodeURIComponent(phone)}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (data.success) {
        await fetchContacts();
        showToast('Contact deleted', 'success');
      } else {
        showToast(data.error || 'Failed to delete contact', 'error');
      }
    } catch {
      showToast('Failed to delete contact', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedPhones.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedPhones.length} contacts?`)) return;

    try {
      const response = await fetch('/api/contacts/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones: selectedPhones }),
      });
      const data = await response.json();
      if (data.success) {
        await fetchContacts();
        setSelectedPhones([]);
        showToast(`${selectedPhones.length} contacts deleted`, 'success');
      } else {
        showToast(data.error || 'Failed to delete contacts', 'error');
      }
    } catch {
      showToast('Failed to delete contacts', 'error');
    }
  };

  const openEditModal = (contact: Contact) => {
    setEditingContact(contact);
    setFormData({
      name: contact.name,
      phone: contact.phone,
      country_code: contact.country_code || '+91',
      label: contact.label,
    });
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setEditingContact(null);
    setFormData({ name: '', phone: '', country_code: '+91', label: 'none' });
  };

  // FIX: normalizePhone is a pure function — takes cc explicitly, no closure risk
  const normalizePhone = (rawPhone: string, cc: string): string => {
    // Strip spaces, dashes, parens, dots
    let phone = String(rawPhone).replace(/[\s\-\(\)\.]/g, '').trim();
    const ccDigits = cc.replace('+', ''); // e.g. "91"

    if (!phone) return '';

    // Already fully formatted with +
    if (phone.startsWith('+')) return phone;

    const digits = phone.replace(/^\+/, '');

    // Has country code prefix without + (e.g. 919876543210 for India)
    if (digits.startsWith(ccDigits) && digits.length === ccDigits.length + 10) {
      return '+' + digits;
    }

    // Plain 10-digit local number
    if (digits.length === 10 && /^\d{10}$/.test(digits)) {
      return cc + digits;
    }

    // Any other case — just prepend cc
    return cc + digits;
  };

  // FIX: handleFileUpload uses uploadCountryCode state (separate from formData)
  // so changing country code in upload modal doesn't get lost in a stale closure
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Capture current country code at the moment of file selection
    const cc = uploadCountryCode;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const raw_json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        console.log('=== RAW EXCEL DATA (first 5 rows) ===');
        console.log(JSON.stringify(raw_json.slice(0, 5), null, 2));
        console.log('Total rows parsed by XLSX:', raw_json.length);

        if (raw_json.length === 0) {
          showToast('Excel file appears empty or could not be read', 'error');
          return;
        }

        // Log actual column names from first row
        const columnNames = Object.keys(raw_json[0] as object);
        console.log('Column names found in Excel:', columnNames);

        const processedData = (raw_json as any[])
          .map((row: any) => {
            // Support many possible column name variations
            const rawPhone = String(
              row.Phone       ?? row.phone       ?? row.PHONE       ??
              row.Mobile      ?? row.mobile      ?? row.MOBILE      ??
              row['Phone Number']   ?? row['phone number']   ??
              row['Mobile Number']  ?? row['mobile number']  ??
              row['Contact No']     ?? row['contact no']     ??
              row['Contact Number'] ?? row['contact number'] ??
              row['WhatsApp']       ?? row['whatsapp']       ??
              row['Number']         ?? row['number']         ??
              ''
            ).trim();

            const rawName = String(
              row.Name          ?? row.name          ?? row.NAME          ??
              row['Full Name']  ?? row['full name']  ??
              row['FullName']   ??
              row['Customer']   ?? row['customer']   ??
              row['Customer Name'] ?? row['customer name'] ??
              row['Contact Name']  ?? row['contact name']  ??
              row['Client']     ?? row['client']     ??
              ''
            ).trim();

            if (!rawName && !rawPhone) return null;

            const phone = normalizePhone(rawPhone, cc);

            return { name: rawName, phone, _raw: rawPhone };
          })
          .filter((item): item is NonNullable<typeof item> =>
            item !== null &&
            item.name.length > 0 &&
            item.phone.length > 6
          );

        console.log('=== PROCESSED CONTACTS (first 5) ===');
        console.log(JSON.stringify(processedData.slice(0, 5), null, 2));
        console.log(`✅ Valid: ${processedData.length} | ❌ Skipped: ${raw_json.length - processedData.length}`);

        if (processedData.length === 0) {
          showToast(
            `No valid contacts found. Columns detected: ${columnNames.join(', ')}. ` +
            `Need "Name" and "Phone" columns.`,
            'error'
          );
          return;
        }

        // Strip debug _raw field before storing
        const clean = processedData.map(({ name, phone }) => ({ name, phone }));
        setUploadPreview(clean);
        setUploadData(clean);
        showToast(`Found ${clean.length} contacts — review and confirm upload`, 'info');
      } catch (err: any) {
        console.error('Excel parse error:', err);
        showToast('Failed to read Excel file: ' + err.message, 'error');
      }
    };
    reader.readAsArrayBuffer(file);
  }, [uploadCountryCode]); // dependency: re-creates when country code changes

  const handleUploadContacts = async () => {
    if (uploadData.length === 0) return;
    setUploading(true);

    const BATCH_SIZE = 100;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalSkipped = 0;
    let totalErrors = 0;

    try {
      for (let i = 0; i < uploadData.length; i += BATCH_SIZE) {
        const batch = uploadData.slice(i, i + BATCH_SIZE).map((c) => ({
          phone: c.phone,
          name: c.name,
          label: 'none',
        }));

        console.log(`Sending batch ${i / BATCH_SIZE + 1}: ${batch.length} contacts`);

        const res = await fetch('/api/contacts/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contacts: batch }),
        });

        if (!res.ok) {
          const errText = await res.text();
          console.error(`Batch ${i}–${i + BATCH_SIZE} HTTP error ${res.status}:`, errText);
          totalErrors += batch.length;
          continue;
        }

        const result = await res.json();
        console.log(`Batch result:`, result);

        if (result.success) {
          totalInserted += result.summary.inserted ?? 0;
          totalUpdated  += result.summary.updated  ?? 0;
          totalSkipped  += result.summary.skipped  ?? 0;
          totalErrors   += result.summary.errors   ?? 0;
        } else {
          console.error('Batch failed:', result.error);
          totalErrors += batch.length;
        }
      }

      await fetchContacts();
      setShowUploadModal(false);
      setUploadData([]);
      setUploadPreview([]);
      if (fileInputRef.current) fileInputRef.current.value = '';

      showToast(
        `Upload complete! ✅ ${totalInserted} added, 🔄 ${totalUpdated} updated, ⏭ ${totalSkipped} skipped` +
        (totalErrors > 0 ? `, ❌ ${totalErrors} errors` : ''),
        totalErrors > 0 ? 'warning' : 'success'
      );
    } catch (err) {
      console.error('Upload failed:', err);
      showToast('Upload failed — check browser console for details', 'error');
    } finally {
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = [
      { Name: 'John Doe',   Phone: '9876543210' },
      { Name: 'Jane Smith', Phone: '8765432109' },
      { Name: 'Raj Kumar',  Phone: '7654321098' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Contacts Template');
    XLSX.writeFile(wb, 'contacts_template.xlsx');
  };

  const getLabelInfo = (label: string) => {
    switch (label) {
      case 'green':  return { color: 'bg-green-500',  text: 'Interested' };
      case 'yellow': return { color: 'bg-yellow-500', text: 'Prospect' };
      case 'red':    return { color: 'bg-red-500',    text: 'Not Interested' };
      default:       return { color: 'bg-gray-500',   text: 'None' };
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.phone.includes(searchTerm);
    const matchesLabel = filterLabel === 'all' || contact.label === filterLabel;
    return matchesSearch && matchesLabel;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-white text-sm transition-all duration-300 max-w-sm ${
          toast.type === 'success' ? 'bg-green-500' :
          toast.type === 'error'   ? 'bg-red-500'   :
          toast.type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-white text-xl font-semibold">Contact Management</h2>
          <p className="text-[#8696a0] text-sm mt-1">
            Manage your WhatsApp contacts and labels
            <span className="ml-2 text-[#00a884] font-medium">{contacts.length} total</span>
          </p>
        </div>
        <div className="flex gap-3">
          {selectedPhones.length > 0 && (
            <button
              onClick={handleBulkDelete}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete Selected ({selectedPhones.length})
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-[#00a884] hover:bg-[#008f6e] text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Contact
          </button>
          <button
            onClick={() => setShowUploadModal(true)}
            className="bg-[#2a3942] hover:bg-[#3a4a54] text-white px-4 py-2 rounded-lg transition flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload CSV/Excel
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex-1 min-w-[200px]">
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
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="text-[#8696a0] hover:text-white text-sm">✕</button>
            )}
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            { value: 'all',    label: 'All',             activeClass: 'bg-[#00a884] text-white' },
            { value: 'green',  label: '🟢 Interested',   activeClass: 'bg-green-500 text-white' },
            { value: 'yellow', label: '🟡 Prospect',     activeClass: 'bg-yellow-500 text-white' },
            { value: 'red',    label: '🔴 Not Interested', activeClass: 'bg-red-500 text-white' },
          ].map((f) => (
            <button
              key={f.value}
              onClick={() => setFilterLabel(f.value)}
              className={`px-3 py-2 rounded-lg text-sm transition ${
                filterLabel === f.value ? f.activeClass : 'bg-[#202c33] text-[#8696a0] hover:bg-[#2a3942]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Contacts Table */}
      <div className="bg-[#202c33] rounded-lg overflow-hidden border border-[#2a3942]">
        <div className="overflow-x-auto">
          {/* FIX: thead/tbody properly structured */}
          <table className="w-full">
            <thead>
              <tr className="text-left text-[#8696a0] text-sm bg-[#1a2530]">
                <th className="px-6 py-3">
                  <input
                    type="checkbox"
                    checked={selectedPhones.length === filteredContacts.length && filteredContacts.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedPhones(filteredContacts.map(c => c.phone));
                      else setSelectedPhones([]);
                    }}
                    className="w-4 h-4 accent-[#00a884] cursor-pointer"
                  />
                </th>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Phone Number</th>
                <th className="px-6 py-3">Label</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#8696a0]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884] mx-auto mb-2"></div>
                    Loading contacts...
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[#8696a0]">
                    {searchTerm || filterLabel !== 'all'
                      ? 'No contacts match your filters'
                      : 'No contacts yet — add one to get started'}
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => {
                  const label = getLabelInfo(contact.label);
                  const isDeleting = deletingId === contact.phone;
                  return (
                    <tr
                      key={contact.id}
                      className={`border-t border-[#2a3942] hover:bg-[#2a3942]/30 transition group ${
                        selectedPhones.includes(contact.phone) ? 'bg-[#2a3942]/50' : ''
                      }`}
                    >
                      <td className="px-6 py-3">
                        <input
                          type="checkbox"
                          checked={selectedPhones.includes(contact.phone)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedPhones([...selectedPhones, contact.phone]);
                            else setSelectedPhones(selectedPhones.filter(p => p !== contact.phone));
                          }}
                          className="w-4 h-4 accent-[#00a884] cursor-pointer"
                        />
                      </td>
                      <td className="px-6 py-3 text-white font-medium">{contact.name}</td>
                      {/* FIX: show phone as-is from DB, no extra country code prepended */}
                      <td className="px-6 py-3 text-[#e9edef]">{contact.phone}</td>
                      <td className="px-6 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs text-white ${label.color}`}>
                          {label.text}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-[#8696a0] text-sm">
                        {new Date(contact.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(contact)}
                            title="Edit contact"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/15 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 text-xs font-medium transition"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteContact(contact.phone)}
                            disabled={isDeleting}
                            title="Delete contact"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/15 hover:bg-red-500/30 text-red-400 hover:text-red-300 text-xs font-medium transition disabled:opacity-50"
                          >
                            {isDeleting ? (
                              <div className="w-3.5 h-3.5 border border-red-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                            {isDeleting ? 'Deleting…' : 'Delete'}
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

        {filteredContacts.length > 0 && (
          <div className="px-6 py-3 border-t border-[#2a3942] text-[#8696a0] text-xs">
            Showing {filteredContacts.length} of {contacts.length} contacts
          </div>
        )}
      </div>

      {/* ── ADD / EDIT CONTACT MODAL ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-lg w-full max-w-md">
            <div className="p-4 border-b border-[#2a3942] flex justify-between items-center">
              <h3 className="text-white font-semibold">
                {editingContact ? 'Edit Contact' : 'Add New Contact'}
              </h3>
              <button onClick={closeAddModal} className="text-white text-2xl hover:text-gray-300">✕</button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[#8696a0] text-sm mb-2">Contact Name *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Enter contact name"
                  className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                  autoFocus
                />
              </div>

              {!editingContact && (
                <>
                  <div>
                    <label className="block text-[#8696a0] text-sm mb-2">Country Code</label>
                    <select
                      value={formData.country_code}
                      onChange={(e) => setFormData({ ...formData, country_code: e.target.value })}
                      className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none"
                    >
                      {countryCodes.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.flag} {c.code} — {c.country}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#8696a0] text-sm mb-2">Phone Number *</label>
                    <div className="flex gap-2">
                      <span className="bg-[#2a3942] text-white px-3 py-2 rounded-lg text-sm">
                        {formData.country_code}
                      </span>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="9876543210"
                        className="flex-1 bg-[#2a3942] text-white rounded-lg p-2 outline-none focus:ring-1 focus:ring-[#00a884]"
                      />
                    </div>
                  </div>
                </>
              )}

              {editingContact && (
                <div>
                  <label className="block text-[#8696a0] text-sm mb-2">Phone Number</label>
                  <div className="bg-[#1a2530] text-[#8696a0] rounded-lg p-2 text-sm border border-[#2a3942]">
                    {editingContact.phone}
                    <span className="ml-2 text-xs italic">(cannot be changed)</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-[#8696a0] text-sm mb-2">Status Label</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: 'green',  label: 'Interested', color: 'bg-green-500',  border: 'border-green-500' },
                    { value: 'yellow', label: 'Prospect',   color: 'bg-yellow-500', border: 'border-yellow-500' },
                    { value: 'red',    label: 'Not Int.',   color: 'bg-red-500',    border: 'border-red-500' },
                    { value: 'none',   label: 'None',       color: 'bg-gray-500',   border: 'border-gray-500' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFormData({ ...formData, label: opt.value as any })}
                      className={`flex flex-col items-center gap-1.5 py-2.5 rounded-lg border-2 transition ${
                        formData.label === opt.value
                          ? `${opt.border} bg-white/5`
                          : 'border-[#2a3942] hover:border-[#3a4a54]'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full ${opt.color}`}></span>
                      <span className="text-white text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={editingContact ? handleUpdateContact : handleAddContact}
                  className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] transition font-medium"
                >
                  {editingContact ? 'Save Changes' : 'Add Contact'}
                </button>
                <button
                  onClick={closeAddModal}
                  className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── UPLOAD CONTACTS MODAL ── */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#202c33] rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-[#202c33] p-4 border-b border-[#2a3942] flex justify-between items-center">
              <h3 className="text-white font-semibold">Upload Contacts</h3>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setUploadData([]);
                  setUploadPreview([]);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="text-white text-2xl hover:text-gray-300"
              >✕</button>
            </div>
            <div className="p-4 space-y-4">

              {/* FIX: uploadCountryCode is separate state — does not conflict with formData */}
              <div>
                <label className="block text-[#8696a0] text-sm mb-2">Country Code for All Contacts</label>
                <select
                  value={uploadCountryCode}
                  onChange={(e) => {
                    setUploadCountryCode(e.target.value);
                    // Clear preview so user re-uploads with new country code
                    setUploadData([]);
                    setUploadPreview([]);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="w-full bg-[#2a3942] text-white rounded-lg p-2 outline-none"
                >
                  {countryCodes.map((c) => (
                    <option key={c.code} value={c.code}>{c.flag} {c.code} — {c.country}</option>
                  ))}
                </select>
                {uploadData.length > 0 && (
                  <p className="text-yellow-400 text-xs mt-1">
                    ⚠️ Changing country code clears the preview — please re-select your file.
                  </p>
                )}
              </div>

              <div className="border-2 border-dashed border-[#2a3942] rounded-lg p-8 text-center">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv,.xlsx,.xls"
                  className="hidden"
                />
                <svg className="w-12 h-12 text-[#8696a0] mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <p className="text-white mb-2">Click to upload CSV or Excel file</p>
                <p className="text-[#8696a0] text-sm mb-1">File must have <strong className="text-white">Name</strong> and <strong className="text-white">Phone</strong> columns</p>
                <p className="text-[#8696a0] text-xs">Supported: .xlsx, .xls, .csv</p>
                <div className="flex justify-center gap-3 mt-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-[#00a884] text-white px-4 py-2 rounded-lg hover:bg-[#008f6e] transition"
                  >
                    Select File
                  </button>
                  <button
                    onClick={downloadTemplate}
                    className="bg-[#2a3942] text-white px-4 py-2 rounded-lg hover:bg-[#3a4a54] transition"
                  >
                    Download Template
                  </button>
                </div>
              </div>

              {uploadPreview.length > 0 && (
                <div>
                  <h4 className="text-white font-medium mb-2">
                    Preview — {uploadPreview.length} contacts ready to upload
                  </h4>
                  <div className="bg-[#2a3942] rounded-lg overflow-x-auto max-h-64">
                    <table className="w-full text-sm">
                      <thead className="bg-[#1f2c33]">
                        <tr>
                          <th className="px-3 py-2 text-left text-[#8696a0]">#</th>
                          <th className="px-3 py-2 text-left text-[#8696a0]">Name</th>
                          {/* FIX: preview shows the already-normalized phone, no extra cc prepend */}
                          <th className="px-3 py-2 text-left text-[#8696a0]">Phone (normalized)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {uploadPreview.slice(0, 10).map((contact, idx) => (
                          <tr key={idx} className="border-t border-[#2a3942]">
                            <td className="px-3 py-2 text-[#8696a0]">{idx + 1}</td>
                            <td className="px-3 py-2 text-white">{contact.name}</td>
                            <td className="px-3 py-2 text-[#e9edef]">{contact.phone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {uploadPreview.length > 10 && (
                      <p className="text-center text-[#8696a0] text-xs py-2">
                        + {uploadPreview.length - 10} more contacts not shown
                      </p>
                    )}
                  </div>
                </div>
              )}

              {uploadPreview.length > 0 && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleUploadContacts}
                    disabled={uploading}
                    className="flex-1 bg-[#00a884] text-white py-2 rounded-lg hover:bg-[#008f6e] disabled:opacity-50 transition font-medium"
                  >
                    {uploading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Uploading {uploadPreview.length} contacts...</span>
                      </div>
                    ) : `Upload ${uploadPreview.length} Contacts`}
                  </button>
                  <button
                    onClick={() => {
                      setUploadData([]);
                      setUploadPreview([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}