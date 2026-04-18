import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Trash2, AlertTriangle, RefreshCcw, CheckSquare, Square, Zap } from 'lucide-react';

function FlushData() {
  const [groups, setGroups] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isFlushing, setIsFlushing] = useState(false);
  const [flushStatus, setFlushStatus] = useState(null); // 'success' | 'error'

  // Hard reset state
  const [showHardReset, setShowHardReset] = useState(false);
  const [isHardResetting, setIsHardResetting] = useState(false);
  const [hardResetStatus, setHardResetStatus] = useState(null);

  const fetchGroups = async () => {
    setIsLoading(true);
    setFlushStatus(null);
    const { data, error } = await supabase
      .from('groups')
      .select('id, name, created_at')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Also fetch user count per group
      const withCounts = await Promise.all(data.map(async (group) => {
        const { count } = await supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id);
        return { ...group, userCount: count || 0 };
      }));
      setGroups(withCounts);
    }
    setIsLoading(false);
  };

  useEffect(() => { fetchGroups(); }, []);

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === groups.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(groups.map(g => g.id));
    }
  };

  const handleFlush = async () => {
    setIsFlushing(true);
    setFlushStatus(null);
    try {
      // Deleting the group cascades to users and templates (ON DELETE CASCADE in schema)
      const { error } = await supabase
        .from('groups')
        .delete()
        .in('id', selectedIds);

      if (error) throw error;

      setFlushStatus('success');
      setSelectedIds([]);
      setShowConfirm(false);
      await fetchGroups(); // Refresh list
    } catch (err) {
      console.error('Flush error:', err);
      setFlushStatus('error');
    } finally {
      setIsFlushing(false);
    }
  };

  const totalUsersToDelete = groups
    .filter(g => selectedIds.includes(g.id))
    .reduce((sum, g) => sum + g.userCount, 0);

  const handleHardReset = async () => {
    setIsHardResetting(true);
    setHardResetStatus(null);
    try {
      // Delete all groups — CASCADE takes care of users and templates
      const { error: groupsError } = await supabase
        .from('groups')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // .neq trick to delete all rows

      if (groupsError) throw groupsError;

      // Also delete any orphan users/templates not linked to a group
      await supabase.from('users').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('templates').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      setHardResetStatus('success');
      setShowHardReset(false);
      setSelectedIds([]);
      await fetchGroups();
    } catch (err) {
      console.error('Hard reset error:', err);
      setHardResetStatus('error');
    } finally {
      setIsHardResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-headline mb-1">Data Management</h2>
          <p className="text-on-surface-variant text-sm">Permanently delete groups and all their associated users and templates.</p>
        </div>
        <button onClick={fetchGroups} className="p-2 rounded-lg hover:bg-white/10 transition-colors" title="Refresh">
          <RefreshCcw size={18} className="text-on-surface-variant" />
        </button>
      </div>

      {flushStatus === 'success' && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-xl text-green-400 text-sm">
          ✓ Selected groups and all their data have been permanently deleted.
        </div>
      )}
      {flushStatus === 'error' && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
          ✗ Failed to delete groups. Check the console for details.
        </div>
      )}

      <div className="bg-surface-container-low rounded-2xl border border-white/5 overflow-hidden">
        {/* Header row */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-white/5 bg-white/5">
          <button onClick={toggleAll} className="text-on-surface-variant hover:text-primary transition-colors">
            {selectedIds.length === groups.length && groups.length > 0
              ? <CheckSquare size={18} className="text-primary" />
              : <Square size={18} />
            }
          </button>
          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium flex-1">Group Name</span>
          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium w-20 text-right">Users</span>
          <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium w-28 text-right hidden sm:block">Created</span>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-on-surface-variant animate-pulse">Loading groups...</div>
        ) : groups.length === 0 ? (
          <div className="p-8 text-center text-on-surface-variant">No groups found. Upload an Excel file to create a group.</div>
        ) : (
          <div className="divide-y divide-white/5">
            {groups.map(group => (
              <div
                key={group.id}
                onClick={() => toggleSelect(group.id)}
                className={`flex items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${selectedIds.includes(group.id) ? 'bg-red-500/10' : 'hover:bg-white/5'}`}
              >
                <div className="text-on-surface-variant">
                  {selectedIds.includes(group.id)
                    ? <CheckSquare size={18} className="text-red-400" />
                    : <Square size={18} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-on-surface truncate">{group.name}</p>
                  <p className="text-xs text-on-surface-variant">ID: {group.id.slice(0, 8)}...</p>
                </div>
                <span className="w-20 text-right text-sm text-on-surface-variant">{group.userCount} users</span>
                <span className="w-28 text-right text-xs text-on-surface-variant hidden sm:block">
                  {new Date(group.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/30 rounded-xl">
          <div>
            <p className="text-red-400 font-medium text-sm">{selectedIds.length} group(s) selected</p>
            <p className="text-red-400/70 text-xs">{totalUsersToDelete} users will be deleted permanently.</p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="flex items-center gap-2 px-5 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-colors"
          >
            <Trash2 size={16} />
            Flush Selected
          </button>
        </div>
      )}

      {/* Confirmation Modal — Flush Selected */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container rounded-2xl border border-white/10 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} />
              <h3 className="font-headline text-lg">Confirm Permanent Deletion</h3>
            </div>
            <p className="text-on-surface-variant text-sm">
              You are about to permanently delete <strong className="text-on-surface">{selectedIds.length} group(s)</strong> and all <strong className="text-on-surface">{totalUsersToDelete} users</strong> within them, along with their certificate templates.
            </p>
            <p className="text-red-400 text-xs font-medium uppercase tracking-wider">This action cannot be undone.</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isFlushing}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-on-surface-variant hover:bg-white/5 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleFlush}
                disabled={isFlushing}
                className="flex-1 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-medium text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Trash2 size={14} />
                {isFlushing ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Hard Reset Section ── */}
      <div className="mt-10 pt-8 border-t border-red-500/20">
        <div className="flex items-start justify-between gap-6 p-5 bg-red-500/5 border border-red-500/20 rounded-2xl">
          <div className="flex items-start gap-3">
            <Zap size={20} className="text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-headline text-base text-red-400 mb-1">Hard Reset</h3>
              <p className="text-on-surface-variant text-xs leading-relaxed">
                Wipes <strong className="text-on-surface">all groups, all users, and all templates</strong> from the database. Use this to start completely fresh.
              </p>
              {hardResetStatus === 'success' && (
                <p className="text-green-400 text-xs mt-2">✓ Database cleared successfully.</p>
              )}
              {hardResetStatus === 'error' && (
                <p className="text-red-400 text-xs mt-2">✗ Hard reset failed. Check the console.</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowHardReset(true)}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500 border border-red-500/40 hover:border-red-500 text-red-400 hover:text-white rounded-lg font-medium text-sm transition-all"
          >
            <Zap size={14} />
            Hard Reset
          </button>
        </div>
      </div>

      {/* Hard Reset Confirmation Modal */}
      {showHardReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-container rounded-2xl border border-red-500/30 p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <Zap size={24} />
              <h3 className="font-headline text-lg">Hard Reset — Wipe Everything</h3>
            </div>
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm space-y-1">
              <p>· All <strong>groups</strong> will be deleted</p>
              <p>· All <strong>users</strong> will be deleted</p>
              <p>· All <strong>templates</strong> will be deleted</p>
            </div>
            <p className="text-red-400 text-xs font-bold uppercase tracking-widest text-center">⚠ This cannot be undone. Ever.</p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowHardReset(false)}
                disabled={isHardResetting}
                className="flex-1 py-2.5 rounded-lg border border-white/10 text-on-surface-variant hover:bg-white/5 transition-colors text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleHardReset}
                disabled={isHardResetting}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-sm transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <Zap size={14} />
                {isHardResetting ? 'Resetting...' : 'Wipe Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FlushData;
