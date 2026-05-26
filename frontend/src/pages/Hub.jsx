/* eslint-disable no-unused-vars */
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppContext } from "../context/AppContext";
import axios from "axios";
import "./Hub.css";

export default function Hub() {
  const { isAuthReady } = useAppContext();
  const [videos, setVideos] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const today = new Date();

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true);
      setError("");

      try {
        const token = localStorage.getItem("narraToken");

        const videoRes = await axios.get("/api/videos", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const liveRes = await axios.get("/api/live/streams", {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        setVideos(videoRes.data.videos || []);
        setLiveStreams(liveRes.data.streams || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load hub content.");
      } finally {
        setLoading(false);
      }
    };

    if (isAuthReady) fetchContent();
  }, [isAuthReady]);

  if (!isAuthReady || loading) {
    return (
      <div className="hub-container">
        <div className="hub-claw-background">
          <div className="claw claw-1"></div><div className="claw claw-2"></div><div className="claw claw-3"></div>
          <div className="claw claw-4"></div><div className="claw claw-5"></div><div className="claw claw-6"></div>
          <div className="claw claw-7"></div><div className="claw claw-8"></div><div className="claw claw-9"></div>
          <div className="claw claw-10"></div><div className="claw claw-11"></div><div className="claw claw-12"></div>
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
          <div className="scar-x scar-x-1"></div><div className="scar-x scar-x-2"></div>
          <div className="scar-x scar-x-3"></div><div className="scar-x scar-x-4"></div>
        </div>
        <div className="blood-stroke top"></div>
        <div className="blood-stroke bottom"></div>
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p className="loading-text">Loading Hub content...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="hub-container">
        <div className="hub-claw-background">
          <div className="claw claw-1"></div><div className="claw claw-2"></div><div className="claw claw-3"></div>
          <div className="claw claw-4"></div><div className="claw claw-5"></div><div className="claw claw-6"></div>
          <div className="claw claw-7"></div><div className="claw claw-8"></div><div className="claw claw-9"></div>
          <div className="claw claw-10"></div><div className="claw claw-11"></div><div className="claw claw-12"></div>
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
          <div className="scar-x scar-x-1"></div><div className="scar-x scar-x-2"></div>
          <div className="scar-x scar-x-3"></div><div className="scar-x scar-x-4"></div>
        </div>
        <div className="blood-stroke top"></div>
        <div className="blood-stroke bottom"></div>
        <div className="error-state">
          <p className="error-text">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="hub-container">
      {/* Distributed Claw Mark Background */}
      <div className="hub-claw-background">
        <div className="claw claw-1"></div><div className="claw claw-2"></div><div className="claw claw-3"></div>
        <div className="claw claw-4"></div><div className="claw claw-5"></div><div className="claw claw-6"></div>
        <div className="claw claw-7"></div><div className="claw claw-8"></div><div className="claw claw-9"></div>
        <div className="claw claw-10"></div><div className="claw claw-11"></div><div className="claw claw-12"></div>
        <div className="claw claw-13"></div><div className="claw claw-14"></div><div className="claw claw-15"></div>
        <div className="claw claw-16"></div><div className="claw claw-17"></div><div className="claw claw-18"></div>
        <div className="claw claw-19"></div><div className="claw claw-20"></div>
        
        <div className="scar-diagonal scar-diag-1"></div><div className="scar-diagonal scar-diag-2"></div>
        <div className="scar-diagonal scar-diag-3"></div><div className="scar-diagonal scar-diag-4"></div>
        <div className="scar-diagonal scar-diag-5"></div><div className="scar-diagonal scar-diag-6"></div>
        <div className="scar-diagonal scar-diag-7"></div><div className="scar-diagonal scar-diag-8"></div>
        <div className="scar-diagonal scar-diag-9"></div><div className="scar-diagonal scar-diag-10"></div>
        
        <div className="scratch-horizontal scratch-h-1"></div><div className="scratch-horizontal scratch-h-2"></div>
        <div className="scratch-horizontal scratch-h-3"></div><div className="scratch-horizontal scratch-h-4"></div>
        <div className="scratch-horizontal scratch-h-5"></div><div className="scratch-horizontal scratch-h-6"></div>
        <div className="scratch-horizontal scratch-h-7"></div><div className="scratch-horizontal scratch-h-8"></div>
        <div className="scratch-horizontal scratch-h-9"></div><div className="scratch-horizontal scratch-h-10"></div>
        
        <div className="scratch-vertical scratch-v-1"></div><div className="scratch-vertical scratch-v-2"></div>
        <div className="scratch-vertical scratch-v-3"></div><div className="scratch-vertical scratch-v-4"></div>
        <div className="scratch-vertical scratch-v-5"></div><div className="scratch-vertical scratch-v-6"></div>
        <div className="scratch-vertical scratch-v-7"></div><div className="scratch-vertical scratch-v-8"></div>
        <div className="scratch-vertical scratch-v-9"></div><div className="scratch-vertical scratch-v-10"></div>
        
        <div className="triple-claw triple-1"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-2"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-3"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-4"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-5"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-6"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-7"><span></span><span></span><span></span></div>
        <div className="triple-claw triple-8"><span></span><span></span><span></span></div>
        
        <div className="scar-x scar-x-1"></div><div className="scar-x scar-x-2"></div>
        <div className="scar-x scar-x-3"></div><div className="scar-x scar-x-4"></div>
        <div className="scar-x scar-x-5"></div><div className="scar-x scar-x-6"></div>
        <div className="scar-x scar-x-7"></div><div className="scar-x scar-x-8"></div>
      </div>

      <div className="blood-stroke top"></div>
      <div className="blood-stroke bottom"></div>

      <div className="hub-content">
        <h1>Narra Hub</h1>
        
        <div className="hub-grid">
          {/* Live Streams */}
          {liveStreams.map((stream) => (
            <Link
              key={`live-${stream.id}`}
              to={`/live/${stream.id}`}
              className="hub-card"
            >
              <div className="hub-thumbnail">
                {stream.thumbnail && (
                  <img
                    src={stream.thumbnail}
                    alt={stream.title}
                    className="hub-thumb-img"
                  />
                )}
                <span className="hub-live-badge">LIVE</span>
              </div>
              <div className="hub-title">
                {stream.title}
              </div>
            </Link>
          ))}

          {/* Regular Videos */}
          {videos.map((video) => {
            const isSeries = video.type === "series";

            return (
              <Link key={video.id} to={`/video/${video.id}`} className="hub-card">
                <div className="hub-thumbnail">
                  {video.thumbnail ? (
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="hub-thumb-img"
                    />
                  ) : (
                    <div className="hub-no-thumbnail">
                      No Thumbnail
                    </div>
                  )}

                  {isSeries && video.episodes && (
                    <div className="hub-episodes">
                      <span>{video.episodes.length} Episodes</span>
                      {video.episodes.map((ep) => {
                        const release = new Date(ep.releaseDate);
                        if (release > today) {
                          const daysUntil = Math.ceil(
                            (release - today) / (1000 * 60 * 60 * 24)
                          );
                          return (
                            <span key={ep.id} className="hub-coming-soon">
                              {daysUntil}d
                            </span>
                          );
                        }
                        return null;
                      })}
                    </div>
                  )}
                </div>
                <div className="hub-title">
                  {video.title}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}