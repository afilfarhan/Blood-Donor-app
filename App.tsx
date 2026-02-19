
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Person, BloodGroup, CloudConfig } from './types.ts';
import { BLOOD_GROUPS, BLOOD_GROUP_COLORS } from './constants.tsx';
import Assistant from './components/Assistant.tsx';
import { DatabaseService } from './services/database.ts';

const CLOUD_CONFIG_KEY = 'bloodline_cloud_config';
const RECOVERY_DAYS = 56;

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).substring(2, 15);
};

const App: React.FC = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>(() => {
    const saved = localStorage.getItem(CLOUD_CONFIG_KEY);
    return saved ? JSON.parse(saved) : { supabaseUrl: '', supabaseKey: '', active: false };
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<BloodGroup | 'All'>('All');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'blood-group' | 'status'>('name-asc');
  
  const db = useMemo(() => new DatabaseService(cloudConfig), [cloudConfig]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [formData, setFormData] = useState<Omit<Person, 'id'>>({
    name: '', phoneNumber: '', bloodGroup: 'O+', notes: ''
  });

  useEffect(() => {
    refreshData(true);
  }, [db]);

  const refreshData = async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const p = await db.fetchPeople();
      setPeople(p);
    } catch (e) {
      console.error("Fetch Error:", e);
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
      return matchesSearch && matchesBloodFilter;
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
  }, [people, searchQuery, filterGroup, sortBy]);

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phoneNumber) return;
    try {
      const personId = editingPerson ? String(editingPerson.id) : generateId();
      const person: Person = { ...formData, id: personId };
      await db.savePerson(person);
      await refreshData();
      setIsModalOpen(false);
    } catch (err) {
      alert("Save failed. Please check your connection.");
    }
  };

  const handleDeletePerson = async (id: string) => {
    const donorId = String(id);
    if (!window.confirm('Are you sure you want to permanently delete this donor record?')) return;

    try {
      // Perform database deletion
      await db.deletePerson(donorId);
      // Update local state directly to reflect changes immediately
      setPeople(prev => prev.filter(p => String(p.id) !== donorId));
    } catch (err) {
      console.error("Deletion error:", err);
      alert("Could not delete donor. Please try again.");
      // On error, re-sync with source of truth
      await refreshData();
    }
  };

  const handleMarkDonated = async (person: Person) => {
    try {
      const timestamp = Date.now();
      const updatedPerson = { ...person, lastDonationDate: timestamp };
      setPeople(prev => prev.map(p => String(p.id) === String(person.id) ? updatedPerson : p));
      await db.savePerson(updatedPerson);
    } catch (err) {
      await refreshData();
    }
  };

  const toggleCloud = (active: boolean) => {
    const newConfig = { ...cloudConfig, active };
    setCloudConfig(newConfig);
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(newConfig));
  };

  const exportData = () => {
    const data = { people, exportedAt: new Date().toISOString() };
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
        const imported = JSON.parse(e.target?.result as string);
        if (confirm('Import data? This will overwrite local data.')) {
          if (imported.people) localStorage.setItem('bloodline_donors_v2', JSON.stringify(imported.people));
          await refreshData(true);
        }
      } catch (err) { alert('Invalid file.'); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-red-600 p-1.5 rounded-lg">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-none">BloodLine</h1>
              <div className="flex items-center gap-1 mt-1">
                <div className={`w-2 h-2 rounded-full ${cloudConfig.active ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                <span className="text-[10px] font-bold uppercase text-gray-400">{cloudConfig.active ? 'Cloud' : 'Local'}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button onClick={() => setIsCloudModalOpen(true)} className="p-2.5 bg-gray-50 rounded-xl text-gray-400 hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
            </button>
            <button onClick={() => { setEditingPerson(null); setFormData({name: '', phoneNumber: '', bloodGroup: 'O+', notes: ''}); setIsModalOpen(true); }} className="bg-red-600 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              <span>Add Donor</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-red-200 border-t-red-600 rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-6">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-gray-800">Donor Directory</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <input type="text" placeholder="Search donors..." className="px-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 w-full md:w-48" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                    <select className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white" value={filterGroup} onChange={(e) => setFilterGroup(e.target.value as any)}>
                      <option value="All">All Types</option>
                      {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                </div>

                {filteredAndSortedPeople.length === 0 ? (
                  <div className="text-center py-12 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400">
                    No donors found.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredAndSortedPeople.map(person => {
                      const rec = getRecoveryInfo(person);
                      const elig = isEligible(person);
                      return (
                        <div key={person.id} className={`group border border-gray-100 p-5 rounded-2xl hover:shadow-md transition-all flex flex-col h-full bg-white ${!elig ? 'bg-gray-50 opacity-80' : ''}`}>
                          <div className="flex justify-between items-start mb-3">
                            <span className={`${BLOOD_GROUP_COLORS[person.bloodGroup]} text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm`}>{person.bloodGroup}</span>
                            <div className="flex gap-1.5 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => { setEditingPerson(person); setFormData({name: person.name, phoneNumber: person.phoneNumber, bloodGroup: person.bloodGroup, notes: person.notes || ''}); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg" title="Edit">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                              </button>
                              <button onClick={() => handleDeletePerson(person.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg" title="Delete">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                              </button>
                            </div>
                          </div>
                          <h3 className="font-bold text-gray-900 truncate mb-1">{person.name}</h3>
                          <p className="text-gray-500 text-xs mb-4">{person.phoneNumber}</p>
                          {elig ? (
                            <button onClick={() => handleMarkDonated(person)} className="mt-auto w-full py-2.5 bg-red-50 text-red-600 text-[10px] font-bold rounded-xl hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-1.5 border border-red-100">
                              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20"><path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" /></svg>
                              Donated Today
                            </button>
                          ) : (
                            <div className="mt-auto w-full py-2.5 bg-gray-100 text-gray-500 text-[10px] font-bold rounded-xl text-center border border-gray-200">
                              Recovery: {rec}d left
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
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="text-sm font-bold text-gray-800">Backup Tools</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={exportData} className="flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                    Export JSON
                  </button>
                  <button onClick={() => fileInputRef.current?.click()} className="flex items-center justify-center gap-2 py-3 bg-gray-50 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-100 transition-colors">
                    Import JSON
                  </button>
                  <input type="file" ref={fileInputRef} onChange={importData} accept=".json" className="hidden" />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Cloud Modal */}
      {isCloudModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 bg-blue-600 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">Cloud Settings</h2>
              <button onClick={() => setIsCloudModalOpen(false)} className="text-white hover:bg-white/20 p-1 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <input type="text" className="w-full px-4 py-2 border rounded-xl text-sm" value={cloudConfig.supabaseUrl} onChange={e => setCloudConfig({...cloudConfig, supabaseUrl: e.target.value})} placeholder="Supabase URL" />
              <input type="password" name="api-key-supabase" className="w-full px-4 py-2 border rounded-xl text-sm" value={cloudConfig.supabaseKey} onChange={e => setCloudConfig({...cloudConfig, supabaseKey: e.target.value})} placeholder="Anon Key" />
              <button onClick={() => toggleCloud(!cloudConfig.active)} className={`w-full py-3 rounded-xl font-bold transition-all ${cloudConfig.active ? 'bg-red-50 text-red-600' : 'bg-blue-600 text-white'}`}>
                {cloudConfig.active ? 'Stop Syncing' : 'Enable Cloud Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Person Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in duration-200">
            <div className="p-6 bg-red-600 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingPerson ? 'Edit Donor' : 'Add Donor'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white hover:bg-white/20 p-1 rounded-lg">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSavePerson} className="p-6 space-y-4">
              <input required type="text" placeholder="Full Name" className="w-full px-4 py-3 border rounded-xl" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              <div className="grid grid-cols-2 gap-4">
                <input required type="tel" placeholder="Phone" className="w-full px-4 py-3 border rounded-xl" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
                <select className="w-full px-4 py-3 border rounded-xl" value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value as any})}>
                  {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <textarea placeholder="Notes (optional)" className="w-full px-4 py-3 border rounded-xl h-24" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              <button type="submit" className="w-full py-4 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-md">
                {editingPerson ? 'Update Donor' : 'Register Donor'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
