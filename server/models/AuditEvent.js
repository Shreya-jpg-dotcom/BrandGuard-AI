import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},
 actorId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 action:{type:String,required:true, maxlength:100},
 entityType:{type:String,required:true,maxlength:80},
 entityId:{type:String,required:true},
 documentId:{type:mongoose.Schema.Types.ObjectId,ref:'Document',default:null,index:true},
 metadata:{type:mongoose.Schema.Types.Mixed,default:{}},
 createdAt:{type:Date,default:Date.now,immutable:true}
},{versionKey:false});
schema.index({organizationId:1,documentId:1,createdAt:-1});
export default mongoose.model('AuditEvent',schema);
