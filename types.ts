
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface Person {
  id: string;
  name: string;
  phoneNumber: string;
  bloodGroup: BloodGroup;
  lastDonated?: string;
  lastDonationDate?: number;
  location?: string;
  notes?: string;
}

export interface CloudConfig {
  supabaseUrl: string;
  supabaseKey: string;
  active: boolean;
}

export interface DonationCompatibility {
  canDonateTo: BloodGroup[];
  canReceiveFrom: BloodGroup[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
