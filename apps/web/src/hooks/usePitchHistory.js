/**
 * usePitchHistory Hook
 *
 * Manages a circular buffer of pitch deviation values for graphing
 */

import { useState, useRef, useCallback } from 'react';

const DEFAULT_BUFFER_SIZE = 150; // ~5 seconds at 30fps
const STABILITY_WINDOW = 30; // Number of samples to calculate stability

function usePitchHistory(bufferSize = DEFAULT_BUFFER_SIZE) {
  const [history, setHistory] = useState([]);
  const bufferRef = useRef([]);

  /**
   * Add a new cents deviation value to the history
   */
  const addSample = useCallback((centsDeviation) => {
    bufferRef.current.push({
      cents: centsDeviation,
      timestamp: Date.now()
    });

    // Keep buffer within size limit (circular)
    if (bufferRef.current.length > bufferSize) {
      bufferRef.current.shift();
    }

    // Update state for rendering (copy to avoid mutation issues)
    setHistory([...bufferRef.current]);
  }, [bufferSize]);

  /**
   * Clear all history
   */
  const clearHistory = useCallback(() => {
    bufferRef.current = [];
    setHistory([]);
  }, []);

  /**
   * Calculate trend from recent samples
   * Returns: 'rising', 'falling', 'stable', or null if not enough data
   */
  const getTrend = useCallback(() => {
    if (history.length < 10) return null;

    const recentSamples = history.slice(-10);
    const firstHalf = recentSamples.slice(0, 5);
    const secondHalf = recentSamples.slice(5);

    const avgFirst = firstHalf.reduce((sum, s) => sum + s.cents, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((sum, s) => sum + s.cents, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;

    if (Math.abs(diff) < 2) return 'stable';
    if (diff > 0) return 'rising';
    return 'falling';
  }, [history]);

  /**
   * Calculate stability metric (lower is more stable)
   * Returns standard deviation of recent samples, or null if not enough data
   */
  const getStability = useCallback(() => {
    if (history.length < STABILITY_WINDOW) return null;

    const recentSamples = history.slice(-STABILITY_WINDOW);
    const values = recentSamples.map(s => s.cents);

    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = Math.sqrt(avgSquaredDiff);

    return stdDev;
  }, [history]);

  /**
   * Get stability rating
   * Returns: 'excellent', 'good', 'fair', 'poor', or null
   */
  const getStabilityRating = useCallback(() => {
    const stability = getStability();
    if (stability === null) return null;

    if (stability < 3) return 'excellent';
    if (stability < 8) return 'good';
    if (stability < 15) return 'fair';
    return 'poor';
  }, [getStability]);

  /**
   * Get the average cents deviation from recent samples
   */
  const getAverageCents = useCallback(() => {
    if (history.length < 5) return null;

    const recentSamples = history.slice(-15);
    const avg = recentSamples.reduce((sum, s) => sum + s.cents, 0) / recentSamples.length;
    return Math.round(avg * 10) / 10;
  }, [history]);

  return {
    // Data
    history,
    bufferSize,

    // Actions
    addSample,
    clearHistory,

    // Analysis
    trend: getTrend(),
    stability: getStability(),
    stabilityRating: getStabilityRating(),
    averageCents: getAverageCents(),

    // Stats
    sampleCount: history.length,
    hasEnoughData: history.length >= 10
  };
}

export default usePitchHistory;
