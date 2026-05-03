import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCcw, ChevronDown, ChevronRight, Users, CheckCircle2, XCircle, Search, Upload, AlertCircle, Loader2, UserMinus, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

const NAME_KEYS  = ['name'];
const EMAIL_KEYS = ['email', 'mail'];
const PHONE_KEYS = ['phone', 'mobile', 'mob', 'contact', 'ph', 'cell', 'tel'];

const safeStr = (val) => (val !== undefined && val !== null) ? String(val) : '';
const formatKey = (key) => key.toLowerCase().replace(/[^a-z0-9]/g, '');

function autoDetect(columns, keywords) {
  return columns.find(col => keywords.some(k => formatKey(col).includes(k))) || '';
}

function EligibleUsers() {
  const [groups, setGroups] = useState([]); // [{ ...group, users: [] }]
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);
  
  const [uploadingGroupId, setUploadingGroupId] = useState(null);
  const fileInputRef = useRef(null);

  // Duplicates State
  const [duplicateUsers, setDuplicateUsers] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateGroupId, setDuplicateGroupId] = useState(null);
  const [isRemovingDuplicates, setIsRemovingDuplicates] = useState(false);

  // Field Mapping State for Appending
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const [mappingFileData, setMappingFileData] = useState(null);
  const [fieldMapping, setFieldMapping] = useState({});
  const [isImporting, setIsImporting] = useState(false);

  const fetchAll = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch all groups
      const { data: groupsData, error: groupsError } = await supabase
        .from('groups')
        .select('*')
        .order('created_at', { ascending: false });

      if (groupsError) throw groupsError;

      // For each group, fetch its users
      const groupsWithUsers = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { data: users, error: usersError } = await supabase
            .from('users')
            .select('id, name, email, phone, certificate_id, is_eligible, extra_data, created_at')
            .eq('group_id', group.id)
            .order('name', { ascending: true });

          return {
            ...group,
            users: usersError ? [] : (users || []),
          };
        })
      );

      // Also fetch users with no group (legacy data)
      const { data: orphanUsers } = await supabase
        .from('users')
        .select('id, name, email, phone, certificate_id, is_eligible, extra_data, created_at')
        .is('group_id', null)
        .order('name', { ascending: true });

      if (orphanUsers && orphanUsers.length > 0) {
        groupsWithUsers.push({
          id: '__orphan__',
          name: 'Ungrouped Users (Legacy)',
          columns: [],
          created_at: null,
          users: orphanUsers,
        });
      }

      setGroups(groupsWithUsers);
      // Auto-expand first group
      if (groupsWithUsers.length > 0) {
        setExpandedGroups({ [groupsWithUsers[0].id]: true });
      }
    } catch (err) {
      console.error('Error fetching users:', err);
      setError('Failed to load users. Check console for details.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const toggleGroup = (groupId) => {
    setExpandedGroups(prev => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Filter users by search query across all groups
  const filterUsers = (users) => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(u =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.includes(q) ||
      u.certificate_id?.toLowerCase().includes(q)
    );
  };

  const totalUsers = groups.reduce((sum, g) => sum + g.users.length, 0);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingGroupId) return;

    setError(null);
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const workbook = XLSX.read(event.target.result, { type: 'binary' });
          const worksheet = workbook.Sheets[workbook.SheetNames[0]];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length > 0) {
            const headers = jsonData[0].map(h => h ? h.toString().trim() : 'Unknown');
            const allRows = XLSX.utils.sheet_to_json(worksheet, { header: headers, range: 1 });

            const targetGroup = groups.find(g => g.id === uploadingGroupId);
            if (!targetGroup) return;

            const nameCol = autoDetect(headers, NAME_KEYS);
            const emailCol = autoDetect(headers, EMAIL_KEYS);
            const phoneCol = autoDetect(headers, PHONE_KEYS);
            
            // Expected template columns from the target group
            const originalExtraCols = targetGroup.columns || [];
            
            // Try to auto-match new headers to old extra columns
            const initialMapping = {
              __name__: nameCol,
              __email__: emailCol,
              __phone__: phoneCol,
            };
            
            // Try to auto-match each group column to new Excel headers.
            // Priority: exact name match → fuzzy system-field match → blank (needs manual)
            const isNameLike  = (c) => NAME_KEYS.some(k  => formatKey(c).includes(k));
            const isEmailLike = (c) => EMAIL_KEYS.some(k => formatKey(c).includes(k));
            const isPhoneLike = (c) => PHONE_KEYS.some(k => formatKey(c).includes(k));

            originalExtraCols.forEach(col => {
              if (headers.includes(col)) {
                // Exact column name match in new file → use it
                initialMapping[col] = col;
              } else if (isNameLike(col) && nameCol) {
                // Group column is a "name" type → point it at detected name column
                initialMapping[col] = nameCol;
              } else if (isEmailLike(col) && emailCol) {
                initialMapping[col] = emailCol;
              } else if (isPhoneLike(col) && phoneCol) {
                initialMapping[col] = phoneCol;
              } else {
                // Fuzzy: find any new header that partially matches old column name
                const fuzzy = headers.find(h =>
                  formatKey(h).includes(formatKey(col)) || formatKey(col).includes(formatKey(h))
                );
                initialMapping[col] = fuzzy || '';
              }
            });

            setMappingFileData({ headers, allRows, targetGroup, originalExtraCols });
            setFieldMapping(initialMapping);
            setMappingModalOpen(true);
            
          }
        } catch (err) {
          console.error('Error processing Excel:', err);
          setError('Failed to process Excel file.');
          closeMappingModal();
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error('File upload error:', err);
      setError('Failed to upload file.');
      closeMappingModal();
    }
  };

  const closeMappingModal = () => {
    setMappingModalOpen(false);
    setMappingFileData(null);
    setUploadingGroupId(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleConfirmImport = async () => {
    if (!mappingFileData) return;
    setIsImporting(true);
    
    const { allRows, targetGroup, originalExtraCols } = mappingFileData;
    
    try {
      const usersToInsert = allRows.map(row => {
        const extra = {};
        originalExtraCols.forEach(col => {
          const mappedHeader = fieldMapping[col];
          extra[col] = mappedHeader ? safeStr(row[mappedHeader]) : '';
        });

        return {
          name: safeStr(row[fieldMapping.__name__]) || 'Unknown',
          email: safeStr(row[fieldMapping.__email__]),
          phone: safeStr(row[fieldMapping.__phone__]),
          certificate_id: `CERT-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
          is_eligible: true,
          group_id: targetGroup.id,
          extra_data: extra,
        };
      });

      const { error: insertError } = await supabase.from('users').insert(usersToInsert);
      if (insertError) throw insertError;

      await fetchAll();
      setExpandedGroups(prev => ({ ...prev, [targetGroup.id]: true }));
      closeMappingModal();
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import users.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleFindDuplicates = (groupId) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.users) return;

    const seenEmails = new Set();
    const seenPhones = new Set();
    const duplicates = [];
    
    group.users.forEach(user => {
      let isDuplicate = false;
      const email = user.email?.toLowerCase().trim();
      const phone = user.phone?.replace(/[^0-9+]/g, ''); 

      if (email && seenEmails.has(email)) {
        isDuplicate = true;
      }
      if (phone && seenPhones.has(phone)) {
        isDuplicate = true;
      }

      if (isDuplicate) {
        duplicates.push(user);
      } else {
        if (email) seenEmails.add(email);
        if (phone) seenPhones.add(phone);
      }
    });

    if (duplicates.length === 0) {
      alert("No duplicates found in this group.");
      return;
    }

    setDuplicateUsers(duplicates);
    setDuplicateGroupId(groupId);
    setShowDuplicateModal(true);
  };

  const handleRemoveDuplicates = async () => {
    if (duplicateUsers.length === 0) return;
    setIsRemovingDuplicates(true);
    try {
      const idsToRemove = duplicateUsers.map(u => u.id);
      
      const { error: delError } = await supabase
        .from('users')
        .delete()
        .in('id', idsToRemove);

      if (delError) throw delError;
      
      setShowDuplicateModal(false);
      setDuplicateUsers([]);
      setDuplicateGroupId(null);
      await fetchAll();
      
    } catch (err) {
      console.error('Error removing duplicates:', err);
      alert('Failed to remove duplicates.');
    } finally {
      setIsRemovingDuplicates(false);
    }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-on-surface-variant text-sm">
            <span className="text-primary font-medium">{totalUsers}</span> total users across{' '}
            <span className="text-primary font-medium">{groups.filter(g => g.id !== '__orphan__').length}</span> group(s)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="bg-surface-container border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm focus:border-primary outline-none w-48"
            />
          </div>
          <button
            onClick={fetchAll}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Refresh"
          >
            <RefreshCcw size={16} className="text-on-surface-variant" />
          </button>
        </div>
      </div>

      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept=".xlsx,.xls,.csv" 
        onChange={handleFileUpload} 
      />

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>
      )}

      {isLoading ? (
        <div className="p-12 text-center text-on-surface-variant animate-pulse">Loading users...</div>
      ) : groups.length === 0 ? (
        <div className="p-12 text-center bg-surface-container-low rounded-2xl border border-white/5">
          <Users size={40} className="mx-auto mb-3 text-on-surface-variant opacity-40" />
          <p className="text-on-surface-variant">No users found. Upload an Excel file to add users.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(group => {
            const filteredUsers = filterUsers(group.users);
            const isExpanded = expandedGroups[group.id];

            // If searching and no users match this group, hide it
            if (searchQuery && filteredUsers.length === 0) return null;

            return (
              <div key={group.id} className="bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden">
                {/* Group Header */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left cursor-pointer"
                >
                  <div className="text-on-surface-variant">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-headline text-base text-on-surface">{group.name}</p>
                    {group.columns?.length > 0 && (
                      <p className="text-xs text-on-surface-variant mt-0.5">
                        Columns: {group.columns.join(', ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0" onClick={e => e.stopPropagation()}>
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      {filteredUsers.length} {searchQuery ? 'match' : 'user'}{filteredUsers.length !== 1 ? 's' : ''}
                    </span>
                    {group.created_at && (
                      <span className="text-xs text-on-surface-variant hidden sm:block">
                        {new Date(group.created_at).toLocaleDateString()}
                      </span>
                    )}
                    {group.id !== '__orphan__' && (
                      <div className="flex items-center gap-2 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFindDuplicates(group.id);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-xs font-medium transition-colors"
                          title="Find and remove duplicates"
                        >
                          <UserMinus size={14} />
                          <span className="hidden sm:inline">Duplicates</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadingGroupId(group.id);
                            fileInputRef.current?.click();
                          }}
                          disabled={uploadingGroupId === group.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                          title="Upload Excel to add users"
                        >
                          {uploadingGroupId === group.id ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Upload size={14} />
                          )}
                          <span className="hidden sm:inline">Add Users</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Users Table */}
                {isExpanded && (
                  <div className="border-t border-white/5 overflow-x-auto">
                    {filteredUsers.length === 0 ? (
                      <p className="p-6 text-center text-on-surface-variant text-sm">No users in this group yet.</p>
                    ) : (
                      <table className="w-full text-sm text-left">
                        <thead className="bg-white/5 text-xs uppercase text-on-surface-variant">
                          <tr>
                            <th className="px-4 py-3">Name</th>
                            <th className="px-4 py-3">Email</th>
                            <th className="px-4 py-3">Phone</th>
                            <th className="px-4 py-3">Certificate ID</th>
                            {/* Extra columns from group */}
                            {group.columns
                              .filter(c => !['name','email','phone'].some(r => c.toLowerCase().includes(r)))
                              .map(col => (
                                <th key={col} className="px-4 py-3">{col}</th>
                              ))
                            }
                            <th className="px-4 py-3 text-center">Eligible</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {filteredUsers.map(user => (
                            <tr key={user.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-4 py-3 font-medium text-on-surface">{user.name}</td>
                              <td className="px-4 py-3 text-on-surface-variant">{user.email || '—'}</td>
                              <td className="px-4 py-3 text-on-surface-variant">{user.phone || '—'}</td>
                              <td className="px-4 py-3">
                                <span className="font-mono text-xs bg-white/5 px-2 py-1 rounded">{user.certificate_id}</span>
                              </td>
                              {/* Extra data columns */}
                              {group.columns
                                .filter(c => !['name','email','phone'].some(r => c.toLowerCase().includes(r)))
                                .map(col => (
                                  <td key={col} className="px-4 py-3 text-on-surface-variant">
                                    {user.extra_data?.[col] || '—'}
                                  </td>
                                ))
                              }
                              <td className="px-4 py-3 text-center">
                                {user.is_eligible
                                  ? <CheckCircle2 size={16} className="text-green-400 mx-auto" />
                                  : <XCircle size={16} className="text-red-400 mx-auto" />
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Duplicate Verification Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-container rounded-2xl max-w-2xl w-full max-h-[80vh] flex flex-col border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-headline text-red-400 flex items-center gap-2">
                  <AlertCircle size={20} />
                  Review Duplicates
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Found {duplicateUsers.length} duplicated user(s) based on matching Email or Phone.
                </p>
              </div>
              <button 
                onClick={() => setShowDuplicateModal(false)}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-on-surface-variant"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-surface-container-low/50">
              <table className="w-full text-sm text-left">
                <thead className="bg-white/5 text-xs uppercase text-on-surface-variant">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {duplicateUsers.map(u => (
                    <tr key={u.id}>
                      <td className="px-4 py-3 font-medium text-on-surface">{u.name}</td>
                      <td className="px-4 py-3 text-red-300">{u.email || '—'}</td>
                      <td className="px-4 py-3 text-red-300">{u.phone || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-surface-container">
              <button
                onClick={() => setShowDuplicateModal(false)}
                className="px-5 py-2.5 rounded-xl font-medium text-sm text-on-surface hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveDuplicates}
                disabled={isRemovingDuplicates}
                className="px-5 py-2.5 rounded-xl font-medium text-sm bg-red-500 hover:bg-red-600 text-white transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isRemovingDuplicates ? <Loader2 size={16} className="animate-spin" /> : <UserMinus size={16} />}
                Remove {duplicateUsers.length} Duplicate{duplicateUsers.length !== 1 ? 's' : ''}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Field Mapping Verification Modal */}
      {mappingModalOpen && mappingFileData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-surface-container rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-white/10 shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-headline text-on-surface flex items-center gap-2">
                  <FileSpreadsheet size={20} className="text-primary" />
                  Verify Field Mapping
                </h3>
                <p className="text-sm text-on-surface-variant mt-1">
                  Match the columns from your new Excel file to the fields expected by this group.
                </p>
              </div>
              <button 
                onClick={closeMappingModal}
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-on-surface-variant"
              >
                <XCircle size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-6 bg-surface-container-low/50 space-y-4">
              {/* Render System Fields */}
              {[
                { key: '__name__', label: 'Name', icon: '👤' },
                { key: '__email__', label: 'Email', icon: '✉️' },
                { key: '__phone__', label: 'Phone', icon: '📱' }
              ].map(field => (
                <div key={field.key} className="flex items-center gap-4 p-4 rounded-xl border bg-white/5 border-white/5">
                  <div className="text-2xl flex-shrink-0">{field.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface">{field.label} Column</p>
                  </div>
                  <select
                    value={fieldMapping[field.key] || ''}
                    onChange={e => setFieldMapping(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="flex-shrink-0 w-48 bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                  >
                    <option value="">— Not mapped —</option>
                    {mappingFileData.headers.map(col => <option key={col} value={col}>{col}</option>)}
                  </select>
                </div>
              ))}

              {/* Render Template Columns */}
              {mappingFileData.originalExtraCols.length > 0 && (
                <div className="pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-headline text-secondary">Template Columns (used in certificate)</h4>
                    <span className="text-xs text-on-surface-variant">Map each → your new Excel column</span>
                  </div>
                  <div className="space-y-3">
                    {mappingFileData.originalExtraCols.map(colName => {
                      const isMapped = !!fieldMapping[colName];
                      const isAutoSystemField =
                        NAME_KEYS.some(k => formatKey(colName).includes(k)) ||
                        EMAIL_KEYS.some(k => formatKey(colName).includes(k)) ||
                        PHONE_KEYS.some(k => formatKey(colName).includes(k));
                      return (
                        <div key={colName} className={`flex items-center gap-4 p-4 rounded-xl border ${!isMapped ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-white/5 border-white/5'}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-on-surface">{colName}</p>
                              {isAutoSystemField && isMapped && (
                                <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">auto-mapped</span>
                              )}
                            </div>
                            {!isMapped && <p className="text-xs text-yellow-400 mt-1">⚠ Needs mapping — certificate will show placeholder</p>}
                          </div>
                          <select
                            value={fieldMapping[colName] || ''}
                            onChange={e => setFieldMapping(prev => ({ ...prev, [colName]: e.target.value }))}
                            className="flex-shrink-0 w-48 bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-primary text-on-surface"
                          >
                            <option value="">— Not mapped —</option>
                            {mappingFileData.headers.map(col => <option key={col} value={col}>{col}</option>)}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Preview Row */}
              {mappingFileData.allRows.length > 0 && (
                <div className="mt-4 p-4 bg-green-500/5 border border-green-500/20 rounded-xl text-xs space-y-1">
                  <p className="font-medium text-green-400 mb-2">✓ Preview (First Row)</p>
                  <p><span className="text-on-surface-variant">Name:</span> <span className="text-on-surface">{safeStr(mappingFileData.allRows[0][fieldMapping.__name__]) || '—'}</span></p>
                  <p><span className="text-on-surface-variant">Email:</span> <span className="text-on-surface">{safeStr(mappingFileData.allRows[0][fieldMapping.__email__]) || '—'}</span></p>
                  <p><span className="text-on-surface-variant">Phone:</span> <span className="text-on-surface">{safeStr(mappingFileData.allRows[0][fieldMapping.__phone__]) || '—'}</span></p>
                  {mappingFileData.originalExtraCols.map(col => (
                    <p key={col}><span className="text-on-surface-variant">{col}:</span> <span className="text-on-surface">{safeStr(mappingFileData.allRows[0][fieldMapping[col]]) || '—'}</span></p>
                  ))}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-white/5 flex justify-end gap-3 bg-surface-container">
              <button
                onClick={closeMappingModal}
                className="px-5 py-2.5 rounded-xl font-medium text-sm text-on-surface hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="px-5 py-2.5 rounded-xl font-medium text-sm bg-primary hover:bg-primary/90 text-on-primary transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {isImporting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Confirm & Import {mappingFileData.allRows.length} Users
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EligibleUsers;
