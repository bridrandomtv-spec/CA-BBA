import { Router } from 'express';
import { logAdmin } from '../auditLog.js';
import { query } from '../db/index.js';
import { requireAdmin } from '../auth.js';

export const usersRouter = Router();

usersRouter.get('/', requireAdmin, async (_req,res) => {
  try {
    const result = await query('SELECT id,email,display_name,avatar_url,role,created_at FROM users ORDER BY created_at DESC');
    res.json({ users: result.rows.map((r:any)=>({uid:r.id,id:r.id,email:r.email,displayName:r.display_name,avatarUrl:r.avatar_url,role:r.role,createdAt:r.created_at})) });
  } catch(error) { console.error('[CABBA] users:',error); res.status(500).json({error:'Internal server error'}); }
});

usersRouter.patch('/:id/role', requireAdmin, async (req,res) => {
  const role=req.body?.role;
  if (!['user','admin','scanner'].includes(role)) { res.status(400).json({error:'Invalid role'}); return; }
  if (req.params.id===req.user!.id) { res.status(400).json({error:'Vous ne pouvez pas modifier votre propre rôle.'}); return; }
  try {
    const result=await query('UPDATE users SET role=$1,updated_at=NOW() WHERE id=$2 RETURNING id,role',[role,req.params.id]);
    if(!result.rows.length){res.status(404).json({error:'User not found'});return;}
void logAdmin(req.user,'user.role',String(req.params.id),role);
    res.json({success:true,user:{uid:result.rows[0].id,role:result.rows[0].role}});
  } catch(error){console.error('[CABBA] role:',error);res.status(500).json({error:'Internal server error'});}
});
