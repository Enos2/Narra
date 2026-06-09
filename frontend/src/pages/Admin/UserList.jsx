/* eslint-disable no-unused-vars */
/* eslint-disable react-hooks/set-state-in-effect */
// File: frontend/src/pages/admin/UserList.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useAppContext } from "../../context/AppContext";
import AdminVideoDeleteModal from "../../components/AdminVideoDeleteModal";
import { getVideosByStatus, adminSoftDeleteVideo, adminRestoreVideo, adminPermanentDeleteVideo } from "../../requests";
import "./UserList.css";

/* ─── Role-themed SVG Backgrounds ─── */
function SuperBg() {
  const rays = Array.from({ length: 24 }, (_, i) => {
    const a = (i * 360 / 24) * Math.PI / 180;
    return { x2: 720 + Math.cos(a) * 950, y2: 450 + Math.sin(a) * 950 };
  });
  return (
    <svg className="ul-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="ulsg1" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.13"/><stop offset="100%" stopColor="#FFD700" stopOpacity="0"/>
      </radialGradient></defs>
      <ellipse cx="720" cy="450" rx="480" ry="320" fill="url(#ulsg1)">
        <animate attributeName="rx" values="480;530;480" dur="7s" repeatCount="indefinite"/>
      </ellipse>
      {rays.map(({ x2, y2 }, i) => (
        <line key={i} x1="720" y1="450" x2={x2} y2={y2} stroke="#FFD700" strokeOpacity="0.045" strokeWidth="1">
          <animate attributeName="stroke-opacity" values="0.045;0.1;0.045" dur={`${4+(i%4)}s`} begin={`${i*0.18}s`} repeatCount="indefinite"/>
        </line>
      ))}
      {[110,200,310,440].map((r,i)=>(
        <rect key={i} x={720-r*0.707} y={450-r*0.707} width={r*1.414} height={r*1.414}
          fill="none" stroke="#FFD700" strokeOpacity="0.07" strokeWidth="1" transform="rotate(45 720 450)">
          <animateTransform attributeName="transform" type="rotate" from="45 720 450" to="90 720 450" dur={`${18+i*5}s`} repeatCount="indefinite"/>
        </rect>
      ))}
    </svg>
  );
}

function PlatformBg() {
  const traces = ["M0,180 H280 V130 H560 V180 H860 V90 H1440","M0,380 H180 V330 H480 V430 H780 V380 H1440","M0,580 H380 V530 H680 V630 H980 V580 H1440","M220,0 V180 H310 V490 H260 V900","M620,0 V140 H710 V390 H660 V900","M1080,0 V290 H1030 V590 H1130 V900"];
  const nodes = [[280,130],[560,180],[860,90],[180,330],[480,430],[380,530],[680,630]];
  return (
    <svg className="ul-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><pattern id="ulpbg" width="34" height="34" patternUnits="userSpaceOnUse">
        <path d="M34,0 L0,0 0,34" fill="none" stroke="#3B82F6" strokeOpacity="0.04" strokeWidth="0.5"/>
      </pattern></defs>
      <rect width="1440" height="900" fill="url(#ulpbg)"/>
      {traces.map((d,i)=>(<path key={i} d={d} fill="none" stroke="#3B82F6" strokeOpacity="0.08" strokeWidth="1.5">
        <animate attributeName="stroke-opacity" values="0.08;0.2;0.08" dur={`${3+i*0.7}s`} begin={`${i*0.4}s`} repeatCount="indefinite"/>
      </path>))}
      {nodes.map(([x,y],i)=>(<circle key={i} cx={x} cy={y} r="4" fill="#3B82F6" fillOpacity="0.5">
        <animate attributeName="r" values="4;9;4" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
        <animate attributeName="fill-opacity" values="0.5;0;0.5" dur={`${2+i*0.35}s`} begin={`${i*0.55}s`} repeatCount="indefinite"/>
      </circle>))}
      <circle r="3.5" fill="#3B82F6" fillOpacity="0.9"><animateMotion dur="9s" repeatCount="indefinite" path="M0,180 H280 V130 H560 V180 H860 V90 H1440"/></circle>
    </svg>
  );
}

function SupportBg() {
  const vines = ["M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30","M380,900 C360,750 400,640 365,490 C340,370 390,240 350,0","M720,900 C700,780 755,675 715,545 C685,435 725,295 695,95","M1020,900 C1040,730 1000,620 1055,470 C1090,350 1030,210 1070,0","M1360,900 C1340,760 1395,655 1355,515 C1325,395 1370,230 1335,40"];
  const leaves = [[130,440],[365,490],[715,545],[1055,470],[1340,515],[200,30],[350,0],[695,95]];
  return (
    <svg className="ul-bg-svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs><radialGradient id="ulsbg" cx="50%" cy="100%" r="60%">
        <stop offset="0%" stopColor="#22ff00" stopOpacity="0.08"/><stop offset="100%" stopColor="#22ff00" stopOpacity="0"/>
      </radialGradient></defs>
      <rect width="1440" height="900" fill="url(#ulsbg)"/>
      {vines.map((d,i)=>(<path key={i} d={d} fill="none" stroke="#22ff00" strokeOpacity="0.065" strokeWidth="1.5">
        <animate attributeName="stroke-opacity" values="0.065;0.16;0.065" dur={`${5+i}s`} begin={`${i*0.9}s`} repeatCount="indefinite"/>
      </path>))}
      {leaves.map(([x,y],i)=>(<ellipse key={i} cx={x} cy={y} rx="7" ry="3.5" fill="#22ff00" fillOpacity="0.14">
        <animate attributeName="fill-opacity" values="0.14;0.32;0.14" dur={`${3+i*0.6}s`} begin={`${i*0.45}s`} repeatCount="indefinite"/>
        <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`360 ${x} ${y}`} dur={`${14+i*2}s`} repeatCount="indefinite"/>
      </ellipse>))}
      <circle r="2.5" fill="#22ff00" fillOpacity="0.9"><animateMotion dur="13s" repeatCount="indefinite" path="M80,900 C100,700 60,590 130,440 C180,340 160,190 200,30"/></circle>
    </svg>
  );
}

const UserList = () => {
  const { user, token } = useAppContext();

  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [message, setMessage] = useState(null);

  const [showUserVideosModal, setShowUserVideosModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userVideos, setUserVideos] = useState([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [videoFilter, setVideoFilter] = useState("all");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [videoToDelete, setVideoToDelete] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState("asc");

  const [showDeleteUserModal, setShowDeleteUserModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteType, setDeleteType] = useState("soft");

  const [showActionSidebar, setShowActionSidebar] = useState(false);
  const [activeUser, setActiveUser] = useState(null);

  const baseUrl = "http://localhost:5000";
  const currentRole = user?.role || 'superadmin';
  const canManage = ["superadmin","platformadmin","supportadmin"].includes(user?.role);
  const isSuperAdmin = user?.role === "superadmin";

  const stats = useMemo(() => ({
    total: allUsers.length,
    verified: allUsers.filter(u => u.isVerified).length,
    banned: allUsers.filter(u => u.isBanned).length,
    active: allUsers.filter(u => !u.isBanned && !u.isDeactivated).length,
  }), [allUsers]);

  const fetchUsers = async () => {
    if (!user || !token) { setLoading(false); if (!token) setMessage({ type:"error", text:"Authentication token missing." }); return; }
    try {
      setLoading(true); setMessage(null);
      const res = await axios.get(`${baseUrl}/api/admin/users`, { headers: { Authorization: `Bearer ${token}` } });
      let data = Array.isArray(res.data) ? res.data : (res.data?.users || []);
      data = data.filter(u => !u.isDeleted);
      setAllUsers(data); setFilteredUsers(data);
    } catch (err) {
      const code = err.response?.status;
      setMessage({ type:"error", text: code===401?"Auth failed. Please login again.":code===403?"Access denied.":("Failed: "+(err.response?.data?.message||err.message)) });
      setAllUsers([]); setFilteredUsers([]);
    } finally { setLoading(false); }
  };

  const fetchUserVideos = async (userId) => {
    if (!token || !userId) return;
    setLoadingVideos(true);
    try {
      const [p,a,r,rej] = await Promise.all([getVideosByStatus(token,'pending',userId),getVideosByStatus(token,'approved',userId),getVideosByStatus(token,'released',userId),getVideosByStatus(token,'rejected',userId)]);
      const all = [...(p.videos||[]),...(a.videos||[]),...(r.videos||[]),...(rej.videos||[])];
      setUserVideos(all.filter((v,i,s)=>i===s.findIndex(x=>x._id===v._id)));
    } catch(e){ setMessage({type:"error",text:"Failed to load videos"}); }
    finally{ setLoadingVideos(false); }
  };

  const handleVideoSoftDelete = async (video, reason='') => {
    setActionLoadingId(video._id);
    try {
      const r = await adminSoftDeleteVideo(token, video._id, reason);
      if (r?.success) { setMessage({type:"success",text:`"${video.title}" moved to trash`}); if(selectedUser) await fetchUserVideos(selectedUser._id); }
      else setMessage({type:"error",text:r?.message||"Failed"});
    } catch(e){setMessage({type:"error",text:e.message||"Failed"});}
    finally{setActionLoadingId(null);setShowDeleteModal(false);setVideoToDelete(null);}
  };

  const handleVideoPermDelete = async (video, reason='') => {
    setActionLoadingId(video._id);
    try {
      const r = await adminPermanentDeleteVideo(token, video._id, reason);
      if (r?.success) { setMessage({type:"success",text:`"${video.title}" permanently deleted`}); if(selectedUser) await fetchUserVideos(selectedUser._id); }
      else setMessage({type:"error",text:r?.message||"Failed"});
    } catch(e){setMessage({type:"error",text:e.message||"Failed"});}
    finally{setActionLoadingId(null);setShowDeleteModal(false);setVideoToDelete(null);}
  };

  const handleVideoRestore = async (videoId) => {
    setActionLoadingId(videoId);
    try {
      const r = await adminRestoreVideo(token, videoId);
      if (r?.success) { setMessage({type:"success",text:"Video restored"}); if(selectedUser) await fetchUserVideos(selectedUser._id); }
      else setMessage({type:"error",text:r?.message||"Failed"});
    } catch(e){setMessage({type:"error",text:e.message||"Failed"});}
    finally{setActionLoadingId(null);}
  };

  const handleViewUserVideos = (u) => { setSelectedUser(u); setShowUserVideosModal(true); fetchUserVideos(u._id); };
  const handleVideoDeleteConfirm = (type, reason) => { if (!videoToDelete) return; if (type==='soft') handleVideoSoftDelete(videoToDelete,reason); else handleVideoPermDelete(videoToDelete,reason); };

  const filteredUserVideos = useMemo(() => videoFilter==='all' ? userVideos : userVideos.filter(v=>v.status===videoFilter), [userVideos,videoFilter]);
  const videoStats = useMemo(()=>({ all:userVideos.length, pending:userVideos.filter(v=>v.status==='pending').length, approved:userVideos.filter(v=>v.status==='approved').length, released:userVideos.filter(v=>v.status==='released').length, rejected:userVideos.filter(v=>v.status==='rejected').length, removed:userVideos.filter(v=>v.status==='removed').length }),[userVideos]);

  const handleUserDeleteClick = (u, type="soft") => {
    if (!isSuperAdmin) { setMessage({type:"error",text:"Only super admins can delete accounts."}); return; }
    if (u._id === user?._id) { setMessage({type:"error",text:"You cannot delete your own account."}); return; }
    setUserToDelete(u); setDeleteType(type); setShowDeleteUserModal(true);
  };

  const confirmUserDelete = async () => {
    if (!userToDelete||!token||!isSuperAdmin) return;
    setActionLoadingId(userToDelete._id);
    try {
      if (deleteType==="soft") {
        await axios.delete(`${baseUrl}/api/admin/users/${userToDelete._id}`, { headers:{Authorization:`Bearer ${token}`}, data:{reason:"Deleted by admin"} });
      } else {
        await axios.delete(`${baseUrl}/api/admin/users/${userToDelete._id}/permanent`, { headers:{Authorization:`Bearer ${token}`}, data:{confirm:true,reason:`Permanently deleted by superadmin ${user.email}`} });
      }
      setMessage({type:"success",text:`User ${deleteType==="soft"?"soft deleted":"permanently deleted"}.`});
      fetchUsers();
    } catch(e){ setMessage({type:"error",text:`Delete failed: ${e.response?.data?.message||e.message}`}); }
    finally{ setActionLoadingId(null); setShowDeleteUserModal(false); setUserToDelete(null); setShowActionSidebar(false); setActiveUser(null); }
  };

  const performAction = async (apiUrl, userId, successText, method='post') => {
    if (!canManage||!token) return;
    setActionLoadingId(userId);
    try {
      const cfg = { headers:{Authorization:`Bearer ${token}`} };
      if (method==='post') await axios.post(`${baseUrl}/api/admin${apiUrl}`,{},cfg);
      else await axios.put(`${baseUrl}/api/admin${apiUrl}`,{},cfg);
      setMessage({type:"success",text:successText}); fetchUsers(); setShowActionSidebar(false); setActiveUser(null);
    } catch(e){ setMessage({type:"error",text:"Action failed: "+(e.response?.data?.message||e.message)}); }
    finally{ setActionLoadingId(null); }
  };

  const handleDeactivateUser = async (userId) => {
    if (!isSuperAdmin) return;
    setActionLoadingId(userId);
    try {
      await axios.put(`${baseUrl}/api/admin/users/${userId}/deactivate`,{},{headers:{Authorization:`Bearer ${token}`}});
      setMessage({type:"success",text:"User deactivated."}); fetchUsers(); setShowActionSidebar(false); setActiveUser(null);
    } catch(e){setMessage({type:"error",text:"Deactivate failed: "+(e.response?.data?.message||e.message)});}
    finally{setActionLoadingId(null);}
  };

  const handleActivateUser = async (userId) => {
    if (!isSuperAdmin) return;
    setActionLoadingId(userId);
    try {
      await axios.put(`${baseUrl}/api/admin/users/${userId}/activate`,{},{headers:{Authorization:`Bearer ${token}`}});
      setMessage({type:"success",text:"User activated."}); fetchUsers(); setShowActionSidebar(false); setActiveUser(null);
    } catch(e){setMessage({type:"error",text:"Activate failed: "+(e.response?.data?.message||e.message)});}
    finally{setActionLoadingId(null);}
  };

  const handleBanToggle = (u) => performAction(`/users/${u._id}/${u.isBanned?'unban':'ban'}`, u._id, u.isBanned?"User unbanned.":"User banned.", 'post');
  const handleVerifyToggle = (u) => performAction(`/users/${u._id}/${u.isVerified?'unverify':'verify'}`, u._id, u.isVerified?"User unverified.":"User verified.", 'post');

  const openActionSidebar = (u) => { setActiveUser(u); setShowActionSidebar(true); };
  const closeActionSidebar = () => { setShowActionSidebar(false); setActiveUser(null); };

  useEffect(() => {
    let result = [...allUsers];
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      result = result.filter(u => (u.name&&u.name.toLowerCase().includes(t))||(u.email&&u.email.toLowerCase().includes(t)));
    }
    if (statusFilter!=="all") {
      if (statusFilter==="verified") result=result.filter(u=>u.isVerified);
      else if (statusFilter==="unverified") result=result.filter(u=>!u.isVerified);
      else if (statusFilter==="banned") result=result.filter(u=>u.isBanned);
      else if (statusFilter==="active") result=result.filter(u=>!u.isBanned&&!u.isDeactivated);
    }
    result.sort((a,b)=>{
      let av,bv;
      if (sortBy==="name"){av=a.name||"";bv=b.name||"";}
      else if (sortBy==="email"){av=a.email||"";bv=b.email||"";}
      else if (sortBy==="role"){av=a.role||"";bv=b.role||"";}
      else {av=new Date(a.createdAt||0);bv=new Date(b.createdAt||0);}
      return typeof av==='string'?(sortOrder==="asc"?av.localeCompare(bv):bv.localeCompare(av)):(sortOrder==="asc"?av-bv:bv-av);
    });
    setFilteredUsers(result);
  
  }, [searchTerm,statusFilter,sortBy,sortOrder,allUsers]);

  useEffect(() => {
    document.title = "User Management | Narra Admin";
    if (token) fetchUsers(); else { setLoading(false); setMessage({type:"error",text:"Authentication token missing."}); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const roleBadge = { superadmin:'ul-rb-super', platformadmin:'ul-rb-platform', supportadmin:'ul-rb-support', user:'ul-rb-user', creator:'ul-rb-creator' };
  const displayName = (u) => u.firstName&&u.lastName ? `${u.firstName} ${u.lastName}` : u.name || u.username || u.email;
  const initials = (u) => (displayName(u)||'U')[0].toUpperCase();

  if (!user || !canManage) {
    return (
      <div className={`ul-page ul-role-${currentRole}`}>
        <div className="ul-bg">{currentRole==='superadmin'&&<SuperBg/>}{currentRole==='platformadmin'&&<PlatformBg/>}{currentRole==='supportadmin'&&<SupportBg/>}</div>
        <div className="ul-grain"/>
        <div className="ul-access-denied">
          <div className="ul-ad__code">403</div>
          <h2>Access Denied</h2>
          <p>You do not have permission to view this page.</p>
          {!user && <button onClick={()=>window.location.href='/admin-login'} className="ul-btn ul-btn--accent">Go to Admin Login</button>}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={`ul-page ul-role-${currentRole}`}>
        <div className="ul-bg">{currentRole==='superadmin'&&<SuperBg/>}{currentRole==='platformadmin'&&<PlatformBg/>}{currentRole==='supportadmin'&&<SupportBg/>}</div>
        <div className="ul-grain"/>
        <div className="ul-loading"><div className="ul-ring"/><p>Loading users&hellip;</p></div>
      </div>
    );
  }

  return (
    <div className={`ul-page ul-role-${currentRole}`}>
      <div className="ul-bg">{currentRole==='superadmin'&&<SuperBg/>}{currentRole==='platformadmin'&&<PlatformBg/>}{currentRole==='supportadmin'&&<SupportBg/>}</div>
      <div className="ul-grain"/>

      {/* Video Delete Modal */}
      {showDeleteModal && videoToDelete && (
        <AdminVideoDeleteModal video={videoToDelete} user={user}
          onClose={()=>{setShowDeleteModal(false);setVideoToDelete(null);}}
          onConfirm={handleVideoDeleteConfirm} actionLoading={actionLoadingId===videoToDelete._id}/>
      )}

      {/* User Delete Confirm Modal */}
      {showDeleteUserModal && userToDelete && (
        <div className="ul-overlay" onClick={()=>{setShowDeleteUserModal(false);setUserToDelete(null);}}>
          <div className="ul-confirm-modal" onClick={e=>e.stopPropagation()}>
            <div className="ul-confirm-modal__top"/>
            <div className="ul-confirm-modal__hd">
              <h3>{deleteType==="soft"?"Move to Trash":"Permanent Delete"}</h3>
              <button onClick={()=>{setShowDeleteUserModal(false);setUserToDelete(null);}}>&#215;</button>
            </div>
            <div className="ul-confirm-modal__bd">
              <p>{deleteType==="soft" ? `Soft delete "${displayName(userToDelete)}"? They can be restored later.` : `Permanently delete "${displayName(userToDelete)}"? This action cannot be undone.`}</p>
              {deleteType==="permanent"&&<div className="ul-confirm-modal__warn">Warning — all user data will be permanently removed from the database.</div>}
              <div className="ul-confirm-modal__ft">
                <button className="ul-btn ul-btn--ghost" onClick={()=>{setShowDeleteUserModal(false);setUserToDelete(null);}}>Cancel</button>
                <button className={`ul-btn ${deleteType==='permanent'?'ul-btn--danger':'ul-btn--warn'}`}
                  onClick={confirmUserDelete} disabled={actionLoadingId===userToDelete._id}>
                  {actionLoadingId===userToDelete._id?"Deleting...":"Confirm"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Sidebar */}
      {showActionSidebar && activeUser && (
        <div className="ul-overlay" onClick={closeActionSidebar}>
          <aside className="ul-sidebar" onClick={e=>e.stopPropagation()}>
            <div className="ul-sidebar__top"/>
            <div className="ul-sidebar__hd">
              <h3>Moderate User</h3>
              <button onClick={closeActionSidebar}>&#215;</button>
            </div>
            <div className="ul-sidebar__user">
              <div className="ul-sidebar__avatar">{initials(activeUser)}</div>
              <div className="ul-sidebar__userinfo">
                <strong>{displayName(activeUser)}</strong>
                <span>{activeUser.email}</span>
                <span className={`ul-rb ${roleBadge[activeUser.role]||'ul-rb-user'}`}>{activeUser.role}</span>
              </div>
            </div>
            <div className="ul-sidebar__acts">
              <button className={`ul-sact ${activeUser.isBanned?'ul-sact--unban':'ul-sact--ban'}`}
                onClick={()=>handleBanToggle(activeUser)} disabled={actionLoadingId===activeUser._id}>
                <span className="ul-sact__n">{activeUser.isBanned?'Unban User':'Ban User'}</span>
                <span className="ul-sact__h">{activeUser.isBanned?'Restore user access':'Block user from platform'}</span>
              </button>
              <button className={`ul-sact ${activeUser.isVerified?'ul-sact--unverify':'ul-sact--verify'}`}
                onClick={()=>handleVerifyToggle(activeUser)} disabled={actionLoadingId===activeUser._id}>
                <span className="ul-sact__n">{activeUser.isVerified?'Unverify User':'Verify User'}</span>
                <span className="ul-sact__h">{activeUser.isVerified?'Remove verification badge':'Grant verified status'}</span>
              </button>
              {isSuperAdmin && (!activeUser.isDeactivated ? (
                <button className="ul-sact ul-sact--deact" onClick={()=>handleDeactivateUser(activeUser._id)} disabled={actionLoadingId===activeUser._id}>
                  <span className="ul-sact__n">Deactivate Account</span>
                  <span className="ul-sact__h">Temporarily disable login</span>
                </button>
              ) : (
                <button className="ul-sact ul-sact--act" onClick={()=>handleActivateUser(activeUser._id)} disabled={actionLoadingId===activeUser._id}>
                  <span className="ul-sact__n">Activate Account</span>
                  <span className="ul-sact__h">Re-enable login access</span>
                </button>
              ))}
              {isSuperAdmin && activeUser._id !== user?._id && (<>
                <button className="ul-sact ul-sact--trash" onClick={()=>{closeActionSidebar();handleUserDeleteClick(activeUser,"soft");}} disabled={actionLoadingId===activeUser._id}>
                  <span className="ul-sact__n">Move to Trash</span>
                  <span className="ul-sact__h">Soft delete — recoverable</span>
                </button>
                <button className="ul-sact ul-sact--perm" onClick={()=>{closeActionSidebar();handleUserDeleteClick(activeUser,"permanent");}} disabled={actionLoadingId===activeUser._id}>
                  <span className="ul-sact__n">Permanent Delete</span>
                  <span className="ul-sact__h">Cannot be undone</span>
                </button>
              </>)}
            </div>
            <div className="ul-sidebar__ft">
              <button className="ul-btn ul-btn--ghost ul-sidebar__cancel" onClick={closeActionSidebar}>Cancel</button>
            </div>
          </aside>
        </div>
      )}

      {/* User Videos Modal */}
      {showUserVideosModal && selectedUser && (
        <div className="ul-overlay" onClick={()=>setShowUserVideosModal(false)}>
          <div className="ul-vids-modal" onClick={e=>e.stopPropagation()}>
            <div className="ul-vids-modal__top"/>
            <div className="ul-vids-modal__hd">
              <div>
                <h2>Content by {displayName(selectedUser)}</h2>
                <span className="ul-vids-modal__id">ID: {selectedUser._id.slice(-8)}</span>
              </div>
              <button onClick={()=>setShowUserVideosModal(false)}>&#215;</button>
            </div>
            <div className="ul-vids-modal__bd">
              {/* Stats chips */}
              <div className="ul-vids-stats">
                {[['all','All',videoStats.all],['pending','Pending',videoStats.pending],['approved','Approved',videoStats.approved],['released','Released',videoStats.released],['rejected','Rejected',videoStats.rejected],['removed','Removed',videoStats.removed]].map(([k,l,v])=>(
                  <button key={k} className={`ul-vschip ${videoFilter===k?'ul-vschip--on':''} ul-vsc-${k}`} onClick={()=>setVideoFilter(k)}>
                    <span className="ul-vschip__n">{v}</span><span className="ul-vschip__l">{l}</span>
                  </button>
                ))}
              </div>

              {loadingVideos ? (
                <div className="ul-vids-loading"><div className="ul-ring ul-ring--sm"/><p>Loading content&hellip;</p></div>
              ) : filteredUserVideos.length===0 ? (
                <div className="ul-vids-empty"><p>No videos found for this filter.</p></div>
              ) : (
                <div className="ul-vids-list">
                  {filteredUserVideos.map(video=>(
                    <div key={video._id} className="ul-vid-row">
                      <div className="ul-vid-row__thumb">
                        <img src={video.thumbnailUrl?`${baseUrl}${video.thumbnailUrl}`:'/default-thumbnail.jpg'} alt={video.title}
                          onError={e=>{e.target.src='/default-thumbnail.jpg';}}/>
                      </div>
                      <div className="ul-vid-row__info">
                        <h4>{video.title}</h4>
                        <div className="ul-vid-row__meta">
                          <span className={`ul-vchip ul-vchip--${video.status}`}>{video.status}</span>
                          <span>{video.type}</span>
                          <span>{(video.views||0).toLocaleString()} views</span>
                        </div>
                        {video.description&&<p className="ul-vid-row__desc">{video.description.substring(0,100)}{video.description.length>100?'…':''}</p>}
                      </div>
                      <div className="ul-vid-row__acts">
                        {video.status!=='removed' ? (
                          <button className="ul-vact ul-vact--trash" onClick={()=>{setVideoToDelete(video);setShowDeleteModal(true);}} disabled={actionLoadingId===video._id}>Delete</button>
                        ) : (
                          <button className="ul-vact ul-vact--restore" onClick={()=>handleVideoRestore(video._id)} disabled={actionLoadingId===video._id}>Restore</button>
                        )}
                        {isSuperAdmin&&video.status==='removed'&&(
                          <button className="ul-vact ul-vact--perm" onClick={()=>{setVideoToDelete(video);setShowDeleteModal(true);}} disabled={actionLoadingId===video._id}>Permanent</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main page */}
      <div className="ul-shell">
        {/* Header */}
        <header className="ul-hdr">
          <div className="ul-hdr__bar"/>
          <h1 className="ul-headline">User Management</h1>
          <p className="ul-sub">
            {isSuperAdmin?'Super Admin — full access':user?.role==='platformadmin'?'Platform Admin':'Support Admin'}
          </p>
          <div className="ul-hdr__bar"/>
        </header>

        {/* Stats */}
        <div className="ul-statsrow">
          {[{k:'total',l:'Total Users',v:stats.total},{k:'active',l:'Active',v:stats.active},{k:'verified',l:'Verified',v:stats.verified},{k:'banned',l:'Banned',v:stats.banned}].map(({k,l,v})=>(
            <div key={k} className="ul-stat">
              <span className={`ul-stat__n ul-sn-${k}`}>{v}</span>
              <span className="ul-stat__l">{l}</span>
            </div>
          ))}
        </div>

        {/* Alerts */}
        {message&&(
          <div className={`ul-alert ul-alert--${message.type}`}>
            <span>{message.type==='error'?'Error':'Done'}</span>
            <span className="ul-alert__msg">{message.text}</span>
            <button onClick={()=>setMessage(null)}>&#215;</button>
          </div>
        )}

        {/* Filters */}
        <div className="ul-filters">
          <input className="ul-srch" type="text" placeholder="Search by name or email..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/>
          <div className="ul-filter-row">
            <select className="ul-sel" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
              <option value="banned">Banned</option>
            </select>
            <select className="ul-sel" value={sortBy} onChange={e=>setSortBy(e.target.value)}>
              <option value="name">Sort: Name</option>
              <option value="email">Sort: Email</option>
              <option value="role">Sort: Role</option>
              <option value="date">Sort: Joined</option>
            </select>
            <button className="ul-sortbtn" onClick={()=>setSortOrder(p=>p==="asc"?"desc":"asc")}>
              {sortOrder==="asc"?"ASC":"DESC"}
            </button>
            <button className="ul-clearbtn" onClick={()=>{setSearchTerm("");setStatusFilter("all");setSortBy("name");setSortOrder("asc");}}>Clear</button>
            <button className="ul-rfsh" onClick={fetchUsers}>Refresh</button>
          </div>
        </div>

        {/* User Cards */}
        {filteredUsers.length===0 ? (
          <div className="ul-empty">
            <div className="ul-empty__ring"/>
            <h3>No users found</h3>
            <p>Adjust your filters or search term</p>
          </div>
        ) : (
          <div className="ul-user-grid">
            {filteredUsers.map((u, idx) => (
              <div key={u._id} className="ul-ucard" style={{animationDelay:`${idx*0.03}s`}}>
                <div className="ul-ucard__top">
                  <div className="ul-ucard__avatar">{initials(u)}</div>
                  <div className="ul-ucard__id">···{u._id.slice(-6)}</div>
                </div>
                <div className="ul-ucard__bd">
                  <h3 className="ul-ucard__name">{displayName(u)}</h3>
                  <p className="ul-ucard__email">{u.email}</p>
                  <div className="ul-ucard__chips">
                    <span className={`ul-rb ${roleBadge[u.role]||'ul-rb-user'}`}>{u.role}</span>
                    {u.isVerified&&<span className="ul-fl ul-fl--verified">Verified</span>}
                    {u.isBanned&&<span className="ul-fl ul-fl--banned">Banned</span>}
                    {u.isDeactivated&&<span className="ul-fl ul-fl--deact">Deactivated</span>}
                    {!u.isBanned&&!u.isDeactivated&&<span className="ul-fl ul-fl--active">Active</span>}
                  </div>
                  <div className="ul-ucard__stats">
                    <span>Joined {new Date(u.createdAt).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
                    {u.balance!==undefined&&<span>${u.balance||0} balance</span>}
                  </div>
                </div>
                <div className="ul-ucard__ft">
                  <Link to={`/admin/users/${u._id}`} className="ul-ucard__profilebtn">View Profile</Link>
                  <button className="ul-ucard__vidbtn" onClick={()=>handleViewUserVideos(u)}>Videos</button>
                  <button className="ul-ucard__modbtn" onClick={()=>openActionSidebar(u)}>Moderate</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="ul-footer">
          <span>Showing {filteredUsers.length} of {allUsers.length} users</span>
          <button className="ul-rfsh" onClick={fetchUsers}>Refresh</button>
        </div>
      </div>
    </div>
  );
};

export default UserList;