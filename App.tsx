
import React, { useState, useEffect, useMemo } from 'react';
import { Person, BloodGroup, Group } from './types';
import { BLOOD_GROUPS, BLOOD_GROUP_COLORS, COMPATIBILITY_MAP } from './constants';
import BloodStats from './components/BloodStats';
import Assistant from './components/Assistant';

const STORAGE_KEY = 'bloodline_donors_v2';
const GROUPS_STORAGE_KEY = 'bloodline_groups_v1';
const RECOVERY_DAYS = 56; // Standard 8 weeks for whole blood

type SortOption = 'name-asc' | 'name-desc' | 'blood-group' | 'status';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGroup, setFilterGroup] = useState<BloodGroup | 'All'>('All');
  const [filterGroupId, setFilterGroupId] = useState<string | 'All'>('All');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  
  // Person Form state
  const [formData, setFormData] = useState<Omit<Person, 'id'>>({
    name: '',
    phoneNumber: '',
    bloodGroup: 'O+',
    notes: '',
    groupIds: [],
    lastDonationDate: undefined
  });

  // Group Form state
  const [groupName, setGroupName] = useState('');

  // Load from local storage
  useEffect(() => {
    const savedPeople = localStorage.getItem(STORAGE_KEY);
    const savedGroups = localStorage.getItem(GROUPS_STORAGE_KEY);
    if (savedPeople) {
      try { setPeople(JSON.parse(savedPeople)); } catch (e) { console.error(e); }
    }
    if (savedGroups) {
      try { setGroups(JSON.parse(savedGroups)); } catch (e) { console.error(e); }
    }
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(people));
  }, [people]);

  useEffect(() => {
    localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups));
  }, [groups]);

  const isEligible = (person: Person) => {
    if (!person.lastDonationDate) return true;
    const daysSince = (Date.now() - person.lastDonationDate) / (1000 * 60 * 60 * 24);
    return daysSince >= RECOVERY_DAYS;
  };

  const getRecoveryInfo = (person: Person) => {
    if (!person.lastDonationDate) return null;
    const daysSince = (Date.now() - person.lastDonationDate) / (1000 * 60 * 60 * 24);
    if (daysSince < RECOVERY_DAYS) {
      return Math.ceil(RECOVERY_DAYS - daysSince);
    }
    return null;
  };

  const filteredAndSortedPeople = useMemo(() => {
    let result = people.filter(p => {
      const q = searchQuery.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(q) || 
                           p.phoneNumber.includes(q) || 
                           p.bloodGroup.toLowerCase().includes(q);
      const matchesBloodFilter = filterGroup === 'All' || p.bloodGroup === filterGroup;
      const matchesGroupFilter = filterGroupId === 'All' || (p.groupIds || []).includes(filterGroupId);
      return matchesSearch && matchesBloodFilter && matchesGroupFilter;
    });

    result.sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'blood-group') {
        return BLOOD_GROUPS.indexOf(a.bloodGroup) - BLOOD_GROUPS.indexOf(b.bloodGroup);
      }
      if (sortBy === 'status') {
        const aE = isEligible(a);
        const bE = isEligible(b);
        if (aE === bE) return a.name.localeCompare(b.name);
        return aE ? -1 : 1;
      }
      return 0;
    });

    return result;
  }, [people, searchQuery, filterGroup, filterGroupId, sortBy]);

  const handleOpenModal = (person?: Person) => {
    if (person) {
      setEditingPerson(person);
      setFormData({
        name: person.name,
        phoneNumber: person.phoneNumber,
        bloodGroup: person.bloodGroup,
        notes: person.notes || '',
        groupIds: person.groupIds || [],
        lastDonationDate: person.lastDonationDate
      });
    } else {
      setEditingPerson(null);
      setFormData({
        name: '',
        phoneNumber: '',
        bloodGroup: 'O+',
        notes: '',
        groupIds: [],
        lastDonationDate: undefined
      });
    }
    setIsModalOpen(true);
  };

  const handleSavePerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phoneNumber) return;

    if (editingPerson) {
      setPeople(people.map(p => p.id === editingPerson.id ? { ...formData, id: p.id } : p));
    } else {
      const newPerson: Person = { ...formData, id: crypto.randomUUID() };
      setPeople([...people, newPerson]);
    }
    setIsModalOpen(false);
  };

  const handleMarkDonated = (id: string) => {
    setPeople(people.map(p => 
      p.id === id ? { ...p, lastDonationDate: Date.now() } : p
    ));
  };

  const handleSaveGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    const newGroup: Group = {
      id: crypto.randomUUID(),
      name: groupName.trim(),
      color: GROUP_COLORS[groups.length % GROUP_COLORS.length]
    };
    setGroups([...groups, newGroup]);
    setGroupName('');
    setIsGroupModalOpen(false);
  };

  const deleteGroup = (id: string) => {
    if (confirm('Delete this group? Contacts will remain but will be removed from this group.')) {
      setGroups(groups.filter(g => g.id !== id));
      setPeople(people.map(p => ({
        ...p,
        groupIds: (p.groupIds || []).filter(gid => gid !== id)
      })));
    }
  };

  const toggleGroupSelection = (groupId: string) => {
    const current = formData.groupIds || [];
    if (current.includes(groupId)) {
      setFormData({ ...formData, groupIds: current.filter(id => id !== groupId) });
    } else {
      setFormData({ ...formData, groupIds: [...current, groupId] });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-red-600 p-1.5 rounded-lg shadow-inner">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900 tracking-tight hidden sm:block">BloodLine Connect</h1>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setIsGroupModalOpen(true)}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Groups
            </button>
            <button 
              onClick={() => handleOpenModal()}
              className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-xl font-semibold transition-all shadow-md shadow-red-100 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Donor
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-8">
            <BloodStats people={people} />
            
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
              <div className="flex flex-col space-y-4">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <h2 className="text-xl font-bold text-gray-800">Donor Directory</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative flex-1 min-w-[200px]">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </span>
                      <input 
                        type="text" 
                        placeholder="Search name, phone, or blood..." 
                        className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none w-full"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <select 
                      className="px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-red-500 focus:outline-none"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as SortOption)}
                    >
                      <option value="name-asc">Sort: Name (A-Z)</option>
                      <option value="name-desc">Sort: Name (Z-A)</option>
                      <option value="blood-group">Sort: Blood Group</option>
                      <option value="status">Sort: Eligibility</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 items-center text-sm border-t border-gray-50 pt-4">
                   <span className="text-gray-500 mr-2">Filters:</span>
                   <select 
                    className="px-3 py-1.5 border border-gray-100 rounded-lg bg-gray-50 focus:outline-none"
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value as BloodGroup | 'All')}
                  >
                    <option value="All">All Blood Groups</option>
                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                  <select 
                    className="px-3 py-1.5 border border-gray-100 rounded-lg bg-gray-50 focus:outline-none"
                    value={filterGroupId}
                    onChange={(e) => setFilterGroupId(e.target.value)}
                  >
                    <option value="All">All Groups</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedPeople.map(person => {
                  const recoveryDaysRemaining = getRecoveryInfo(person);
                  const isCurrentlyEligible = isEligible(person);
                  
                  return (
                    <div key={person.id} className={`group border border-gray-100 p-4 rounded-xl hover:shadow-md transition-all relative flex flex-col h-full bg-white ${!isCurrentlyEligible ? 'opacity-70 saturate-50 grayscale-[0.2]' : ''}`}>
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex gap-2 items-center">
                          <span className={`${BLOOD_GROUP_COLORS[person.bloodGroup]} text-white text-xs font-bold px-2 py-1 rounded-md`}>
                            {person.bloodGroup}
                          </span>
                          {!isCurrentlyEligible && (
                            <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-1 rounded-md animate-pulse">
                              RECOVERING
                            </span>
                          )}
                        </div>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleOpenModal(person)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </button>
                          <button onClick={() => { if(confirm('Delete?')) setPeople(people.filter(p=>p.id!==person.id)) }} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                      
                      <h3 className="font-bold text-gray-900 truncate text-base">{person.name}</h3>
                      <p className="text-gray-500 text-sm mb-2">{person.phoneNumber}</p>
                      
                      {person.groupIds && person.groupIds.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {person.groupIds.map(gid => {
                            const g = groups.find(group => group.id === gid);
                            return g ? (
                              <span key={gid} className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${g.color}`}>
                                {g.name}
                              </span>
                            ) : null;
                          })}
                        </div>
                      )}

                      {!isCurrentlyEligible && recoveryDaysRemaining && (
                        <div className="mt-2 mb-3 bg-orange-50 p-2 rounded-lg border border-orange-100">
                          <p className="text-[10px] text-orange-800 font-semibold flex items-center gap-1">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Available in {recoveryDaysRemaining} days
                          </p>
                        </div>
                      )}

                      <div className="mt-auto pt-3 flex flex-col gap-2">
                        {isCurrentlyEligible ? (
                          <button 
                            onClick={() => handleMarkDonated(person.id)}
                            className="w-full py-1.5 bg-red-50 text-red-600 border border-red-100 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-colors flex items-center justify-center gap-1"
                          >
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                            Mark Donated
                          </button>
                        ) : (
                          <div className="w-full py-1.5 bg-gray-50 text-gray-400 border border-gray-100 rounded-lg text-xs font-bold text-center italic">
                            In Recovery
                          </div>
                        )}
                        
                        <div className="border-t border-gray-50 pt-2">
                          <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Target Compatibility</p>
                          <div className="flex flex-wrap gap-1">
                            {COMPATIBILITY_MAP[person.bloodGroup].canDonateTo.slice(0, 4).map(target => (
                              <span key={target} className="text-[10px] bg-green-50 text-green-700 px-1 rounded">to {target}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="xl:col-span-1">
            <div className="sticky top-24 space-y-6">
              <Assistant people={people} />
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  System Tips
                </h3>
                <ul className="text-xs text-gray-600 space-y-3">
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span><strong>Recovery Period:</strong> Whole blood donation requires a 56-day (8-week) recovery before the next donation.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>Inactive donors are visually dimmed and the AI is aware they are unavailable for current needs.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Person Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 bg-red-600 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">{editingPerson ? 'Edit Donor' : 'Add New Donor'}</h2>
              <button onClick={() => setIsModalOpen(false)} className="text-white/80 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form onSubmit={handleSavePerson} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name</label>
                <input required type="text" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number</label>
                  <input required type="tel" className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" value={formData.phoneNumber} onChange={e => setFormData({...formData, phoneNumber: e.target.value})} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Blood Group</label>
                  <select className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none" value={formData.bloodGroup} onChange={e => setFormData({...formData, bloodGroup: e.target.value as BloodGroup})}>
                    {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Assign to Groups</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {groups.length === 0 ? (
                    <p className="text-xs text-gray-400 italic">No groups created yet. Use the "Groups" button in header to add some.</p>
                  ) : (
                    groups.map(g => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => toggleGroupSelection(g.id)}
                        className={`text-xs px-3 py-1 rounded-full border transition-all ${
                          formData.groupIds?.includes(g.id) 
                            ? `${g.color} border-transparent ring-2 ring-offset-1 ring-red-400` 
                            : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {g.name}
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Additional Notes</label>
                <textarea className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:outline-none h-20 resize-none" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 border border-gray-200 text-gray-600 font-bold rounded-xl hover:bg-gray-50">Cancel</button>
                <button type="submit" className="flex-1 px-4 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 shadow-lg shadow-red-100">Save Donor</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Groups Management Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-4">
            <div className="p-6 bg-gray-800 text-white flex justify-between items-center">
              <h2 className="text-xl font-bold">Manage Groups</h2>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-white/80 hover:text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-6 space-y-6">
              <form onSubmit={handleSaveGroup} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="New group name..." 
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-400"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                />
                <button type="submit" className="bg-gray-800 text-white px-4 py-2 rounded-xl hover:bg-gray-700">Add</button>
              </form>

              <div className="space-y-2">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Existing Groups</h3>
                {groups.length === 0 ? (
                  <p className="text-sm text-gray-500 italic py-4 text-center">No groups yet.</p>
                ) : (
                  <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                    {groups.map(g => (
                      <div key={g.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 group">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${g.color.split(' ')[0]}`}></div>
                          <span className="font-medium text-gray-700">{g.name}</span>
                        </div>
                        <button onClick={() => deleteGroup(g.id)} className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
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
