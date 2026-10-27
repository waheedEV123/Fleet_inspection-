export type Profile = {
  id: string;
  name: string;
  email: string;
  region: string | null;
  role: 'inspector' | 'admin';
  active: boolean;
};

export type Vehicle = {
  fleet_no: string;
  plate: string;
  emirate: string;
  model: string;
  powertrain: 'Fuel' | 'EV';
};

export type Status = 'ok' | 'issue' | 'na';

export type Photo = { path: string; area: string; note: string; w: number; h: number; kind?: 'diagram' };

export type Inspection = {
  id: string;
  ref: string;
  fleet_no: string;
  plate: string;
  emirate: string | null;
  model: string | null;
  powertrain: 'Fuel' | 'EV';
  returned_by: string;
  staff_id: string | null;
  odometer: number | null;
  energy: string | null;
  inspector_name: string | null;
  inspector_email: string | null;
  region: string | null;
  inspected_at: string;
  checks: Record<string, Status>;
  notes: Record<string, string>;
  damage: boolean;
  photos: Photo[];
  remarks: string | null;
  created_at: string;
};
