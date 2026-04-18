import { useState } from 'react';
import { Upload, LayoutTemplate, Users, Settings } from 'lucide-react';
import ExcelAnalyzer from '../components/ExcelAnalyzer';
import TemplateBuilder from '../components/TemplateBuilder';
import FlushData from '../components/FlushData';
import EligibleUsers from '../components/EligibleUsers';

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('templates');
  // When an Excel group is created, we pass its ID to the TemplateBuilder for auto-selection
  const [preSelectedGroupId, setPreSelectedGroupId] = useState(null);

  const handleGroupCreated = (groupId) => {
    setPreSelectedGroupId(groupId);
    setActiveTab('templates'); // Switch to Template Engine automatically
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body flex">
      {/* Sidebar */}
      <aside className="w-64 bg-surface-container-low border-r border-white/5 p-4 flex flex-col">
        <h2 className="text-2xl font-headline tracking-tighter text-[#e9c349] mb-8 px-2">Admin Panel</h2>
        
        <nav className="flex-1 space-y-2">
          <button 
            onClick={() => setActiveTab('templates')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'templates' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-white/5'}`}
          >
            <LayoutTemplate size={20} />
            <span>Templates</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'users' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-white/5'}`}
          >
            <Users size={20} />
            <span>Eligible Users</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('upload')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'upload' ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-white/5'}`}
          >
            <Upload size={20} />
            <span>Excel Upload</span>
          </button>
        </nav>
        
        <div className="mt-auto pt-4 border-t border-white/5">
          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeTab === 'settings' ? 'bg-red-500/20 text-red-400' : 'text-on-surface-variant hover:bg-white/5'}`}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-auto">
        {activeTab === 'templates' && (
          <div>
            <h1 className="text-3xl font-headline mb-6">Template Engine</h1>
            <TemplateBuilder
              preSelectedGroupId={preSelectedGroupId}
              onGroupConsumed={() => setPreSelectedGroupId(null)}
            />
          </div>
        )}

        {activeTab === 'users' && (
          <div>
            <h1 className="text-3xl font-headline mb-6">Eligible Users</h1>
            <EligibleUsers />
          </div>
        )}

        {activeTab === 'upload' && (
          <div>
            <h1 className="text-3xl font-headline mb-6">Upload Excel Sheet</h1>
            <ExcelAnalyzer onGroupCreated={handleGroupCreated} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div>
            <h1 className="text-3xl font-headline mb-6">Settings</h1>
            <FlushData />
          </div>
        )}
      </main>
    </div>
  );
}

export default AdminDashboard;
