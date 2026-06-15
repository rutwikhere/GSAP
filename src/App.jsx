import React, { useState, useEffect } from 'react';
import { 
  Video, Plus, Search, Calendar, User, Award, Clock, 
  CheckCircle, AlertCircle, X, ExternalLink, RefreshCw, Info, Link2
} from 'lucide-react';
import { fetchMeets, submitMeet, isRealFirebase } from './firebase';

const getAvatarStyle = (name) => {
  const colors = [
    { bg: '#e8f0fe', text: '#1a73e8' }, // Brand Blue
    { bg: '#fce8e6', text: '#ea4335' }, // Brand Red
    { bg: '#fef7e0', text: '#b06000' }, // Brand Yellow
    { bg: '#e6f4ea', text: '#34a853' }  // Brand Green
  ];
  const charCode = (name || 'A').trim().charCodeAt(0);
  const style = colors[charCode % colors.length];
  return {
    backgroundColor: style.bg,
    color: style.text,
    width: '44px',
    height: '44px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '600',
    fontFamily: 'var(--font-title)',
    flexShrink: 0
  };
};

const getTodayDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getNextHourTimeString = () => {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  d.setMinutes(0);
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

function App() {
  // Database States
  const [meets, setMeets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // all, active, upcoming, concluded

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    gid: '',
    meetLink: '',
    date: getTodayDateString(),
    time: getNextHourTimeString(),
    duration: '60'
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Toasts
  const [toasts, setToasts] = useState([]);

  // Time state to trigger automatic relative time recalculation
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch data on load
  const loadData = async (showToastFeedback = false) => {
    if (showToastFeedback) setRefreshing(true);
    try {
      const data = await fetchMeets();
      setMeets(data);
      if (showToastFeedback) {
        addToast("Meet directory updated successfully!", "success");
      }
    } catch (error) {
      console.error(error);
      addToast("Failed to fetch meeting links.", "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();

    // Recalculate meet statuses every 30 seconds by updating current time
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Toast Helper
  const addToast = (message, type = "success") => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Recalculate status for a single meet relative tocurrentTime
  const getMeetStatus = (timingStr, durationMinutes) => {
    const start = new Date(timingStr);
    const now = currentTime;
    const durationMs = (parseInt(durationMinutes, 10) || 60) * 60 * 1000; // Default 60 minutes
    const end = new Date(start.getTime() + durationMs);
    
    const diffStartMs = start.getTime() - now.getTime();
    const diffEndMs = end.getTime() - now.getTime();
    
    if (now >= start && now <= end) {
      const minsRemaining = Math.ceil(diffEndMs / (60 * 1000));
      return {
        status: "live",
        badgeText: "Live",
        countdownText: `Ends in ~${minsRemaining}m`,
        isJoinable: true
      };
    } else if (diffStartMs > 0 && diffStartMs <= 30 * 60 * 1000) {
      const minsRemaining = Math.ceil(diffStartMs / (60 * 1000));
      return {
        status: "near",
        badgeText: "Starting Soon",
        countdownText: `Starts in ${minsRemaining}m`,
        isJoinable: true
      };
    } else if (diffStartMs > 0) {
      // Friendly date-time format
      const options = { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' };
      const dateString = start.toLocaleDateString(undefined, options);
      
      const hoursRemaining = Math.ceil(diffStartMs / (3600 * 1000));
      let countdownText = `Starts in ${hoursRemaining}h`;
      if (hoursRemaining > 24) {
        countdownText = `Starts in ${Math.ceil(hoursRemaining / 24)}d`;
      }
      
      return {
        status: "upcoming",
        badgeText: "Upcoming",
        countdownText: dateString,
        isJoinable: true
      };
    } else {
      return {
        status: "concluded",
        badgeText: "Concluded",
        countdownText: "Concluded",
        isJoinable: false
      };
    }
  };

  // Form Validation
  const validateForm = () => {
    const errors = {};
    
    if (!formData.name.trim()) {
      errors.name = "Submitter name is required";
    } else if (formData.name.trim().length < 3) {
      errors.name = "Name must be at least 3 characters long";
    }

    if (!formData.gid.trim()) {
      errors.gid = "College Network GID is required";
    } else if (formData.gid.trim().length < 4) {
      errors.gid = "GID must be at least 4 characters";
    }



    const link = formData.meetLink.trim();
    if (!link) {
      errors.meetLink = "Meet Link is required";
    } else {
      const linkLower = link.toLowerCase();
      if (linkLower.includes("instagram.com") || linkLower.includes("linkedin.com") || linkLower.includes("insta.open") || linkLower.includes("lnkd.in")) {
        errors.meetLink = "Social media links (LinkedIn, Instagram) are strictly prohibited!";
      } else if (!linkLower.startsWith("https://meet.google.com/")) {
        errors.meetLink = "Must be a valid Meet link (starts with https://meet.google.com/)";
      } else {
        const codePart = link.replace("https://meet.google.com/", "").split("?")[0];
        if (!codePart || codePart.trim().length < 5) {
          errors.meetLink = "Invalid Meet code format. Example: meet.google.com/abc-defg-hij";
        }
      }
    }

    if (!formData.date || !formData.time) {
      errors.timing = "Both date and time details are required";
    } else {
      const selectedTime = new Date(`${formData.date}T${formData.time}`);
      const cutoff = new Date(Date.now() - 1.5 * 60 * 60 * 1000); // 1.5 hours ago
      
      if (isNaN(selectedTime.getTime())) {
        errors.timing = "Please enter a valid date and time";
      } else if (selectedTime < cutoff) {
        errors.timing = "Cannot submit a meeting that has already concluded";
      }
    }
    // Client-side duplicate check
    if (!errors.meetLink) {
      const isDuplicate = meets.some(
        meet => meet.meetLink.trim().toLowerCase() === link.trim().toLowerCase()
      );
      if (isDuplicate) {
        errors.meetLink = "This Meet link has already been added!";
      }
    }

    // Validate custom duration input
    const durationVal = parseInt(formData.duration, 10);
    if (!formData.duration.toString().trim()) {
      errors.duration = "Approximate duration is required";
    } else if (isNaN(durationVal) || durationVal <= 0) {
      errors.duration = "Duration must be a positive number of minutes";
    } else if (durationVal < 15) {
      errors.duration = "Duration should be at least 15 minutes";
    } else if (durationVal > 480) {
      errors.duration = "Duration cannot exceed 480 minutes (8 hours)";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Form Submit Handler
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      // Build ISO Date String
      const isoDateTime = new Date(`${formData.date}T${formData.time}`).toISOString();
      
      await submitMeet({
        name: formData.name,
        gid: formData.gid,
        meetLink: formData.meetLink,
        timing: isoDateTime,
        duration: parseInt(formData.duration, 10) || 60
      });

      addToast("Meet link listed successfully!", "success");
      setIsModalOpen(false);
      setFormData({
        name: '',
        gid: '',
        meetLink: '',
        date: getTodayDateString(),
        time: getNextHourTimeString(),
        duration: '60'
      });
      setFormErrors({});
      loadData();
    } catch (error) {
      console.error(error);
      addToast(error.message || "Failed to save. Check your connection.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear specific field error as user typess
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  // Compute stats
  const totalMeets = meets.length;
  const liveMeetsCount = meets.filter(m => getMeetStatus(m.timing, m.duration).status === 'live').length;
  const startingSoonCount = meets.filter(m => getMeetStatus(m.timing, m.duration).status === 'near').length;

  // Search and filter operations
  const filteredMeets = meets
    .map(meet => ({
      ...meet,
      statusDetails: getMeetStatus(meet.timing, meet.duration)
    }))
    .filter(meet => {
      // 1. Tab Filter
      if (activeTab === 'active') {
        return meet.statusDetails.status === 'live' || meet.statusDetails.status === 'near';
      }
      if (activeTab === 'upcoming') {
        return meet.statusDetails.status === 'upcoming';
      }
      if (activeTab === 'concluded') {
        return meet.statusDetails.status === 'concluded';
      }
      return true; // 'all'
    })
    .filter(meet => {
      // 2. Search Filter
      const term = searchTerm.toLowerCase().trim();
      if (!term) return true;
      return (
        meet.title.toLowerCase().includes(term) ||
        meet.name.toLowerCase().includes(term) ||
        meet.gid.toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      // Sort criteria:
      // Concluded matches are sorted in reverse chronological order (newest ended first)
      if (activeTab === 'concluded') {
        return new Date(b.timing) - new Date(a.timing);
      }
      // Standard tabs sorted chronologically (earliest first)
      return new Date(a.timing) - new Date(b.timing);
    });

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="nav-left">
          <div className="logo-container">
            <span className="logo-dot blue"></span>
            <span className="logo-dot red"></span>
            <span className="logo-dot yellow"></span>
            <span className="logo-dot green"></span>
          </div>
          <h1 className="nav-title">College Networks <span>MeetPortal</span></h1>
        </div>
        
        <div className="nav-right">
          {isRealFirebase ? (
            <div className="badge-db firebase" title="Fully syncs to Firebase Cloud Firestore">
              <CheckCircle size={14} /> Cloud Firestore Sync Active
            </div>
          ) : (
            <div className="badge-db local" title="No environment configuration detected. Running locally in browser database sandbox.">
              <AlertCircle size={14} /> Local Sandbox Mode
            </div>
          )}
          <button 
            className="btn btn-secondary" 
            onClick={() => loadData(true)} 
            disabled={refreshing}
            style={{ padding: '8px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Reload meet links"
          >
            <RefreshCw size={16} className={refreshing ? "spin-animation" : ""} style={{ animation: refreshing ? 'spin-animation 1s linear infinite' : 'none' }} />
          </button>
        </div>
      </header>

      {/* Hero Banner Section */}
      <section className="hero-section">
        <div className="hero-bg-shapes"></div>
        <div className="hero-content">
          <div className="hero-badge">College Networks</div>
          <h2 className="hero-title">Centralized Meet Schedule Directory</h2>
          <p className="hero-subtitle">
            Members: Stop flooding WhatsApp groups with meet links! Post your meeting links here. They will be sorted chronologically and flagged with Live/Starting Soon indicators automatically.
          </p>
          <div className="hero-actions">
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus size={18} /> Add Your Meet Link
            </button>
            <button className="btn btn-secondary" onClick={() => {
              const el = document.getElementById('meets-section');
              el?.scrollIntoView({ behavior: 'smooth' });
            }}>
              Browse Directory
            </button>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="main-content" id="meets-section">
        {/* Search and Section Title */}
        <div className="content-header">
          <div className="search-wrapper">
            <Search size={18} className="search-icon" />
            <input 
              type="text" 
              className="search-input"
              placeholder="Search by host or GID..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)} style={{ padding: '8px 18px', fontSize: '14px' }}>
            <Plus size={16} /> Add Link
          </button>
        </div>

        {/* Tab Filters */}
        <div className="tabs-container">
          <button 
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All Scheduled Sessions
          </button>
          <button 
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Live & Starting Soon ({liveMeetsCount + startingSoonCount})
          </button>
          <button 
            className={`tab-btn ${activeTab === 'upcoming' ? 'active' : ''}`}
            onClick={() => setActiveTab('upcoming')}
          >
            Upcoming
          </button>
          <button 
            className={`tab-btn ${activeTab === 'concluded' ? 'active' : ''}`}
            onClick={() => setActiveTab('concluded')}
          >
            History / Concluded
          </button>
        </div>

        {/* Listings Display */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--neutral-gray)' }}>
            <RefreshCw size={24} className="spin-animation" style={{ animation: 'spin-animation 1.5s linear infinite', margin: '0 auto 12px auto' }} />
            <p>Loading directory schedules...</p>
          </div>
        ) : filteredMeets.length > 0 ? (
          <div className="meets-list">
            {filteredMeets.map((meet) => {
              const avatarStyle = getAvatarStyle(meet.name);
              const firstLetter = (meet.name || 'A').trim().charAt(0).toUpperCase();
              return (
                <div className={`meet-card`} key={meet.id}>
                  
                  {/* Left Side: Avatar and Meet Details */}
                  <div className="meet-card-left">
                    <div className="meet-icon-avatar" style={avatarStyle}>
                      {firstLetter}
                    </div>
                    
                    <div className="meet-info">
                      <div className="meet-title-row">
                        <h3 className="meet-title">{meet.name}</h3>
                        <span className={`status-badge ${meet.statusDetails.status}`}>
                          {meet.statusDetails.status === 'live' || meet.statusDetails.status === 'near' ? <span className="pulse-dot"></span> : null}
                          {meet.statusDetails.badgeText}
                        </span>
                      </div>

                      <div className="meet-meta">
                        <div className="meet-meta-item">
                          <Award size={14} />
                          <span style={{ fontSize: '11px', fontFamily: 'monospace', backgroundColor: 'var(--neutral-light)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)' }}>
                            {meet.gid}
                          </span>
                        </div>
                        <div className="meet-meta-item">
                          <Calendar size={14} />
                          <span className={`meet-countdown ${meet.statusDetails.status}`}>
                            {meet.statusDetails.countdownText}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Side: Join Button and Status */}
                  <div className="meet-card-right">
                    {meet.statusDetails.isJoinable ? (
                      <a 
                        href={meet.meetLink} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="btn btn-join"
                      >
                        Join Meet <ExternalLink size={14} />
                      </a>
                    ) : (
                      <button className="btn btn-disabled" disabled>
                        Session Concluded
                      </button>
                    )}
                    <div style={{ fontSize: '10px', color: 'var(--neutral-gray)', fontFamily: 'monospace', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={meet.meetLink}>
                      {meet.meetLink.replace("https://", "")}
                    </div>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Video size={48} className="empty-state-icon" />
            <h3 className="empty-state-title">No meetings found</h3>
            <p className="empty-state-desc">
              {searchTerm 
                ? "No listings match your search query. Try typing another topic, host name, or GID."
                : "No meeting sessions are currently listed in this category. Be the first to share one!"}
            </p>
            {!searchTerm && (
              <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
                <Plus size={18} /> Submit Meet Link
              </button>
            )}
          </div>
        )}
      </main>

      {/* Add Meet Link Modal Form */}
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header modal-header-top">
              <h3 className="modal-title">List Your Meet Link</h3>
              <button className="btn-close" onClick={() => {
                setIsModalOpen(false);
                setFormErrors({});
              }}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formErrors.general && (
                  <div style={{ backgroundColor: 'var(--brand-red-light)', color: 'var(--brand-red)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px' }}>
                    <AlertCircle size={16} /> {formErrors.general}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Member Name</label>
                  <input 
                    type="text" 
                    name="name" 
                    className={`form-input ${formErrors.name ? 'error' : ''}`}
                    placeholder="e.g. Rahul Sharma"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                  {formErrors.name && <span className="error-text">{formErrors.name}</span>}
                </div>

                <div className="form-group">
                  <label className="form-label">Member GID (ID)</label>
                  <input 
                    type="text" 
                    name="gid" 
                    className={`form-input ${formErrors.gid ? 'error' : ''}`}
                    placeholder="e.g. GID-2026-1024"
                    value={formData.gid}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                  <span className="form-tip">Provide your unique College Networks GID.</span>
                  {formErrors.gid && <span className="error-text">{formErrors.gid}</span>}
                </div>



                <div className="form-group">
                  <label className="form-label">Meet Link</label>
                  <input 
                    type="text" 
                    name="meetLink" 
                    className={`form-input ${formErrors.meetLink ? 'error' : ''}`}
                    placeholder="https://meet.google.com/abc-defg-hij"
                    value={formData.meetLink}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                  <span className="form-tip">Only meet.google.com URLs are accepted. Instagram/LinkedIn links are blocked.</span>
                  {formErrors.meetLink && <span className="error-text">{formErrors.meetLink}</span>}
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Meet Date</label>
                    <div className="input-with-icon" style={{ position: 'relative' }}>
                      <Calendar size={16} className="input-icon-left" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-gray)', pointerEvents: 'none' }} />
                      <input 
                        type="date" 
                        name="date" 
                        className={`form-input ${formErrors.timing ? 'error' : ''}`}
                        style={{ paddingLeft: '38px' }}
                        value={formData.date}
                        onChange={handleInputChange}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Start Time</label>
                    <div className="input-with-icon" style={{ position: 'relative' }}>
                      <Clock size={16} className="input-icon-left" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--neutral-gray)', pointerEvents: 'none' }} />
                      <input 
                        type="time" 
                        name="time" 
                        className={`form-input ${formErrors.timing ? 'error' : ''}`}
                        style={{ paddingLeft: '38px' }}
                        value={formData.time}
                        onChange={handleInputChange}
                        disabled={submitting}
                      />
                    </div>
                  </div>
                </div>
                {formErrors.timing && <span className="error-text" style={{ marginTop: '-8px', display: 'block', marginBottom: '16px' }}>{formErrors.timing}</span>}

                <div className="form-group">
                  <label className="form-label">Approx. Duration (minutes) <span style={{ color: 'var(--brand-red)', fontSize: '11px', fontWeight: 'normal' }}>*approx</span></label>
                  <input 
                    type="number" 
                    name="duration" 
                    className={`form-input ${formErrors.duration ? 'error' : ''}`}
                    placeholder="e.g. 60"
                    min="15"
                    max="480"
                    value={formData.duration}
                    onChange={handleInputChange}
                    disabled={submitting}
                  />
                  <span className="form-tip">Enter estimated meeting length in minutes (e.g. 60 for 1 hour, 90 for 1.5 hours). This is approximate.</span>
                  {formErrors.duration && <span className="error-text">{formErrors.duration}</span>}
                </div>
              </div>

              <div className="modal-footer">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setIsModalOpen(false);
                    setFormErrors({});
                  }}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <RefreshCw size={14} className="spin-animation" style={{ animation: 'spin-animation 1s linear infinite' }} /> Saving...
                    </>
                  ) : "Register Meet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div className={`toast ${toast.type}`} key={toast.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {toast.type === 'success' ? <CheckCircle size={16} style={{ color: 'var(--brand-green)' }} /> : <AlertCircle size={16} style={{ color: 'var(--brand-red)' }} />}
              <span>{toast.message}</span>
            </div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer className="footer">
        <p>College Networks • Meet Link Portal</p>
        <p style={{ fontSize: '11px' }}>
          This tool is designed to prevent chat spam and ensure structured scheduling. Created for <span className="brand">College Network Members</span>.
        </p>
      </footer>
      
      {/* Keyframe spinners style injection */}
      <style>{`
        @keyframes spin-animation {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
