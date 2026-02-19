
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Person, Group, CloudConfig } from '../types.ts';

const LOCAL_PEOPLE_KEY = 'bloodline_donors_v2';
const LOCAL_GROUPS_KEY = 'bloodline_groups_v1';

export class DatabaseService {
  private supabase: SupabaseClient | null = null;
  private config: CloudConfig | null = null;

  constructor(config: CloudConfig | null) {
    if (config?.active && config.supabaseUrl && config.supabaseKey) {
      this.config = config;
      this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    }
  }

  async fetchPeople(): Promise<Person[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('people').select('*');
      if (error) throw error;
      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        phoneNumber: p.phone_number,
        bloodGroup: p.blood_group,
        lastDonationDate: p.last_donation_date ? Number(p.last_donation_date) : undefined,
        notes: p.notes,
        groupIds: p.group_ids || [],
        location: p.location
      }));
    }
    const local = localStorage.getItem(LOCAL_PEOPLE_KEY);
    return local ? JSON.parse(local) : [];
  }

  async fetchGroups(): Promise<Group[]> {
    if (this.supabase) {
      const { data, error } = await this.supabase.from('groups').select('*');
      if (error) throw error;
      return (data || []).map(g => ({
        id: g.id,
        name: g.name,
        color: g.color
      }));
    }
    const local = localStorage.getItem(LOCAL_GROUPS_KEY);
    return local ? JSON.parse(local) : [];
  }

  async savePerson(person: Person): Promise<void> {
    if (this.supabase) {
      const payload = {
        id: person.id,
        name: person.name,
        phone_number: person.phoneNumber,
        blood_group: person.bloodGroup,
        last_donation_date: person.lastDonationDate,
        notes: person.notes,
        group_ids: person.groupIds,
        location: person.location
      };
      const { error } = await this.supabase.from('people').upsert(payload);
      if (error) throw error;
    } else {
      const people = await this.fetchPeople();
      const exists = people.findIndex(p => p.id === person.id);
      if (exists > -1) people[exists] = person;
      else people.push(person);
      localStorage.setItem(LOCAL_PEOPLE_KEY, JSON.stringify(people));
    }
  }

  async deletePerson(id: string): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.from('people').delete().eq('id', id);
      if (error) throw error;
    } else {
      const people = await this.fetchPeople();
      localStorage.setItem(LOCAL_PEOPLE_KEY, JSON.stringify(people.filter(p => p.id !== id)));
    }
  }

  async saveGroup(group: Group): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.from('groups').upsert({
        id: group.id,
        name: group.name,
        color: group.color
      });
      if (error) throw error;
    } else {
      const groups = await this.fetchGroups();
      groups.push(group);
      localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));
    }
  }

  async deleteGroup(id: string): Promise<void> {
    if (this.supabase) {
      const { error } = await this.supabase.from('groups').delete().eq('id', id);
      if (error) throw error;
    } else {
      const groups = await this.fetchGroups();
      localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups.filter(g => g.id !== id)));
    }
  }

  async syncToCloud(people: Person[], groups: Group[]): Promise<void> {
    if (!this.supabase) return;
    for (const group of groups) await this.saveGroup(group);
    for (const person of people) await this.savePerson(person);
  }
}
