import { useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock3, FileText, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import '../styles/governance.css';

const number = value => Number(value || 0).toLocaleString();
function RankedList({ title, items, labelKey }) {
  const max = Math.max(1, ...items.map(item => item.count));
  return <section className="panel insight-panel"><h2>{title}</h2>{items.length ? <div className="insight-ranks">{items.map((item, i) => <div className="insight-rank" key={`${item[labelKey]}-${i}`}><div><span>{item[labelKey]}</span><b>{number(item.count)}</b></div><div className="insight-track"><i style={{ width: `${Math.max(3, item.count / max * 100)}%` }} /></div></div>)}</div> : <p className="insight-empty">No analysed findings yet.</p>}</section>;
}
export default function InsightsPage() {
  const [data, setData] = useState(null), [loading, setLoading] = useState(true);
  const toast = useToast();
  async function load() { setLoading(true); try { setData(await api('/admin/insights')); } catch (error) { toast(error.message, 'error'); } finally { setLoading(false); } }
  useEffect(() => { load(); }, []);
  if (loading && !data) return <div className="panel review-empty">Loading organisation insights…</div>;
  if (!data) return <div className="panel review-empty"><AlertCircle size={24}/><h2>Insights unavailable</h2><button className="button button-quiet" onClick={load}>Try again</button></div>;
  const metrics = [
    ['Documents', data.totals.documents, FileText], ['Analysis runs', data.totals.analyses, Activity], ['Findings recorded', data.totals.findings, ShieldAlert], ['Reviews', data.totals.reviews, CheckCircle2]
  ];
  return <div className="governance-page"><div className="governance-head"><div><span className="eyebrow">GOVERNANCE / ORGANISATION HEALTH</span><h1>Governance insights</h1><p>Aggregated workflow signals from stored organisation data. These metrics are for process improvement, not employee ranking.</p></div><button className="button button-quiet" onClick={load} disabled={loading}><RefreshCw size={14}/> Refresh</button></div>
    <div className="insight-metrics">{metrics.map(([label,value,Icon])=><article className="panel insight-metric" key={label}><span><Icon size={17}/></span><small>{label}</small><strong>{number(value)}</strong></article>)}</div>
    <div className="insight-grid"><RankedList title="Most frequently flagged rules" items={data.mostViolatedRules} labelKey="label"/><RankedList title="Issues by category" items={data.issuesByCategory} labelKey="category"/><RankedList title="Findings by contributor" items={data.issuesByContributor} labelKey="contributor"/></div>
    <div className="insight-grid"><section className="panel insight-panel"><h2>Correction outcomes</h2><div className="insight-big">{data.suggestions.acceptanceRate===null?'—':`${data.suggestions.acceptanceRate}%`}</div><p>Suggestion acceptance rate</p><div className="insight-split"><span>{number(data.suggestions.applied)} applied</span><span>{number(data.suggestions.total)} total suggestions</span></div></section>
      <section className="panel insight-panel"><h2>Review operations</h2><div className="insight-review-stats"><div><b>{number(data.reviews.overrideCount)}</b><span>Overrides</span></div><div><b>{data.reviews.reworkRate===null?'—':`${data.reviews.reworkRate}%`}</b><span>Rework rate</span></div><div><b>{data.reviews.averageApprovalHours===null?'—':`${data.reviews.averageApprovalHours}h`}</b><span>Avg. approval time</span></div></div><p className="insight-footnote">Override rate: {data.reviews.overrideRate===null?'—':`${data.reviews.overrideRate}%`} of submitted reviews. {number(data.reviews.decided)} reviews have recorded decisions.</p></section>
      <section className="panel insight-panel"><h2>Knowledge-base coverage</h2><div className="insight-review-stats"><div><b>{number(data.knowledgeCoverage.activeGuidelines)}</b><span>Active Brand Bible sources</span></div><div><b>{number(data.knowledgeCoverage.activeFacts)}</b><span>Active approved facts</span></div><div><b>{number(data.knowledgeCoverage.activeTerminology)}</b><span>Active terminology rules</span></div></div>{!data.knowledgeCoverage.hasApprovedKnowledge&&<p className="insight-empty">No active approved knowledge sources. Analysis will have limited brand-specific evidence.</p>}</section>
    </div>
    <p className="insight-footnote"><Clock3 size={13}/> Metrics reflect records currently stored in this organisation. Team-level grouping is not available because the current user model has no team field; findings are grouped by contributor instead.</p>
  </div>;
}
