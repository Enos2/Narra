/* eslint-disable no-unused-vars */
/* AdminAuditLogs.jsx — Redesigned with role-based animated backgrounds */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useAppContext } from "../../context/AppContext";
import "./AdminAuditLogs.css";

/* ─────────────────────────────────────────────────────────────
   Role → accent color map
───────────────────────────────────────────────────────────── */
const ROLE_ACCENT = {
  superadmin:    "#FFD700",
  platformadmin: "#4f6ef7",
  supportadmin:  "#22c55e",
};

/* ─────────────────────────────────────────────────────────────
   Action type helpers
───────────────────────────────────────────────────────────── */
const VIDEO_ACTIONS = {
  VIEW_THUMBNAIL:        { label: "View Thumbnail",        cat: "neutral"  },
  VIEW_TRAILER:          { label: "View Trailer",          cat: "neutral"  },
  VIEW_FULL_VIDEO:       { label: "View Full Video",       cat: "neutral"  },
  FLAG_VIDEO:            { label: "Flag Video",            cat: "warning"  },
  REMOVE_FLAG:           { label: "Remove Flag",           cat: "positive" },
  RESTRICT_VIDEO:        { label: "Restrict Video",        cat: "warning"  },
  REMOVE_RESTRICTION:    { label: "Remove Restriction",    cat: "positive" },
  SHADOW_BAN_VIDEO:      { label: "Shadow Ban Video",      cat: "warning"  },
  REMOVE_SHADOW_BAN:     { label: "Remove Shadow Ban",     cat: "positive" },
  REMOVE_VIDEO:          { label: "Soft Delete Video",     cat: "negative" },
  RESTORE_VIDEO:         { label: "Restore Video",         cat: "positive" },
  PERMANENT_DELETE_VIDEO:{ label: "Permanent Delete",      cat: "negative" },
  APPROVE_VIDEO:         { label: "Approve Video",         cat: "positive" },
  REJECT_VIDEO:          { label: "Reject Video",          cat: "negative" },
  FEATURE_VIDEO:         { label: "Feature Video",         cat: "positive" },
  UNFEATURE_VIDEO:       { label: "Unfeature Video",       cat: "neutral"  },
};

const getActionClass = (t) => {
  if (!t) return "neutral";
  if (VIDEO_ACTIONS[t]) return VIDEO_ACTIONS[t].cat;
  if (/APPROVE|CREATE|ACTIVATE|VERIFY|GRANT|RESTORE/.test(t)) return "positive";
  if (/BAN|REJECT|DELETE|REMOVE|DEACTIVATE|REVOKE/.test(t)) return "negative";
  if (/PROMOTE|DEMOTE|FEATURE|TOGGLE|FLAG|RESTRICT|SHADOW/.test(t)) return "warning";
  return "neutral";
};

const formatAction = (t) => {
  if (!t) return "";
  if (VIDEO_ACTIONS[t]) return VIDEO_ACTIONS[t].label;
  return t.replace(/_/g," ").toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};

const getRelativeTime = (d) => {
  const ms = Date.now() - new Date(d);
  const m = Math.floor(ms/60000), h = Math.floor(ms/3600000), day = Math.floor(ms/86400000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${day}d ago`;
};

const formatDate = (d) =>
  new Date(d).toLocaleString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"});

/* ─────────────────────────────────────────────────────────────
   Background components — same visual system as VideoApprovals
───────────────────────────────────────────────────────────── */
function SuperBg() {
  const rays = Array.from({length:24},(_,i)=>{
    const a=(i*360/24)*Math.PI/180;
    return {x2:720+Math.cos(a)*950, y2:450+Math.sin(a)*950};
  });
  return (
    <svg className="aal-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="asg1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13"/>
          <stop offset="100%" stopColor="#FFD700" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#asg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.8;1;0.8" dur="7s" repeatCount="indefinite"/>
      </ellipse>
      {rays.map(({x2,y2},i)=>(
        <line key={i} x1="720" y1="450" x2={x2} y2={y2}
          stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045"
            dur={`${4+(i%4)}s`} begin={`${i*0.18}s`} repeatCount="indefinite"/>
        </line>
      ))}
      {[110,200,310,440].map((r,i)=>(
        <rect key={i} x={720-r*0.707} y={450-r*0.707} width={r*1.414} height={r*1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1"
          transform="rotate(45 720 450)">
          <animate attributeName="stroke-opacity" values="0.07;0.16;0.07" dur={`${5+i}s`} begin={`${i*0.9}s`} repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="rotate" from="45 720 450" to="90 720 450" dur={`${18+i*5}s`} repeatCount="indefinite"/>
        </rect>
      ))}
      {[[60,60],[1380,60],[60,840],[1380,840]].map(([x,y],i)=>(
        <g key={i}>
          <line x1={x-24} y1={y} x2={x+24} y2={y} stroke="#FFD700" strokeOpacity="0.22" strokeWidth="1.5"/>
          <line x1={x} y1={y-24} x2={x} y2={y+24} stroke="#FFD700" strokeOpacity="0.22" strokeWidth="1.5"/>
          <circle cx={x} cy={y} r="4" fill="#FFD700" fillOpacity="0.35">
            <animate attributeName="fill-opacity" values="0.35;0.8;0.35" dur="3s" begin={`${i*0.8}s`} repeatCount="indefinite"/>
          </circle>
        </g>
      ))}
    </svg>
  );
}

function PlatformBg() {
  const traces=[
    "M0,180 H280 V130 H560 V180 H860 V90 H1440",
    "M0,380 H180 V330 H480 V430 H780 V380 H1440",
    "M0,580 H380 V530 H680 V630 H980 V580 H1440",
    "M0,740 H90 V690 H380 V790 H680 V740 H1440",
    "M220,0 V180 H310 V490 H260 V900",
    "M620,0 V140 H710 V390 H660 V900",
    "M1080,0 V290 H1030 V590 H1130 V900",
  ];
  const nodes=[[280,130],[560,180],[860,90],[180,330],[480,430],[380,530],[680,630],[380,690]];
  return (
    <svg className="aal-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="apbg" width="34" height="34" patternUnits="userSpaceOnUse">
          <path d="M34,0 L0,0 0,34" fill="none" stroke="#4f6ef7" strokeOpacity="0.04" strokeWidth="0.5"/>
        </pattern>
      </defs>
      <rect width="1440" height="900" fill="url(#apbg)">
        <animate attributeName="opacity" values="0.5;1;0.5" dur="4s" repeatCount="indefinite"/>
      </rect>
      {traces.map((d,i)=>(
        <path key={i} d={d} fill="none" stroke="#4f6ef7" strokeOpacity="0.08" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.08;0.2;0.08" dur={`${3+i*0.7}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/>
        </path>
      ))}
      {nodes.map(([x,y],i)=>(
        <circle key={i} cx={x} cy={y} r="4" fill="#4f6ef7" fillOpacity="0.5">
          <animate attributeName="r" values="4;9;4" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
          <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
        </circle>
      ))}
      <circle r="3.5" fill="#4f6ef7" fillOpacity="0.9">
        <animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440"/>
      </circle>
      <circle r="3.5" fill="#4f6ef7" fillOpacity="0.9">
        <animateMotion dur="12s" repeatCount="indefinite" begin="3s" path="M0,580 H380 V530 H680 V630 H980 V580 H1440"/>
      </circle>
    </svg>
  );
}

function SupportBg() {
  const vines=[
    "M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30",
    "M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0",
    "M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95",
    "M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0",
    "M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40",
  ];
  const leaves=[[130,440],[365,490],[715,545],[1055,470],[1340,515],[200,30],[350,0],[695,95],[1070,0],[1335,40]];
  return (
    <svg className="aal-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="asbg" cx="50%" cy="100%" r="60%">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.08"/>
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#asbg)"/>
      {vines.map((d,i)=>(
        <path key={i} d={d} fill="none" stroke="#22c55e" strokeOpacity="0.065" strokeWidth="1.5">
          <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5+i}s`} begin={`${i*0.9}s`} repeatCount="indefinite"/>
        </path>
      ))}
      {leaves.map(([x,y],i)=>(
        <ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22c55e" fillOpacity="0.14" transform={`rotate(${i*37} ${x} ${y})`}>
          <animate attributeName="fill-opacity" values="0.14;0.32;0.14" dur={`${3+i*0.6}s`} begin={`${i*0.45}s`} repeatCount="indefinite"/>
          <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14+i*2}s`} repeatCount="indefinite"/>
        </ellipse>
      ))}
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="13s" repeatCount="indefinite" path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30"/>
      </circle>
      <circle r="2.5" fill="#22c55e" fillOpacity="0.9">
        <animateMotion dur="16s" repeatCount="indefinite" begin="5s" path="M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95"/>
      </circle>
    </svg>
  );
}

/* ─────────────────────────────────────────────────────────────
   Pagination component
───────────────────────────────────────────────────────────── */
const Pagination = ({ pagination, onChange }) => {
  const { page, totalPages } = pagination;
  const pages = [];
  let start = Math.max(1, page - 2);
  let end   = Math.min(totalPages, start + 4);
  if (end - start < 4) start = Math.max(1, end - 4);
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="aal-pagination">
      <button className="aal-page-btn" onClick={()=>onChange(1)} disabled={page===1}>First</button>
      <button className="aal-page-btn" onClick={()=>onChange(page-1)} disabled={page===1}>Prev</button>
      {pages.map(p=>(
        <button key={p} className={`aal-page-btn ${page===p?"aal-page-btn--active":""}`} onClick={()=>onChange(p)}>{p}</button>
      ))}
      <button className="aal-page-btn" onClick={()=>onChange(page+1)} disabled={page===totalPages}>Next</button>
      <button className="aal-page-btn" onClick={()=>onChange(totalPages)} disabled={page===totalPages}>Last</button>
    </div>
  );
};

/* ─────────────────────────────────────────────────────────────
   Main component
───────────────────────────────────────────────────────────── */
const AdminAuditLogs = () => {
  const { user, token, isAuthReady } = useAppContext();
  const role = user?.role || "superadmin";

  const [logs, setLogs]               = useState([]);
  const [loading, setLoading]         = useState(true);
  const [message, setMessage]         = useState(null);
  const [filterOptions, setFilterOptions] = useState({ actionTypes:[], adminNames:[], targetTypes:[] });

  const [filters, setFilters] = useState({
    search:"", adminName:"", actionType:"", targetType:"",
    startDate:"", endDate:"", page:1, limit:20, sortBy:"createdAt", sortOrder:"desc"
  });
  const [pagination, setPagination] = useState({ total:0, page:1, limit:20, totalPages:1 });

  const canView = ["superadmin","platformadmin","supportadmin"].includes(user?.role);

  /* Fetch filter options */
  const fetchFilterOptions = async () => {
    try {
      const res = await axios.get("/api/admin/audit/filters", { headers:{ Authorization:`Bearer ${token}` } });
      if (res.data.success) {
        const backend = res.data.actionTypes || [];
        const all = [...new Set([...backend, ...Object.keys(VIDEO_ACTIONS)])].sort();
        setFilterOptions({ actionTypes:all, adminNames:res.data.adminNames||[], targetTypes:res.data.targetTypes||[] });
      }
    } catch {
      setFilterOptions(p=>({...p, actionTypes:Object.keys(VIDEO_ACTIONS).sort()}));
    }
  };

  /* Fetch logs */
  const fetchLogs = async (f = filters) => {
    if (!token || !canView) return;
    try {
      setLoading(true);
      const params = Object.fromEntries(Object.entries(f).filter(([,v])=>v!==''&&v!=null));
      const res = await axios.get("/api/admin/audit/logs", { headers:{ Authorization:`Bearer ${token}` }, params });
      if (res.data.success) {
        setLogs(res.data.logs||[]);
        setPagination(res.data.pagination||{ total:0,page:1,limit:20,totalPages:1 });
      } else {
        setMessage({ type:"error", text:"Failed to load audit logs." });
      }
    } catch {
      setMessage({ type:"error", text:"Failed to load audit logs." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(()=>{
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isAuthReady && user && canView && token) { fetchFilterOptions(); fetchLogs(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthReady, user, token]);

  const setFilter = (k, v) => setFilters(p=>({...p,[k]:v,page:1}));
  const handlePageChange = (p) => {
    const next = {...filters, page:p};
    setFilters(next); fetchLogs(next);
  };
  const handleSearch = (e) => { e.preventDefault(); fetchLogs(); };
  const handleReset = () => {
    const def = { search:"",adminName:"",actionType:"",targetType:"",startDate:"",endDate:"",page:1,limit:20,sortBy:"createdAt",sortOrder:"desc" };
    setFilters(def); fetchLogs(def);
  };
  const handleApply = () => fetchLogs();

  if (!isAuthReady || loading) return (
    <div className={`aal-loading aal-role-${role}`}>
      <div className="aal-loading__ring"/>
      <p>Loading audit logs&hellip;</p>
    </div>
  );

  if (!canView) return (
    <div className="aal-loading">
      <p className="aal-denied">Permission denied. Admin access required.</p>
    </div>
  );

  return (
    <div className={`aal-page aal-role-${role}`}>

      {/* Animated background */}
      <div className="aal-bg" aria-hidden="true">
        {role==="superadmin"    && <SuperBg/>}
        {role==="platformadmin" && <PlatformBg/>}
        {role==="supportadmin"  && <SupportBg/>}
      </div>

      {/* Grain */}
      <div className="aal-grain" aria-hidden="true"/>

      {/* Header */}
      <header className="aal-header">
        <div className="aal-header__line"/>
        <h1 className="aal-headline">Audit Logs</h1>
        <p className="aal-sub">Complete history of all administrative actions</p>
        <div className="aal-header__line"/>
      </header>

      {/* Alert */}
      {message && (
        <div className={`aal-alert aal-alert--${message.type}`}>
          <span>{message.text}</span>
          <button className="aal-alert__close" onClick={()=>setMessage(null)}>x</button>
        </div>
      )}

      {/* Filter panel */}
      <div className="aal-filters">
        <form onSubmit={handleSearch} className="aal-search-row">
          <input
            className="aal-search-input"
            type="text"
            placeholder="Search across admin name, action, target, reason..."
            value={filters.search}
            onChange={e=>setFilter("search",e.target.value)}
          />
          <button type="submit" className="aal-btn aal-btn--primary">Search</button>
          <button type="button" className="aal-btn aal-btn--ghost" onClick={handleReset}>Clear</button>
        </form>

        <div className="aal-filter-grid">
          <div className="aal-field">
            <label className="aal-label">Admin</label>
            <select className="aal-select" value={filters.adminName} onChange={e=>setFilter("adminName",e.target.value)}>
              <option value="">All Admins</option>
              {filterOptions.adminNames.map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="aal-field">
            <label className="aal-label">Action Type</label>
            <select className="aal-select" value={filters.actionType} onChange={e=>setFilter("actionType",e.target.value)}>
              <option value="">All Actions</option>
              {filterOptions.actionTypes.map(t=><option key={t} value={t}>{formatAction(t)}</option>)}
            </select>
          </div>
          <div className="aal-field">
            <label className="aal-label">Target Type</label>
            <select className="aal-select" value={filters.targetType} onChange={e=>setFilter("targetType",e.target.value)}>
              <option value="">All Targets</option>
              {filterOptions.targetTypes.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="aal-field">
            <label className="aal-label">From Date</label>
            <input className="aal-date-input" type="date" value={filters.startDate} onChange={e=>setFilter("startDate",e.target.value)}/>
          </div>
          <div className="aal-field">
            <label className="aal-label">To Date</label>
            <input className="aal-date-input" type="date" value={filters.endDate} onChange={e=>setFilter("endDate",e.target.value)}/>
          </div>
          <div className="aal-field">
            <label className="aal-label">Per Page</label>
            <select className="aal-select" value={filters.limit} onChange={e=>setFilter("limit",parseInt(e.target.value))}>
              {[10,20,50,100].map(n=><option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div className="aal-field">
            <label className="aal-label">Sort By</label>
            <select className="aal-select" value={filters.sortBy} onChange={e=>setFilter("sortBy",e.target.value)}>
              <option value="createdAt">Date</option>
              <option value="adminName">Admin Name</option>
              <option value="actionType">Action Type</option>
            </select>
          </div>
          <div className="aal-field">
            <label className="aal-label">Order</label>
            <select className="aal-select" value={filters.sortOrder} onChange={e=>setFilter("sortOrder",e.target.value)}>
              <option value="desc">Newest First</option>
              <option value="asc">Oldest First</option>
            </select>
          </div>
        </div>

        <div className="aal-filter-actions">
          <button className="aal-btn aal-btn--ghost" onClick={handleReset}>Reset Filters</button>
          <button className="aal-btn aal-btn--primary" onClick={handleApply}>Apply Filters</button>
        </div>
      </div>

      {/* Results bar */}
      <div className="aal-results-bar">
        <div className="aal-results-info">
          <span className="aal-count-pill">{pagination.total}</span>
          <span>total actions</span>
          {filters.search    && <span className="aal-filter-tag">Search: <strong>{filters.search}</strong></span>}
          {filters.adminName && <span className="aal-filter-tag">Admin: <strong>{filters.adminName}</strong></span>}
          {filters.actionType && <span className="aal-filter-tag">Action: <strong>{formatAction(filters.actionType)}</strong></span>}
        </div>
        <Pagination pagination={pagination} onChange={handlePageChange}/>
      </div>

      {/* Table or empty */}
      {logs.length === 0 ? (
        <div className="aal-empty">
          <div className="aal-empty__icon"/>
          <h3>No actions found</h3>
          <p>{(filters.search||filters.adminName||filters.actionType||filters.targetType)
            ? "Try adjusting your filters or search terms."
            : "No admin actions have been recorded yet."}</p>
          {(filters.search||filters.adminName||filters.actionType||filters.targetType) && (
            <button className="aal-btn aal-btn--primary" onClick={handleReset}>Reset Filters</button>
          )}
        </div>
      ) : (
        <>
          <div className="aal-table-wrap">
            <table className="aal-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Description</th>
                  <th>Reason</th>
                  <th>Date &amp; Time</th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log=>{
                  const cat = getActionClass(log.actionType);
                  return (
                    <tr key={log._id}>
                      <td>
                        <div className="aal-admin-cell">
                          <span className="aal-admin-name">{log.adminName||"Unknown"}</span>
                          {log.adminRole && (
                            <span className={`aal-admin-role aal-admin-role--${(log.adminRole||"").toLowerCase()}`}>
                              {log.adminRole}
                            </span>
                          )}
                          {log.adminEmail && <span className="aal-admin-email">{log.adminEmail}</span>}
                        </div>
                      </td>
                      <td>
                        <div className={`aal-action-cell aal-action-cell--${cat}`}>
                          <span className="aal-action-label">{formatAction(log.actionType)}</span>
                          <span className="aal-action-code">{log.actionType}</span>
                        </div>
                      </td>
                      <td>
                        <div className="aal-target-cell">
                          {log.targetType && <span className="aal-target-type">{log.targetType}</span>}
                          {log.targetName && <span className="aal-target-name">{log.targetName}</span>}
                          {(log.targetEmail||log.targetId) && !log.targetName && (
                            <span className="aal-target-sub">
                              {log.targetEmail || `ID: ${String(log.targetId).substring(0,8)}...`}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="aal-desc-cell">{log.description||"—"}</td>
                      <td className="aal-reason-cell">
                        {log.reason
                          ? <div className="aal-reason-content">{log.reason}</div>
                          : <span className="aal-reason-empty">—</span>}
                      </td>
                      <td>
                        <div className="aal-time-main">{formatDate(log.createdAt)}</div>
                        <div className="aal-time-rel">{getRelativeTime(log.createdAt)}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom pagination */}
          <div className="aal-pagination-footer">
            <span className="aal-pagination-count">
              Showing <strong>{logs.length}</strong> of <strong>{pagination.total}</strong> actions
            </span>
            <Pagination pagination={pagination} onChange={handlePageChange}/>
          </div>
        </>
      )}

      {/* Footer stats */}
      <div className="aal-footer">
        <div className="aal-footer-stats">
          <div className="aal-stat">
            <span className="aal-stat__label">Total Actions</span>
            <span className="aal-stat__value">{pagination.total}</span>
          </div>
          <div className="aal-stat">
            <span className="aal-stat__label">Unique Admins</span>
            <span className="aal-stat__value">{filterOptions.adminNames.length}</span>
          </div>
          <div className="aal-stat">
            <span className="aal-stat__label">Action Types</span>
            <span className="aal-stat__value">{filterOptions.actionTypes.length}</span>
          </div>
        </div>
        <button className="aal-btn aal-btn--primary">Export CSV</button>
      </div>
    </div>
  );
};

export default AdminAuditLogs;