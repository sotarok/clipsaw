"use client";

import { useRef, useState, useCallback } from "react";

export function useMediaPlayer() {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const volumeRef = useRef(1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const play = useCallback(() => {
    mediaRef.current?.play();
  }, []);

  const pause = useCallback(() => {
    mediaRef.current?.pause();
  }, []);

  const togglePlay = useCallback(() => {
    if (!mediaRef.current) return;
    if (mediaRef.current.paused) {
      mediaRef.current.play();
    } else {
      mediaRef.current.pause();
    }
  }, []);

  const seek = useCallback((time: number) => {
    if (!mediaRef.current) return;
    mediaRef.current.currentTime = Math.max(0, Math.min(time, mediaRef.current.duration || 0));
  }, []);

  const rangeEndRef = useRef<number | null>(null);

  const playRange = useCallback((from: number, to: number) => {
    if (!mediaRef.current) return;
    rangeEndRef.current = to;
    mediaRef.current.currentTime = from;
    mediaRef.current.play();
  }, []);

  const changeVolume = useCallback((v: number) => {
    if (!mediaRef.current) return;
    const clamped = Math.max(0, Math.min(1, v));
    mediaRef.current.volume = clamped;
    volumeRef.current = clamped;
    setVolume(clamped);
  }, []);

  const bindMedia = useCallback((el: HTMLVideoElement | HTMLAudioElement | null) => {
    // Clean up previous element's listeners
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
    }

    mediaRef.current = el;
    if (!el) return;

    el.volume = volumeRef.current;

    const onTimeUpdate = () => {
      setCurrentTime(el.currentTime);
      if (rangeEndRef.current !== null && el.currentTime >= rangeEndRef.current) {
        el.pause();
        rangeEndRef.current = null;
      }
    };
    const onDurationChange = () => setDuration(el.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => {
      setIsPlaying(false);
      rangeEndRef.current = null;
    };
    const onEnded = () => setIsPlaying(false);
    const onError = () => {
      const e = el.error;
      console.error("[media] error:", e?.code, e?.message, "src:", el.src, "networkState:", el.networkState, "readyState:", el.readyState);
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("durationchange", onDurationChange);
    el.addEventListener("loadedmetadata", onDurationChange);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("ended", onEnded);
    el.addEventListener("error", onError);

    if (el.duration) {
      setDuration(el.duration);
    }

    cleanupRef.current = () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("durationchange", onDurationChange);
      el.removeEventListener("loadedmetadata", onDurationChange);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("ended", onEnded);
      el.removeEventListener("error", onError);
    };
  }, []);

  return {
    mediaRef,
    bindMedia,
    isPlaying,
    currentTime,
    duration,
    volume,
    play,
    pause,
    togglePlay,
    seek,
    changeVolume,
    playRange,
  };
}
