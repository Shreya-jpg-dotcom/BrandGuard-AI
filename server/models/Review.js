import mongoose from 'mongoose';
const commentSchema=new mongoose.Schema({
 authorId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 versionNo:{type:Number,required:true},
 findingId:{type:String,default:''},
 start:{type:Number,default:null},end:{type:Number,default:null},
 text:{type:String,required:true,maxlength:3000},
 createdAt:{type:Date,default:Date.now}
});
const decisionSchema=new mongoose.Schema({
 actorId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 decision:{type:String,enum:['approved','changes_requested','override'],required:true},
 reason:{type:String,default:'',maxlength:2000},
 versionNo:{type:Number,required:true},
 createdAt:{type:Date,default:Date.now}
});
const schema=new mongoose.Schema({
 organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},
 documentId:{type:mongoose.Schema.Types.ObjectId,ref:'Document',required:true,index:true},
 creatorId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 reviewerId:{type:mongoose.Schema.Types.ObjectId,ref:'User',default:null},
 versionNo:{type:Number,required:true},
 analysisId:{type:mongoose.Schema.Types.ObjectId,ref:'Analysis',default:null},
 status:{type:String,enum:['in_review','changes_requested','approved','superseded'],default:'in_review',index:true},
 comments:{type:[commentSchema],default:[]},
 decisions:{type:[decisionSchema],default:[]},
 submittedAt:{type:Date,default:Date.now}
},{timestamps:true});
schema.index({organizationId:1,status:1,submittedAt:-1});
export default mongoose.model('Review',schema);
