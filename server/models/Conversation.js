import mongoose from 'mongoose';
const messageSchema=new mongoose.Schema({
  role:{type:String,enum:['user','assistant'],required:true},
  content:{type:String,required:true,maxlength:12000},
  documentVersionId:{type:mongoose.Schema.Types.ObjectId,ref:'DocumentVersion',default:null},
  sources:[{document:String,page:Number,section:String,quote:String,verified:Boolean}],
  createdAt:{type:Date,default:Date.now}
},{_id:true});
const schema=new mongoose.Schema({
  organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},
  userId:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true,index:true},
  documentId:{type:mongoose.Schema.Types.ObjectId,ref:'Document',required:true,index:true},
  documentVersionId:{type:mongoose.Schema.Types.ObjectId,ref:'DocumentVersion',default:null},
  latestAnalysisId:{type:mongoose.Schema.Types.ObjectId,ref:'Analysis',default:null},
  title:{type:String,default:'Document conversation',maxlength:160},
  messages:{type:[messageSchema],default:[]},
  summary:{type:String,default:'',maxlength:4000},
  active:{type:Boolean,default:true}
},{timestamps:true});
schema.index({organizationId:1,documentId:1,userId:1,updatedAt:-1});
export default mongoose.model('Conversation',schema);
