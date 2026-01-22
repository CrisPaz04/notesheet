/**
 * useTempoTrainer Hook
 *
 * Manages tempo training functionality - gradually increases BPM over time
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const DEFAULT_CONFIG = {
  startBpm: 80,
  targetBpm: 120,
  incrementBpm: 5,
  barsPerIncrement: 4
};

function useTempoTrainer(metronomeEngine, updateBpm, isMetronomePlaying) {
  // Configuration state
  const [config, setConfig] = useState(DEFAULT_CONFIG);

  // Training state
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentTrainingBpm, setCurrentTrainingBpm] = useState(config.startBpm);
  const [barsCompleted, setBarsCompleted] = useState(0);
  const [totalBarsNeeded, setTotalBarsNeeded] = useState(0);

  // Refs for callbacks
  const configRef = useRef(config);
  const isActiveRef = useRef(isActive);
  const isPausedRef = useRef(isPaused);
  const currentBpmRef = useRef(currentTrainingBpm);
  const barsCompletedRef = useRef(barsCompleted);

  // Keep refs in sync
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    currentBpmRef.current = currentTrainingBpm;
  }, [currentTrainingBpm]);

  useEffect(() => {
    barsCompletedRef.current = barsCompleted;
  }, [barsCompleted]);

  // Calculate total bars needed to reach target
  useEffect(() => {
    if (config.incrementBpm > 0) {
      const steps = Math.ceil((config.targetBpm - config.startBpm) / config.incrementBpm);
      setTotalBarsNeeded(steps * config.barsPerIncrement);
    }
  }, [config]);

  // Handle measure completion callback
  const handleMeasureComplete = useCallback((measureCount) => {
    if (!isActiveRef.current || isPausedRef.current) return;

    const newBarsCompleted = barsCompletedRef.current + 1;
    setBarsCompleted(newBarsCompleted);

    // Check if it's time to increment
    if (newBarsCompleted % configRef.current.barsPerIncrement === 0) {
      const newBpm = currentBpmRef.current + configRef.current.incrementBpm;

      if (newBpm >= configRef.current.targetBpm) {
        // Reached target - complete training
        setCurrentTrainingBpm(configRef.current.targetBpm);
        updateBpm(configRef.current.targetBpm);
        // Don't stop automatically - let user continue at target BPM
      } else {
        // Increment BPM
        setCurrentTrainingBpm(newBpm);
        updateBpm(newBpm);
      }
    }
  }, [updateBpm]);

  // Register/unregister measure callback with engine
  useEffect(() => {
    if (metronomeEngine && isActive && !isPaused) {
      metronomeEngine.setOnMeasureComplete(handleMeasureComplete);
    } else if (metronomeEngine) {
      metronomeEngine.setOnMeasureComplete(null);
    }

    return () => {
      if (metronomeEngine) {
        metronomeEngine.setOnMeasureComplete(null);
      }
    };
  }, [metronomeEngine, isActive, isPaused, handleMeasureComplete]);

  // Stop training when metronome stops
  useEffect(() => {
    if (!isMetronomePlaying && isActive) {
      setIsActive(false);
      setIsPaused(false);
    }
  }, [isMetronomePlaying, isActive]);

  /**
   * Update configuration
   */
  const updateConfig = useCallback((newConfig) => {
    setConfig(prev => ({ ...prev, ...newConfig }));
  }, []);

  /**
   * Start training
   */
  const startTraining = useCallback(() => {
    // Validate configuration
    if (config.startBpm >= config.targetBpm) {
      console.warn('Start BPM must be less than target BPM');
      return false;
    }
    if (config.incrementBpm <= 0) {
      console.warn('Increment must be positive');
      return false;
    }

    // Set initial BPM
    setCurrentTrainingBpm(config.startBpm);
    updateBpm(config.startBpm);

    // Reset counters
    setBarsCompleted(0);

    // Start training
    setIsActive(true);
    setIsPaused(false);

    return true;
  }, [config, updateBpm]);

  /**
   * Pause training
   */
  const pauseTraining = useCallback(() => {
    setIsPaused(true);
  }, []);

  /**
   * Resume training
   */
  const resumeTraining = useCallback(() => {
    setIsPaused(false);
  }, []);

  /**
   * Toggle pause/resume
   */
  const togglePause = useCallback(() => {
    if (isPaused) {
      resumeTraining();
    } else {
      pauseTraining();
    }
  }, [isPaused, pauseTraining, resumeTraining]);

  /**
   * Stop/reset training
   */
  const stopTraining = useCallback(() => {
    setIsActive(false);
    setIsPaused(false);
    setBarsCompleted(0);
    setCurrentTrainingBpm(config.startBpm);
  }, [config.startBpm]);

  /**
   * Calculate progress percentage
   */
  const getProgress = useCallback(() => {
    if (!isActive || totalBarsNeeded === 0) return 0;

    const progressByBars = (barsCompleted / totalBarsNeeded) * 100;
    const progressByBpm = ((currentTrainingBpm - config.startBpm) / (config.targetBpm - config.startBpm)) * 100;

    // Use the higher of the two to show accurate progress
    return Math.min(100, Math.max(progressByBars, progressByBpm));
  }, [isActive, barsCompleted, totalBarsNeeded, currentTrainingBpm, config]);

  /**
   * Check if target has been reached
   */
  const hasReachedTarget = currentTrainingBpm >= config.targetBpm;

  return {
    // Configuration
    config,
    updateConfig,

    // State
    isActive,
    isPaused,
    currentTrainingBpm,
    barsCompleted,
    progress: getProgress(),
    hasReachedTarget,

    // Controls
    startTraining,
    pauseTraining,
    resumeTraining,
    togglePause,
    stopTraining
  };
}

export default useTempoTrainer;
