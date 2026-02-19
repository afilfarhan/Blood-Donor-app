
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Person, BloodGroup, Group, CloudConfig } from './types.ts';
import { BLOOD_GROUPS, BLOOD_GROUP_COLORS } from './constants.tsx';
import BloodStats from './components/BloodStats.tsx';
import Assistant from './components/Assistant.tsx';
import { DatabaseService } from './services/database.ts';

const CLOUD_CONFIG_KEY = 'bloodline_cloud_config';
const RECOVERY_DAYS = 56;

const GROUP_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-green-100 text-green-700',
  'bg-purple-100 text-purple-700',
  'bg-amber-100 text-amber-700',
  'bg-pink-100 text-pink-700',
  'bg-indigo-100 text-indigo-700'
];

const App: React.FC = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    return saved ? JSON.parse(saved) : { supabaseUrl: '', supabaseKey: '', active: false };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<BloodGroup | 'All'>('All');
  const [filterGroupId, setFilterGroupId] = useState<string | 'All'>('All');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'blood-group' | 'status'>('name-asc');
  
  const db = useMemo(() => new DatabaseService(cloudConfig), [cloudConfig]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<Omit<Person, 'id'>>({
    name: '', phoneNumber: '', bloodGroup: 'O+', notes: '', groupIds: [], lastDonationDate: undefined
  });
  const [groupName, setGroupName] = useState('');

  useEffect(() => {
    refreshData(true);
  }, [db]);

  const refreshData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const [p, g] = await Promise.all([db.fetchPeople(), db.fetchGroups()]);
      setPeople(p);
      setGroups(g);
    } catch (e) {
      console.error("Fetch Error:", e);
      if (cloudConfig.active && showLoading) alert("Cloud connection failed. Verify your Supabase credentials.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  const isEligible = (person: Person) => {
    if (!person.lastDonationDate) return true;
    const diff = Date.now() - person.lastDonationDate;
    const daysSince = diff / (1000 * 60 * 60 * 24);
    return daysSince >= RECOVERY_DAYS;
  };

  const getRecoveryInfo = (person: Person) => {
    if (!person.lastDonationDate) return null;
    const diff = Date.now() - person.lastDonationDate;
    const daysSince = diff / (1000 * 60 * 60 * 24);
    return daysSince < RECOVERY_DAYS ? Math.ceil(RECOVERY_DAYS - daysSince) : null;
  };

  const filteredAndSortedPeople = useMemo(() => {
    let result = people.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(q) || p.phoneNumber.includes(q) || p.bloodGroup.toLowerCase().includes(q);
      const matchesBloodFilter = filterGroup === 'All' || p.bloodGroup === filterGroup;
      const matchesGroupFilter = filterGroupId === 'All' || (p.groupIds || []).includes(filterGroupId);
      return matchesSearch && matchesBloodFilter && matchesGroupFilter;
    });

    result.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'blood-group') return BLOOD_GROUPS.indexOf(a.bloodGroup) - BLOOD_GROUPS.indexOf(b.bloodGroup);
      if (sortBy === 'status') {
        const aE = isEligible(a); const bE = isEligible(b);
        return aE === bE ? a.name.localeCompare(b.name) : (aE ? -1 : 1);
      }
      return 0;
    });
    return result;
  }, [people, searchQuery, filterGroup, filterGroupId, sortBy]);

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phoneNumber) return;
    try {
      const person: Person = editingPerson ? { ...formData, id: editingPerson.id } : { ...formData, id: crypto.randomUUID() };
      await db.savePerson(person);
      await refreshData();
      setIsModalOpen(false);
    } catch (err) {
      alert("Save failed. Check network or database permissions.");
    }
  };

  const handleDeletePerson = async (id: string) => {
    if (window.confirm('Permanently delete this donor record?')) {
      const originalPeople = [...people];
      // Optimistic state update
      setPeople(prev => prev.filter(p => p.id !== id));
      
      try {
        await db.deletePerson(id);
        // Silently refresh in background to sync with source of truth
        await refreshData(false);
      } catch (err) {
        console.error("Deletion failed:", err);
        setPeople(originalPeople);
        alert("Failed to delete from database. Please try again.");
      }
    }
  };

  const handleMarkDonated = async (person: Person) => {
    try {
      const timestamp = Date.now();
      const updatedPerson = { ...person, lastDonationDate: timestamp };
      
      // Update UI immediately
      setPeople(prev => prev.map(p => p.id === person.id ? updatedPerson : p));
      
      // Persist to DB
      await db.savePerson(updatedPerson);
      
      console.log(`Donor ${person.name} marked as donated at ${timestamp}`);
    } catch (err) {
      console.error("Mark Donated Error:", err);
      alert("Failed to update status in the database.");
      await refreshData(); // Revert on failure
    }
  };

  const handleSaveGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    try {
      const newGroup: Group = { id: crypto.randomUUID(), name: groupName.trim(), color: GROUP_COLORS[groups.length % GROUP_COLORS.length] };
      await db.saveGroup(newGroup);
      await refreshData();
      setGroupName('');
      setIsGroupModalOpen(false);
    } catch (err) {
      alert("Error saving group.");
    }
  };

  const handleDeleteGroup = async (id: string) => {
    if (confirm('Delete group?')) {
      try {
        await db.deleteGroup(id);
        await refreshData();
      } catch (err) {
        alert("Error deleting group.");
      }
    }
  };

  const toggleCloud = (active: boolean) => {
    const newConfig = { ...cloudConfig, active };
    setCloudConfig(newConfig);
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(newConfig));
  };

  const exportData = () => {
    const data = { people, groups, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `bloodline_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const content = e.target?.result as string;
        const imported = JSON.parse(content);
        if (confirm('Import data? This will append to your current local storage.')) {
          if (imported.people) localStorage.setItem('bloodline_donors_v2', JSON.stringify(imported.people));
          if (imported.groups) localStorage.setItem('bloodline_groups_v1', JSON.stringify(imported.groups));
          await refreshData(true);
          alert('Imported!');
        }
      } catch (err) { alert('Invalid file.'); }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleSyncLocalToCloud = async () => {
    if (!confirm("Upload local data to your cloud database?")) return;
    setLoading(true);
    try {
      const localPeople = JSON.parse(localStorage.getItem('bloodline_donors_v2') || '[]');
      const localGroups = JSON.parse(localStorage.getItem('bloodline_groups_v1') || '[]');
      await db.syncToCloud(localPeople, localGroups);
      alert("Synchronization successful!");
      await refreshData(true);
    } catch (e) {
      alert("Synchronization failed. Check credentials and network.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-1.5 rounded-lg shadow-inner">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">BloodLine</h1>
              <div className="flex items-center gap-1 mt-1">
                <div className={`w-2 h-2 rounded-full ${cloudConfig.active ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{cloudConfig.active ? 'Cloud Active' : 'Offline Mode'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setIsCloudModalOpen(true)}
              className={`p-2 rounded-xl transition-all ${cloudConfig.active ? 'bg-blue-50 text-blue-600' : 'bg-gray-50 text-gray-400 hover:text-blue-500'}`}
              title="Cloud Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            </button>
            <button onClick={() => setIsGroupModalOpen(true)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              <span className="hidden sm:inline">Groups</span>
            </button>
            <button onClick={() => { setEditingPerson(null); setFormData({name: '', phoneNumber: '', bloodGroup: 'O+', notes: '', groupIds: [], lastDonationDate: undefined}); setIsModalOpen(true); }} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-md shadow-red-100 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>Add Donor</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium">Loading Donor Data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <BloodStats people={people} />
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-gray-800">Donor Directory</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" placeholder="Filter by name or phone..." className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 w-full md:w-64" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    
                    <select 
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white"
                      value={filterGroup}
                      onChange={(e) => setFilterGroup(e.target.value as any)}
                    >
                      <option value="All">All Blood Types</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>

                    <select className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white" value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
                      <option value="name-asc">Sort A-Z</option>
                      <option value="blood-group">Sort by Group</option>
                      <option value="status">Sort by Status</option>
                    </select>
                  </div>
                </div>

                {filteredAndSortedPeople.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl">
                    <p className="text-gray-400">No donors found. Add your first donor to get started!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAndSortedPeople.map(person => {
                      const rec = getRecoveryInfo(person);
                      const elig = isEligible(person);
                      return (
                        <div key={person.id} className={`group border border-gray-100 p-4 rounded-xl hover:shadow-md transition-all flex flex-col h-full bg-white ${!elig ? 'bg-gray-50 opacity-80' : ''}`}>
                          <div className="flex justify-between items-start mb-2">
                            <span className={`${BLOOD_GROUP_COLORS[person.bloodGroup]} text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm`}>{person.bloodGroup}</span>
                            <div className="flex gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingPerson(person); setFormData({...person, notes: person.notes || ''}); setIsModalOpen(true); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></button>
                              <button onClick={() => handleDeletePerson(person.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                            </div>
                          </div>
                          <h3 className="font-bold text-gray-900 truncate">{person.name}</h3>
                          <p className="text-gray-500 text-xs mb-3">{person.phoneNumber}</p>
                          
                          {elig ? (
                            <button 
                              onClick={() => handleMarkDonated(person)} 
                              className="mt-auto w-full py-2 bg-red-50 text-red-600 text-xs font-bold rounded-lg hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-1 border border-red-100"
                            >
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" /></svg>
                              Mark Donated
                            </button>
                          ) : (
                            <div className="mt-auto w-full py-2 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-lg text-center italic border border-gray-200">
                              Recovery: {rec} days left
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="xl:col-span-1 space-y-6">
              <Assistant people={people} />
              
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-sm font-bold text-gray-800">Local Tools</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportData} className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export JSON
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 py-2.5 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    Import JSON
                  </button>
                  <input type="file" ref={fileInputRef} onChange={importData} accept=".json" className="hidden" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cloud Config Modal */}
      {isCloudModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                Cloud Database
              </h2>
              <button onClick={() => setIsCloudModalOpen(false)} className="text-white/80 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Supabase Project URL</label>
                  <input type="text" className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" value={cloudConfig.supabaseUrl} onChange={e => setCloudConfig({...cloudConfig, supabaseUrl: e.target.value})} placeholder="https://xyz.supabase.co" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Public Anon Key</label>
                  <input type="password" name="api-key-supabase" className="w-full px-4 py-2 border rounded-xl focus:ring-2 focus:ring-blue-500 text-sm" value={cloudConfig.supabaseKey} onChange={e => setCloudConfig({...cloudConfig, supabaseKey: e.target.value})} placeholder="eyJh..." />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <button 
                  onClick={() => toggleCloud(!cloudConfig.active)}
                  className={`w-full py-3 rounded-xl font-bold transition-all shadow-md ${cloudConfig.active ? 'bg-red-50 text-red-600 hover:bg-red-600 hover:text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {cloudConfig.active ? 'Disable Sync' : 'Enable Sync'}
                </button>
                
                {cloudConfig.active && (
                  <button onClick={handleSyncLocalToCloud} className="w-full py-3 bg-gray-50 text-gray-600 text-sm font-bold rounded-xl hover:bg-gray-100 flex items-center justify-center gap-2 border border-gray-100">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    Sync Local to Cloud
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Person Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 bg-red-600 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingPerson ? 'Update Record' : 'Register Donor'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <form onSubmit={handleSavePerson} className="p-6 space-y-4">
              <input required type="text" placeholder="Donor Name" className="w-full px-4 py-2 border rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input required type="tel" placeholder="Phone Number" className="w-full px-4 py-2 border rounded-xl" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
                <select className="w-full px-4 py-2 border rounded-xl" value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value as any})}>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <textarea placeholder="Notes (allergies, location, etc.)" className="w-full px-4 py-2 border rounded-xl h-24" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              <button type="submit" className="w-full py-3 bg-red-600 text-white font-bold rounded-xl shadow-lg hover:bg-red-700 transition-colors">
                {editingPerson ? 'Update Donor' : 'Add Donor'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in">
            <div className="p-6 bg-gray-800 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">Groups</h2>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-white/80 hover:text-white"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            <div className="p-6 space-y-6">
              <form onSubmit={handleSaveGroup} className="flex gap-2">
                <input type="text" placeholder="Create new group..." className="flex-1 px-4 py-2 border rounded-xl" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
                <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-xl hover:bg-gray-700 transition-colors">Create</button>
              </form>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {groups.length === 0 ? (
                  <p className="text-center text-gray-400 py-8 italic text-sm">Organize donors into groups (e.g., Staff, VIPs).</p>
                ) : (
                  groups.map(g => (
                    <div key={g.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl group">
                      <span className="font-medium text-gray-700">{g.name}</span>
                      <button onClick={() => handleDeleteGroup(g.id)} className="text-gray-300 hover:text-red-600 transition-colors"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
