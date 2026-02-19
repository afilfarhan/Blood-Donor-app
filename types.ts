
export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export interface Group {
  id: string;
  name: string;
  color: string;
}

export interface Person {
  id: string;
  name: string;
  phoneNumber: string;
  bloodGroup: BloodGroup;
  lastDonated?: string;
  lastDonationDate?: number; // Timestamp of last donation
  location?: string;
  notes?: string;
  groupIds?: string[];
}

export interface DonationCompatibility {
  canDonateTo: BloodGroup[];
  canReceiveFrom: BloodGroup[];
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
