import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { RefreshCcw, ChevronDown, ChevronRight, Users, CheckCircle2, XCircle, Search } from 'lucide-react';

function EligibleUsers() {
  const [groups, setGroups] = useState([]); // [{ ...group, users: [] }]
  const [isLoading, setIsLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

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
                <button
                  onClick={() => toggleGroup(group.id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors text-left"
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
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">
                      {filteredUsers.length} {searchQuery ? 'match' : 'user'}{filteredUsers.length !== 1 ? 's' : ''}
                    </span>
                    {group.created_at && (
                      <span className="text-xs text-on-surface-variant hidden sm:block">
                        {new Date(group.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </button>

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
    </div>
  );
}

export default EligibleUsers;
