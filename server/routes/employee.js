import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import Document from '../models/Document.js';
import ActivityLog from '../models/ActivityLog.js';
const router=Router();
router.use(requireAuth,requireRole('employee'));
router.get('/dashboard',async(req,res,next)=>{
 try{
  const base={organizationId:req.user.organizationId,ownerId:req.user._id};
  const [total,recent,activity,inReview,approved,changesRequested]=await Promise.all([
   Document.countDocuments(base),
   Document.find(base).sort({updatedAt:-1}).limit(5),
   ActivityLog.find({organizationId:req.user.organizationId,actorId:req.user._id}).sort({createdAt:-1}).limit(8),
   Document.countDocuments({...base,status:'In Review'}),
   Document.countDocuments({...base,status:'Approved'}),
   Document.countDocuments({...base,status:'Changes Requested'})
  ]);
  res.json({total,inReview,approved,changesRequested,recent,activity});
 }catch(e){next(e);}
});
export default router;
