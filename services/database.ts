
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Person, CloudConfig } from '../types.ts';

const LOCAL_PEOPLE_KEY = 'bloodline_donors_v2';

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
        id: String(p.id),
        name: p.name,
        phoneNumber: p.phone_number,
        bloodGroup: p.blood_group,
        lastDonationDate: p.last_donation_date ? Number(p.last_donation_date) : undefined,
        notes: p.notes,
        location: p.location
      }));
    }
    const local = localStorage.getItem(LOCAL_PEOPLE_KEY);
    const parsed = local ? JSON.parse(local) : [];
    // Always normalize IDs to strings
    return parsed.map((p: any) => ({ ...p, id: String(p.id) }));
  }

  async savePerson(person: Person): Promise<void> {
    const donorId = String(person.id);
    if (this.supabase) {
      const payload = {
        id: donorId,
        name: person.name,
        phone_number: person.phoneNumber,
        blood_group: person.bloodGroup,
        last_donation_date: person.lastDonationDate,
        notes: person.notes,
        location: person.location
      };
      const { error } = await this.supabase.from('people').upsert(payload);
      if (error) throw error;
    } else {
      const people = await this.fetchPeople();
      const exists = people.findIndex(p => String(p.id) === donorId);
      if (exists > -1) people[exists] = { ...person, id: donorId };
      else people.push({ ...person, id: donorId });
      localStorage.setItem(LOCAL_PEOPLE_KEY, JSON.stringify(people));
    }
  }

  async deletePerson(id: string): Promise<void> {
    const donorId = String(id);
    if (this.supabase) {
      const { error } = await this.supabase.from('people').delete().eq('id', donorId);
      if (error) throw error;
    } else {
      const people = await this.fetchPeople();
      const filtered = people.filter(p => String(p.id) !== donorId);
      localStorage.setItem(LOCAL_PEOPLE_KEY, JSON.stringify(filtered));
    }
  }

  async syncToCloud(people: Person[]): Promise<void> {
    if (!this.supabase) return;
    for (const person of people) await this.savePerson(person);
  }
}
