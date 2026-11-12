import {useCallback,useEffect,useState} from 'react';
import {useParams,Link} from 'react-router-dom';
import {ArrowLeft,MessageCircle,Send,ShieldCheck,FileText,History,GitCompare,Check,AlertTriangle,RefreshCw,CornerDownRight} from 'lucide-react';
import {api} from '../services/api';
import {useToast} from '../context/ToastContext';
import '../styles/governance.css';
const label=v=>String(v||'').replaceAll('_',' ').replace(/\b\w/g,c=>c.toUpperCase());
export default function DocumentWorkspacePage({role='employee'}){
 const {id}=useParams(),toast=useToast(),[doc,setDoc]=useState(null),[content,setContent]=useState(''),[analysis,setAnalysis]=useState(null),[conversation,setConversation]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[history,setHistory]=useState([]),[versions,setVersions]=useState([]),[auditEvents,setAuditEvents]=useState([]),[reviews,setReviews]=useState([]),[reviewComment,setReviewComment]=useState(''),[compare,setCompare]=useState(null),[active,setActive]=useState(null),[pendingSuggestion,setPendingSuggestion]=useState(null),[editSuggestion,setEditSuggestion]=useState('');
 const prefix=role==='admin'?'/admin':'/workspace';
 const load=useCallback(async()=>{
  setPendingSuggestion(null);setCompare(null);setActive(null);
  try{
   const [d,a,v,ev,rv]=await Promise.all([api(`/documents/${id}`),api(`/documents/${id}/analyses`),api(`/documents/${id}/versions`),api(`/documents/${id}/audit`),api(`/documents/${id}/reviews`)]);
   setDoc(d.document);setContent(d.content||'');setHistory(a.analyses||[]);setVersions(v.versions||[]);setAuditEvents(ev.events||[]);setReviews(rv.reviews||[]);
   const currentReport=(a.analyses||[]).find(x=>x.documentVersion===d.document.version);if(currentReport){const full=await api(`/analyses/${currentReport._id}`);setAnalysis(full.analysis);}else setAnalysis(null);
   const cs=await api(`/documents/${id}/conversations`);
   if(cs.conversations?.length){const c=await api(`/conversations/${cs.conversations[0]._id}/messages`);setConversation(c.conversation);}
   else {const c=await api(`/documents/${id}/conversations`,{method:'POST',body:JSON.stringify({})});setConversation(c.conversation);}
  }catch(e){toast(e.message,'error');}
 },[id]);
 useEffect(()=>{load();},[load]);
 async function send(e){e.preventDefault();if(!message.trim()||!conversation)return;const text=message.trim(),localId=`local-${Date.now()}`,waitId=`wait-${Date.now()}`;setMessage('');setBusy(true);
  setConversation(c=>({...c,messages:[...(c?.messages||[]),{_id:localId,role:'user',content:text},{_id:waitId,role:'assistant',content:'Thinking…'}]}));
  try{const r=await api(`/conversations/${conversation._id}/messages`,{method:'POST',body:JSON.stringify({message:text})});setConversation(c=>({...c,messages:[...(c.messages||[]).filter(m=>m._id!==localId&&m._id!==waitId),r.userMessage,r.message]}));}
  catch(err){setConversation(c=>({...c,messages:(c.messages||[]).filter(m=>m._id!==localId&&m._id!==waitId)}));toast(err.message,'error');}
  finally{setBusy(false);}
 }
 async function suggest(f){if(!f.span||!f.suggestedCorrection){toast('This finding has no safe, exact text replacement. Ask the assistant for a proposed rewrite instead.','error');return;}
  try{const r=await api(`/analyses/${analysis._id}/suggestions`,{method:'POST',body:JSON.stringify({findingId:f.issueId,start:f.span.start,end:f.span.end,originalText:f.problematicText||content.slice(f.span.start,f.span.end),proposedText:f.suggestedCorrection,explanation:f.reason})});
   setPendingSuggestion(r.suggestion);setEditSuggestion(r.suggestion.proposedText);toast('Suggestion ready. Review it before applying.');
  }catch(e){toast(e.message,'error');}
 }
 async function applySuggestion(){if(!pendingSuggestion)return;try{
  if(editSuggestion!==pendingSuggestion.proposedText)await api(`/suggestions/${pendingSuggestion._id}`,{method:'PATCH',body:JSON.stringify({proposedText:editSuggestion})});
  const a=await api(`/suggestions/${pendingSuggestion._id}/apply`,{method:'POST',body:JSON.stringify({})});
  setContent(a.document.content);setDoc(d=>({...d,version:a.document.version,status:a.document.status,analysisStatus:'not_run'}));setAnalysis(null);setPendingSuggestion(null);toast('Correction applied as a new version. Re-analyse to calculate a new score.');await refreshVersions();
 }catch(e){toast(e.message,'error');}}
 async function rejectSuggestion(){if(!pendingSuggestion)return;try{await api(`/suggestions/${pendingSuggestion._id}/reject`,{method:'POST',body:JSON.stringify({})});setPendingSuggestion(null);toast('Suggestion rejected.');}catch(e){toast(e.message,'error');}}
 async function refreshVersions(){const v=await api(`/documents/${id}/versions`);setVersions(v.versions||[]);}
 async function reanalyse(){setBusy(true);try{await api(`/documents/${id}/analyze`,{method:'POST',body:JSON.stringify({})});await load();toast('New analysis completed.');}catch(e){toast(e.message,'error');}finally{setBusy(false);}}
 async function submit(){try{await api(`/documents/${id}/submit`,{method:'POST',body:JSON.stringify({})});await load();toast('Submitted for human review.');}catch(e){toast(e.message,'error');}}
 async function postReviewComment(reviewId){try{await api(`/reviews/${reviewId}/comments`,{method:'POST',body:JSON.stringify({text:reviewComment})});setReviewComment('');await load();toast('Review comment posted.');}catch(e){toast(e.message,'error');}}
 async function markPublished(){try{await api(`/documents/${id}/publish`,{method:'POST',body:JSON.stringify({})});await load();toast('Document manually marked as published.');}catch(e){toast(e.message,'error');}}
 async function openVersion(v){const x=await api(`/documents/${id}/versions/${v._id}`);setCompare(x.version);}
 async function restoreVersion(v){if(!window.confirm(`Restore version ${v.versionNo}? This creates a new version and keeps all existing history.`))return;try{const r=await api(`/documents/${id}/versions/${v._id}/restore`,{method:'POST',body:JSON.stringify({})});setContent(r.document.content);setDoc(d=>({...d,version:r.document.version,status:'Revised',analysisStatus:'not_run'}));setAnalysis(null);await refreshVersions();toast('Restored as a new document version. Re-analyse before relying on a score.');}catch(e){toast(e.message,'error');}}
 const score=analysis?.overallScore;
 const sourceParts=(()=>{const spans=(analysis?.findings||[]).filter(f=>Number.isInteger(f.span?.start)&&Number.isInteger(f.span?.end)&&f.span.end>f.span.start&&f.span.end<=content.length).slice().sort((a,b)=>a.span.start-b.span.start);const out=[];let cursor=0;for(const f of spans){if(f.span.start<cursor)continue;if(f.span.start>cursor)out.push({text:content.slice(cursor,f.span.start)});out.push({text:content.slice(f.span.start,f.span.end),finding:f});cursor=f.span.end;}if(cursor<content.length)out.push({text:content.slice(cursor)});return out;})();
 function focusFinding(f){setActive(f.issueId);if(f.span)document.getElementById(`finding-${f.issueId}`)?.scrollIntoView({behavior:'smooth',block:'center'});}
 if(!doc)return <div className="governance-loading">Loading document workspace…</div>;
 return <div className="governance-page">
  <div className="governance-head"><div><Link to={`${prefix}/documents`} className="back-link"><ArrowLeft size={15}/> Documents</Link><span className="eyebrow">DOCUMENT GOVERNANCE / WORKSPACE</span><h1>{doc.title}</h1><p>{doc.format?.toUpperCase()} · Version {doc.version} · {label(doc.status)}</p></div><div className="governance-actions"><button className="button button-quiet" onClick={reanalyse} disabled={busy}><RefreshCw size={15}/> Re-analyse</button><button className="button button-dark" onClick={submit} disabled={!analysis||busy}>Submit for review <CornerDownRight size={15}/></button>{role==='admin'&&doc.status==='Approved'&&<button className="button button-quiet" onClick={markPublished}>Mark published manually</button>}</div></div>
  <div className="governance-grid">
   <section className="governance-document panel"><div className="governance-panel-title"><div><span className="eyebrow">SOURCE DOCUMENT</span><h2><FileText size={17}/> Content</h2></div><span className="version-chip">v{doc.version}</span></div>
    <div className="governance-source">{sourceParts.length?sourceParts.map((part,i)=>part.finding?<mark id={`finding-${part.finding.issueId}`} key={i} onClick={()=>setActive(part.finding.issueId)} className={`governance-mark ${part.finding.severity} ${active===part.finding.issueId?'active':''}`} title={part.finding.title}>{part.text}</mark>:<span key={i}>{part.text}</span>):content}</div>
    {compare&&<div className="compare-box"><div className="compare-title"><GitCompare size={16}/> Version {compare.versionNo} comparison source <button onClick={()=>setCompare(null)}>Close</button></div><div className="compare-columns"><div><b>Version {compare.versionNo}</b><pre>{compare.extractedText}</pre></div><div><b>Current version {doc.version}</b><pre>{content}</pre></div></div></div>}
    <div className="version-list"><h3><History size={16}/> Version history</h3>{versions.map(v=><div className="version-row-actions" key={v._id}><button onClick={()=>openVersion(v)}><span>Version {v.versionNo}</span><small>{new Date(v.createdAt).toLocaleString()}</small></button><button onClick={()=>restoreVersion(v)}>Restore</button></div>)}</div><div className="version-list"><h3><History size={16}/> Audit trail</h3>{auditEvents.length?auditEvents.slice(0,12).map(ev=><p className="audit-row" key={ev._id}><b>{ev.action}</b><small>{ev.actorId?.name||'Workspace user'} · {new Date(ev.createdAt).toLocaleString()}</small></p>):<small>No recorded events yet.</small>}</div><div className="version-list"><h3><MessageCircle size={16}/> Review discussion</h3>{reviews.length?reviews.map(r=><div className="review-thread" key={r._id}><b>{r.status.replaceAll('_',' ')}</b>{(r.comments||[]).map(c=><p key={c._id}><strong>{c.authorId?.name||'Reviewer'}</strong> · {c.text}</p>)}<div><input value={reviewComment} onChange={e=>setReviewComment(e.target.value)} placeholder="Reply to this review"/><button onClick={()=>postReviewComment(r._id)}>Reply</button></div></div>):<small>This document has not been submitted for review.</small>}</div>
   </section>
   <section className="governance-chat panel"><div className="governance-panel-title"><div><span className="eyebrow">DOCUMENT-SCOPED ASSISTANT</span><h2><MessageCircle size={17}/> Ask BrandGuard</h2></div><span className="secure-chip"><ShieldCheck size={13}/> Context isolated</span></div>
    <div className="chat-suggestions">{['Why did this document receive its score?','Which issues should I fix first?','How can I improve the introduction?'].map(q=><button key={q} onClick={()=>setMessage(q)}>{q}</button>)}</div>
    <div className="chat-history">{(conversation?.messages||[]).map(m=><div className={`chat-message ${m.role}`} key={m._id}><span>{m.role==='assistant'?'BRANDGUARD':'YOU'}</span><p>{m.content}</p>{m.sources?.filter(s=>s.verified).map((s,i)=><small key={i}>Source: {s.document||'Approved source'}{s.page?` · p.${s.page}`:''}</small>)}</div>)}</div>
    <form className="chat-compose" onSubmit={send}><textarea rows="2" value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ask about this document, its findings or brand guidelines…" maxLength={5000}/><button className="button button-dark" disabled={busy||!message.trim()}><Send size={15}/> Send</button></form>
    <p className="chat-disclaimer">Responses are grounded in this document and retrieved brand knowledge. AI suggestions never approve or publish content.</p>
   </section>
   {pendingSuggestion&&<section className="governance-suggestion panel"><span className="eyebrow">REVIEW BEFORE APPLYING</span><h3>Proposed correction</h3><p className="suggestion-original">Original: {pendingSuggestion.originalText}</p><label>Replacement text<textarea rows="4" value={editSuggestion} onChange={e=>setEditSuggestion(e.target.value)}/></label><p>{pendingSuggestion.explanation}</p><div className="governance-actions"><button className="button button-quiet" onClick={rejectSuggestion}>Reject</button><button className="button button-dark" onClick={applySuggestion}><Check size={14}/> Apply fix</button></div></section>}
   <aside className="governance-compliance panel"><span className="eyebrow">LATEST ANALYSIS</span><div className="governance-score">{score??'—'}<small>{score===null||score===undefined?'Not analysed':'/100'}</small></div><h3>{analysis?.complianceStatus||'No current report'}</h3><p>{analysis?.summary||'Run an analysis on the current document version to see real findings.'}</p>
    <div className="governance-dimensions">{(analysis?.dimensions||[]).map(d=><div key={d.key}><span>{d.label}</span><b>{d.assessed?`${d.score}/100`:'N/A'}</b></div>)}</div>
    <div className="governance-findings"><h3>Findings ({analysis?.findings?.length||0})</h3>{(analysis?.findings||[]).map(f=><article key={f.issueId} className={active===f.issueId?'active':''}><button className="finding-open" onClick={()=>focusFinding(f)}><span className={`severity-dot ${f.severity}`}/><span>{f.title}<small>{label(f.category)} · {label(f.severity)}</small></span></button>{active===f.issueId&&<div className="finding-detail"><p>{f.explanation}</p>{f.source?.verified?<blockquote>{f.source.document}{f.source.page?` · Page ${f.source.page}`:''}<br/>{f.evidenceQuote}</blockquote>:<small>No matching approved source verified; human judgement required.</small>}{f.suggestedCorrection&&<><p><b>Suggested:</b> {f.suggestedCorrection}</p><button className="button button-small button-quiet" onClick={()=>suggest(f)}>Apply fix as new version</button></>}</div>}</article>)}</div>
   </aside>
  </div>
  <div className="governance-footnote"><AlertTriangle size={15}/> Applying a fix creates a new version and invalidates the old score for current content. A genuine re-analysis is required before a new score is shown.</div>
 </div>;
}
