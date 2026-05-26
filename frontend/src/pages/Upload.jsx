/* eslint-disable no-unused-vars */
/**
 * File: frontend/src/pages/Upload.jsx
 * CLAW MARK THEME - now reads accent from ThemeContext
 * Movie mode = green tint label, Series mode = purple tint label
 * All claw/scar/blood decorations inherit from global --theme-accent
 * FIXED: isPaid defaults to false
 * FIXED: onProgress callback
 * FIXED: price field only appended when isPaid AND price is non-empty
 * FIXED: language field consistently included
 */

import React, { useState, useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { useTheme } from "../context/ThemeContext";
import "./Upload.css";

const MOVIE_TYPES = [
  "Drama", "Romance", "Comedy", "Thriller", "Horror",
  "Action", "Sci-Fi", "Fantasy", "Crime", "Mystery",
  "Adventure", "Documentary", "Animation"
];

const AGE_RATINGS = ["G", "PG", "13+", "16+", "18+"];

export default function Upload() {
  const { user, uploadVideo, addNotification, canUpload, token } = useAppContext();
  const { theme } = useTheme();

  const [mode, setMode] = useState(() => {
    const savedMode = localStorage.getItem('uploadMode');
    return savedMode === 'movie' || savedMode === 'series' ? savedMode : 'movie';
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [dragOver, setDragOver] = useState({});
  const [isSwitching, setIsSwitching] = useState(false);
  const [titleKey, setTitleKey] = useState(0);

  useEffect(() => {
    localStorage.setItem('uploadMode', mode);
  }, [mode]);

  // Use the global theme accent for both modes.
  // Mode label colors are just text indicators, not overriding the background theme.
  const modeLabel = {
    movie:  { title: "FOREST CINEMA",  sub: "Plant your story in the digital jungle" },
    series: { title: "SHADOW SAGA",    sub: "Weave your epic into the shadows" },
  };

  const baseState = {
    title: "", description: "", movieTypes: [], ageRating: "", tags: "",
    playlist: "", trailer: null, thumbnail: null, video: null,
    isSponsored: false, sponsorDescription: "", isFundraiser: false,
    fundraiserDescription: "", releaseOption: "immediate", releaseDate: "",
    status: "pending", isPaid: false, price: "", currency: "USD",
    seasons: [], language: "English", subtitles: "",
    commentsDisabled: false, isPrivate: false,
  };

  const [movie, setMovie] = useState({ ...baseState });
  const [series, setSeries] = useState({ ...baseState });

  const data = mode === "movie" ? movie : series;
  const setData = mode === "movie" ? setMovie : setSeries;

  const handleModeSwitch = (newMode) => {
    if (newMode === mode) return;
    setIsSwitching(true);
    setTimeout(() => {
      setMode(newMode);
      setTitleKey(prev => prev + 1);
      setTimeout(() => setIsSwitching(false), 80);
    }, 10);
  };

  const addSeason = () => {
    setSeries(prev => ({
      ...prev,
      seasons: [...prev.seasons, { title: "", description: "", trailer: null, episodes: [] }]
    }));
  };

  const removeSeason = (sIndex) => {
    if (window.confirm("Remove this season from the saga?")) {
      const copy = [...series.seasons];
      copy.splice(sIndex, 1);
      setSeries({ ...series, seasons: copy });
    }
  };

  const addEpisode = (sIndex) => {
    const copy = [...series.seasons];
    copy[sIndex].episodes.push({ title: "", description: "", trailer: null, video: null, thumbnail: null });
    setSeries({ ...series, seasons: copy });
  };

  const removeEpisode = (sIndex, eIndex) => {
    if (window.confirm("Remove this episode?")) {
      const copy = [...series.seasons];
      copy[sIndex].episodes.splice(eIndex, 1);
      setSeries({ ...series, seasons: copy });
    }
  };

  const updateSeason = (sIndex, field, value) => {
    const copy = [...series.seasons];
    copy[sIndex][field] = value;
    setSeries({ ...series, seasons: copy });
  };

  const updateEpisode = (sIndex, eIndex, field, value) => {
    const copy = [...series.seasons];
    copy[sIndex].episodes[eIndex][field] = value;
    setSeries({ ...series, seasons: copy });
  };

  const handleDragEnter = (key) => setDragOver(prev => ({ ...prev, [key]: true }));
  const handleDragLeave = (key) => setDragOver(prev => ({ ...prev, [key]: false }));
  const handleDrop = (e, key, setter) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      setter(prev => ({ ...prev, [key]: file }));
      setDragOver(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) { alert("You must be logged in to upload"); return; }
    if (!canUpload) { alert("Your account cannot upload videos"); return; }
    if (!data.title?.trim()) { alert("Title is required"); return; }
    if (!data.description?.trim()) { alert("Description is required"); return; }
    if (!data.movieTypes.length) { alert("Select at least one genre"); return; }
    if (!data.ageRating) { alert("Age rating is required"); return; }
    if (data.isSponsored && !data.sponsorDescription.trim()) { alert("Sponsor explanation required"); return; }
    if (data.isFundraiser && !data.fundraiserDescription.trim()) { alert("Fundraiser explanation required"); return; }
    if (data.isPaid && (!data.price || isNaN(parseFloat(data.price)) || parseFloat(data.price) <= 0)) {
      alert("A valid price is required for paid content"); return;
    }
    if (mode === "movie" && !data.video) { alert("Movie video file is required"); return; }
    if (mode === "movie" && !data.thumbnail) { alert("Thumbnail is required"); return; }
    if (mode === "series" && !data.seasons.length) { alert("Add at least one season"); return; }
    if (mode === "series") {
      if (!data.thumbnail) { alert("Series thumbnail (Saga Cover Art) is required"); return; }
      for (let s of data.seasons) {
        for (let ep of s.episodes) {
          if (!ep.title?.trim()) { alert("All episodes must have a title"); return; }
          if (!ep.video) { alert("All episodes must have a video file"); return; }
        }
      }
    }

    setIsSubmitting(true);
    setUploadProgress({});

    try {
      const formData = new FormData();
      formData.append("type", mode);
      formData.append("title", data.title.trim());
      formData.append("description", data.description.trim());
      formData.append("genre", JSON.stringify(data.movieTypes));
      formData.append("ageRating", data.ageRating);

      const tagsArray = data.tags ? data.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
      formData.append("tags", JSON.stringify(tagsArray));
      formData.append("language", data.language || "English");

      const subtitlesArray = data.subtitles ? data.subtitles.split(",").map(s => s.trim()).filter(Boolean) : [];
      formData.append("subtitles", JSON.stringify(subtitlesArray));

      formData.append("isSponsored", data.isSponsored ? "true" : "false");
      if (data.isSponsored && data.sponsorDescription) formData.append("sponsorDescription", data.sponsorDescription.trim());

      formData.append("isFundraiser", data.isFundraiser ? "true" : "false");
      if (data.isFundraiser && data.fundraiserDescription) formData.append("fundraiserDescription", data.fundraiserDescription.trim());

      formData.append("isPaid", data.isPaid ? "true" : "false");
      if (data.isPaid && data.price && parseFloat(data.price) > 0) {
        formData.append("price", parseFloat(data.price).toString());
        formData.append("currency", data.currency || "USD");
      }

      formData.append("releaseOption", data.releaseOption);
      if (data.releaseOption === "schedule" && data.releaseDate) formData.append("releaseDate", data.releaseDate);

      formData.append("commentsDisabled", data.commentsDisabled ? "true" : "false");
      formData.append("isPrivate", data.isPrivate ? "true" : "false");
      formData.append("contentFlags", JSON.stringify({ violence: false, sex: false, language: false, graphic: false }));

      if (data.thumbnail) formData.append("thumbnail", data.thumbnail);
      else { alert("Thumbnail required"); setIsSubmitting(false); return; }

      if (mode === "movie") {
        if (data.video) formData.append("video", data.video);
        if (data.trailer) formData.append("trailer", data.trailer);
      }

      if (mode === "series") {
        const seasonsPayload = data.seasons.map((season, sIndex) => ({
          seasonNumber: sIndex + 1,
          title: season.title || `Season ${sIndex + 1}`,
          description: season.description || "",
          episodes: season.episodes.map((episode, eIndex) => ({
            episodeNumber: eIndex + 1, title: episode.title, description: episode.description || ""
          }))
        }));
        formData.append("seasons", JSON.stringify(seasonsPayload));

        data.seasons.forEach((season, sIndex) => {
          if (season.trailer) formData.append(`season-${sIndex}-trailer`, season.trailer);
        });

        data.seasons.forEach((season, sIndex) => {
          season.episodes.forEach((episode, eIndex) => {
            if (episode.video) formData.append(`season-${sIndex}-episode-${eIndex}-video`, episode.video);
            if (episode.trailer) formData.append(`season-${sIndex}-episode-${eIndex}-trailer`, episode.trailer);
          });
        });
      }

      const result = await uploadVideo(formData, (percent) => {
        setUploadProgress({ main: percent });
      });

      if (result && result.success) {
        addNotification({ type: "system", text: `${mode === "movie" ? "Movie" : "Series"} "${data.title}" submitted for review` });
        alert(`✅ ${mode === "movie" ? "Movie" : "Series"} submitted for review`);
        setMovie({ ...baseState });
        setSeries({ ...baseState });
        setUploadProgress({});
      } else {
        throw new Error(result?.message || 'Upload failed');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert("Upload failed: " + (err.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!user) return <div className="upload-wrapper"><p>Loading...</p></div>;

  if (!canUpload) {
    return (
      <div className="upload-wrapper restricted">
        <div className="upload-restricted">
          <div className="claw-mark-icon"></div>
          <h2>ACCESS DENIED</h2>
          <p>Your account cannot upload content to the jungle.</p>
          <p>Contact support if you believe this is an error.</p>
        </div>
      </div>
    );
  }

  // Use global theme accent for borders/highlights
  const accent = theme.accent;
  const accentLight = theme.accentLight || theme.accent;

  return (
    <div className={`upload-wrapper ${mode} ${isSwitching ? 'switching' : ''}`}>
      {/* CLAW MARK BACKGROUND — inherits --theme-accent from :root via theme.css */}
      <div className="claw-background">
        <div className="claw claw-1"></div><div className="claw claw-2"></div>
        <div className="claw claw-3"></div><div className="claw claw-4"></div>
        <div className="claw claw-5"></div><div className="claw claw-6"></div>
        <div className="claw claw-7"></div><div className="claw claw-8"></div>
        <div className="claw claw-9"></div><div className="claw claw-10"></div>
        <div className="claw claw-11"></div><div className="claw claw-12"></div>
        <div className="scar-diagonal scar-diag-1"></div><div className="scar-diagonal scar-diag-2"></div>
        <div className="scar-diagonal scar-diag-3"></div><div className="scar-diagonal scar-diag-4"></div>
        <div className="scratch-horizontal scratch-h-1"></div><div className="scratch-horizontal scratch-h-2"></div>
        <div className="scratch-horizontal scratch-h-3"></div><div className="scratch-horizontal scratch-h-4"></div>
        <div className="scratch-horizontal scratch-h-5"></div>
        <div className="scratch-vertical scratch-v-1"></div><div className="scratch-vertical scratch-v-2"></div>
        <div className="scratch-vertical scratch-v-3"></div><div className="scratch-vertical scratch-v-4"></div>
        <div className="triple-claw triple-1"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-2"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-3"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-4"><span></span><span></span><span></span></div>
        <div className="scar-x scar-x-1"></div><div className="scar-x scar-x-2"></div><div className="scar-x scar-x-3"></div>
      </div>

      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>

      <form className="upload-page" onSubmit={handleSubmit}>
        <header className="upload-header">
          <div className="header-scar" style={{ background: accent }}></div>
          <h1 key={titleKey} className="upload-title" style={{
            background: `linear-gradient(135deg, #fff, ${accent})`,
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            display: 'inline-block',
            width: 'auto'
          }}>
            {modeLabel[mode].title}
          </h1>
          <p>{modeLabel[mode].sub}</p>
        </header>

        {/* Tab Switcher */}
        <div className="mode-switch">
          <button
            type="button"
            className={`mode-btn movie ${mode === "movie" ? "active" : ""}`}
            onClick={() => handleModeSwitch("movie")}
            style={mode === "movie" ? { color: accent } : {}}
          >
            FOREST CINEMA
          </button>
          <button
            type="button"
            className={`mode-btn series ${mode === "series" ? "active" : ""}`}
            onClick={() => handleModeSwitch("series")}
            style={mode === "series" ? { color: accent } : {}}
          >
            SHADOW SAGA
          </button>
        </div>

        {/* BASIC INFO */}
        <section className="upload-section" style={{ borderColor: accent }}>
          <h2><span className="section-icon" style={{ color: accent }}>▸</span>{mode === "movie" ? "THE STORY" : "THE EPIC"}</h2>
          <input placeholder="Title of your creation *" value={data.title} onChange={e => setData({ ...data, title: e.target.value })} style={{ borderColor: accent }} required />
          <textarea placeholder="Describe your vision... *" value={data.description} onChange={e => setData({ ...data, description: e.target.value })} style={{ borderColor: accent }} rows="4" required />
          <input placeholder="Collection / Playlist (optional)" value={data.playlist} onChange={e => setData({ ...data, playlist: e.target.value })} style={{ borderColor: accent }} />
        </section>

        {/* CLASSIFICATION */}
        <section className="upload-section" style={{ borderColor: accent }}>
          <h2><span className="section-icon" style={{ color: accent }}>▸</span>CLASSIFICATION</h2>
          <select className="genre-select" multiple value={data.movieTypes} onChange={e => {
            const options = Array.from(e.target.selectedOptions).map(o => o.value);
            setData({ ...data, movieTypes: options });
          }} style={{ borderColor: accent }} required>
            {MOVIE_TYPES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={data.ageRating} onChange={e => setData({ ...data, ageRating: e.target.value })} style={{ borderColor: accent }} required>
            <option value="">Select Age Rating *</option>
            {AGE_RATINGS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <input placeholder="Tags (comma separated)" value={data.tags} onChange={e => setData({ ...data, tags: e.target.value })} style={{ borderColor: accent }} />
          <input placeholder="Subtitles (comma separated languages)" value={data.subtitles} onChange={e => setData({ ...data, subtitles: e.target.value })} style={{ borderColor: accent }} />
        </section>

        {/* SPECIAL FLAGS */}
        <section className="upload-section" style={{ borderColor: accent }}>
          <h2><span className="section-icon" style={{ color: accent }}>▸</span>SPECIAL MARKS</h2>
          <label className="checkbox-label">
            <input type="checkbox" checked={data.isSponsored} onChange={e => setData({ ...data, isSponsored: e.target.checked, isFundraiser: false })} style={{ accentColor: accent }} />
            <span>Sponsored Content</span>
          </label>
          {data.isSponsored && <textarea placeholder="Sponsor explanation *" value={data.sponsorDescription} onChange={e => setData({ ...data, sponsorDescription: e.target.value })} style={{ borderColor: accent }} required />}

          <label className="checkbox-label">
            <input type="checkbox" checked={data.isFundraiser} onChange={e => setData({ ...data, isFundraiser: e.target.checked, isSponsored: false })} style={{ accentColor: accent }} />
            <span>Fundraiser Campaign</span>
          </label>
          {data.isFundraiser && <textarea placeholder="Fundraiser explanation *" value={data.fundraiserDescription} onChange={e => setData({ ...data, fundraiserDescription: e.target.value })} style={{ borderColor: accent }} required />}

          <div className="release-group">
            <label>Release Strategy:</label>
            <select value={data.releaseOption} onChange={e => setData({ ...data, releaseOption: e.target.value })} style={{ borderColor: accent }}>
              <option value="immediate">Launch after approval</option>
              <option value="schedule">Schedule for later</option>
            </select>
          </div>
          {data.releaseOption === "schedule" && (
            <input type="datetime-local" value={data.releaseDate} onChange={e => setData({ ...data, releaseDate: e.target.value })} style={{ borderColor: accent }} />
          )}
        </section>

        {/* MONETIZE */}
        <section className="upload-section" style={{ borderColor: accent }}>
          <h2><span className="section-icon" style={{ color: accent }}>▸</span>VALUE</h2>
          <label className="checkbox-label">
            <input type="checkbox" checked={data.isPaid} onChange={e => setData({ ...data, isPaid: e.target.checked, price: e.target.checked ? data.price : "" })} style={{ accentColor: accent }} />
            <span>Paid Content</span>
          </label>
          {data.isPaid ? (
            <input type="number" placeholder="Price (USD) *" min="0.01" step="0.01" value={data.price} onChange={e => setData({ ...data, price: e.target.value })} style={{ borderColor: accent }} required />
          ) : (
            <small>This content will be free to all viewers</small>
          )}
        </section>

        {/* SETTINGS */}
        <section className="upload-section" style={{ borderColor: accent }}>
          <h2><span className="section-icon" style={{ color: accent }}>▸</span>GUARDIAN SETTINGS</h2>
          <label className="checkbox-label">
            <input type="checkbox" checked={data.commentsDisabled} onChange={e => setData({ ...data, commentsDisabled: e.target.checked })} style={{ accentColor: accent }} />
            <span>Silence the Voices (Disable Comments)</span>
          </label>
          <label className="checkbox-label">
            <input type="checkbox" checked={data.isPrivate} onChange={e => setData({ ...data, isPrivate: e.target.checked })} style={{ accentColor: accent }} />
            <span>Veil of Secrecy (Private until release)</span>
          </label>
        </section>

        {/* MOVIE MEDIA */}
        {mode === "movie" && (
          <section className="upload-section movie-media" style={{ borderColor: accent }}>
            <h2><span className="section-icon" style={{ color: accent }}>▸</span>THE VISION</h2>
            {["thumbnail", "video", "trailer"].map(key => (
              <div
                key={key}
                className={`file-input-wrapper ${dragOver[key] ? "drag-over" : ""} ${!data[key] && key !== 'trailer' ? 'required' : ''}`}
                onDragOver={e => e.preventDefault()}
                onDragEnter={() => handleDragEnter(key)}
                onDragLeave={() => handleDragLeave(key)}
                onDrop={e => handleDrop(e, key, file => setMovie(prev => ({ ...prev, [key]: file })))}
                style={dragOver[key] ? { borderColor: accent } : {}}
              >
                <label>{key === "thumbnail" ? "Poster Image" : key === "video" ? "The Film" : "Teaser Trailer"}{key !== 'trailer' ? ' *' : ''}</label>
                <input type="file" accept={key === "thumbnail" ? "image/*" : "video/*"} onChange={e => setMovie({ ...movie, [key]: e.target.files[0] })} required={key !== 'trailer'} />
                {key === "thumbnail" && movie.thumbnail && <img className="preview-img" src={URL.createObjectURL(movie.thumbnail)} alt="Preview" />}
                {["video", "trailer"].includes(key) && movie[key] && <video className="preview-video" controls src={URL.createObjectURL(movie[key])} />}
              </div>
            ))}
          </section>
        )}

        {/* SERIES */}
        {mode === "series" && (
          <section className="upload-section series-structure" style={{ borderColor: accent }}>
            <h2><span className="section-icon" style={{ color: accent }}>▸</span>THE SAGA</h2>

            <div
              className={`file-input-wrapper ${dragOver['series-thumbnail'] ? "drag-over" : ""} ${!series.thumbnail ? 'required' : ''}`}
              onDragOver={e => e.preventDefault()}
              onDragEnter={() => handleDragEnter('series-thumbnail')}
              onDragLeave={() => handleDragLeave('series-thumbnail')}
              onDrop={e => handleDrop(e, 'series-thumbnail', file => setSeries(prev => ({ ...prev, thumbnail: file })))}
            >
              <label>Saga Cover Art *</label>
              <input type="file" accept="image/*" onChange={e => setSeries({ ...series, thumbnail: e.target.files[0] })} required />
              {series.thumbnail && <img className="preview-img" src={URL.createObjectURL(series.thumbnail)} alt="Preview" />}
            </div>

            {series.seasons.map((s, sIdx) => (
              <div key={sIdx} className="season-block" style={{ borderColor: `${accent}55` }}>
                <h3>CHAPTER {sIdx + 1}</h3>
                <input placeholder={`Chapter ${sIdx + 1} Title *`} value={s.title} onChange={e => updateSeason(sIdx, "title", e.target.value)} style={{ borderColor: accent }} required />
                <textarea placeholder={`Chapter ${sIdx + 1} Summary`} value={s.description} onChange={e => updateSeason(sIdx, "description", e.target.value)} style={{ borderColor: accent }} />
                <div className="season-actions">
                  <button type="button" className="add-episode" style={{ borderColor: accent, color: accent }} onClick={() => addEpisode(sIdx)}>+ Add Episode</button>
                  <button type="button" className="danger" onClick={() => removeSeason(sIdx)}>Remove Chapter</button>
                </div>
                <div
                  className={`file-input-wrapper ${dragOver[`season-${sIdx}-trailer`] ? "drag-over" : ""}`}
                  onDragOver={e => e.preventDefault()}
                  onDragEnter={() => handleDragEnter(`season-${sIdx}-trailer`)}
                  onDragLeave={() => handleDragLeave(`season-${sIdx}-trailer`)}
                  onDrop={e => handleDrop(e, `season-${sIdx}-trailer`, file => updateSeason(sIdx, "trailer", file))}
                >
                  <label>Chapter Trailer (optional)</label>
                  <input type="file" accept="video/*" onChange={e => updateSeason(sIdx, "trailer", e.target.files[0])} />
                  {s.trailer && <video className="preview-video" controls src={URL.createObjectURL(s.trailer)} />}
                </div>

                {s.episodes.map((ep, eIdx) => (
                  <div key={eIdx} className="episode-block">
                    <h4>EPISODE {eIdx + 1}</h4>
                    <input placeholder={`Episode ${eIdx + 1} Title *`} value={ep.title} onChange={e => updateEpisode(sIdx, eIdx, "title", e.target.value)} style={{ borderColor: accent }} required />
                    <textarea placeholder={`Episode ${eIdx + 1} Description`} value={ep.description} onChange={e => updateEpisode(sIdx, eIdx, "description", e.target.value)} style={{ borderColor: accent }} />
                    <div className="episode-actions">
                      <button type="button" className="danger" onClick={() => removeEpisode(sIdx, eIdx)}>Remove Episode</button>
                    </div>
                    {["video", "trailer"].map(key => (
                      <div
                        key={key}
                        className={`file-input-wrapper ${dragOver[`season-${sIdx}-episode-${eIdx}-${key}`] ? "drag-over" : ""} ${key === 'video' ? 'required' : ''}`}
                        onDragOver={e => e.preventDefault()}
                        onDragEnter={() => handleDragEnter(`season-${sIdx}-episode-${eIdx}-${key}`)}
                        onDragLeave={() => handleDragLeave(`season-${sIdx}-episode-${eIdx}-${key}`)}
                        onDrop={e => handleDrop(e, `season-${sIdx}-episode-${eIdx}-${key}`, file => updateEpisode(sIdx, eIdx, key, file))}
                      >
                        <label>{key === "video" ? "Episode Video *" : "Episode Trailer"}</label>
                        <input type="file" accept="video/*" onChange={e => updateEpisode(sIdx, eIdx, key, e.target.files[0])} required={key === 'video'} />
                        {ep[key] && <video className="preview-video" controls src={URL.createObjectURL(ep[key])} />}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            <button type="button" className="add-season" style={{ borderColor: accent, color: accent }} onClick={addSeason}>+ Add New Chapter</button>
          </section>
        )}

        {uploadProgress.main !== undefined && (
          <div className="upload-progress">
            <div className="upload-progress-bar" style={{ width: `${uploadProgress.main}%`, background: accent }} />
            <span>{uploadProgress.main}%</span>
          </div>
        )}

        <div className="upload-actions">
          <button
            type="submit"
            className="primary"
            disabled={isSubmitting}
            style={{ background: data.title && data.description ? accent : "#333", borderColor: accent }}
          >
            {isSubmitting ? `SUBMITTING... ${uploadProgress.main || 0}%` : mode === "movie" ? "PLANT THE SEED" : "WEAVE THE SHADOW"}
          </button>
        </div>

        <div className="upload-note">
          <small>* After approval, you can release this from your dashboard</small>
        </div>
      </form>
    </div>
  );
}