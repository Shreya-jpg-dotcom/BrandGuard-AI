import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 organizationId:{type:mongoose.Schema.Types.ObjectId,ref:'Organization',required:true,index:true},
 documentId:{type:mongoose.Schema.Types.ObjectId,ref:'Document',required:true,index:true},
 analysisId:{type:mongoose.Schema.Types.ObjectId,ref:'Analysis',default:null},
 findingId:{type:String,default:''},
 createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 versionNo:{type:Number,required:true},
 start:{type:Number,required:true,min:0},
 end:{type:Number,required:true,min:0},
 originalText:{type:String,required:true,maxlength:12000},
 proposedText:{type:String,required:true,maxlength:12000},
 explanation:{type:String,default:'',maxlength:2000},
 status:{type:String,enum:['pending','applied','rejected','stale'],default:'pending'}
},{timestamps:true});
schema.index({organizationId:1,documentId:1,createdAt:-1});
export default mongoose.model('CorrectionSuggestion',schema);
