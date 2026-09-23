import supabase from './db-client.js';
import { sendCors, requireAuth } from './auth-helper.js';

export default async function handler(req, res) {
  if (sendCors(req, res)) return;
  try {
    const auth = await requireAuth(req, res);
    if (!auth) return;
    const { staff: me } = auth;
    if (req.method === 'GET') {
      let q = supabase.from('clinic_staff').select('*').order('full_name', { ascending: true });
      if (req.query.role) q = q.ilike('role', req.query.role);
      if (req.query.status) q = q.ilike('status', req.query.status);
      const { data, error } = await q;
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (me.role !== 'admin') return res.status(403).json({ error: 'Forbidden: only admins can manage staff.' });
    if (req.method === 'POST') {
      const { full_name, email, role, phone, specialty, status } = req.body || {};
      if (!full_name || !email || !role) return res.status(400).json({ error: 'full_name, email and role are required.' });
      if (!['admin', 'dentist', 'receptionist', 'accountant'].includes(role)) return res.status(400).json({ error: 'Invalid role.' });
      const { data, error } = await supabase.from('clinic_staff').insert({ full_name, email: String(email).toLowerCase(), role, phone: phone || null, specialty: specialty || null, status: status || 'active' }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
    if (req.method === 'PUT') {
      const { id, ...patch } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required.' });
      delete patch.user_id;
      const { data, error } = await supabase.from('clinic_staff').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    if (req.method === 'DELETE') {
      const id = req.body?.id || req.query.id;
      if (!id) return res.status(400).json({ error: 'id is required.' });
      if (Number(id) === me.id) return res.status(400).json({ error: 'You cannot deactivate your own account.' });
      const { data, error } = await supabase.from('clinic_staff').update({ status: 'inactive' }).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('API /api/staff error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Internal server error' });
  }
}
