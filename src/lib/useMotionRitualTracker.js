// src/lib/useMotionRitualTracker.js
//
// Automatic step counting from the phone's motion sensor, used to
// estimate ritual circuit progress (Tawaf, Sa'i, kora, parikrama)
// without any manual tapping once "Start" is pressed.
//
// Honest about what this is: a simple, standard peak-detection step
// counter (the same basic principle any phone pedometer uses) plus a
// distance estimate from stride length, then circuits = distance ÷ an
// average circuit length. In a dense, crowded, GPS-denied space like
// the Mataf, the average-circuit-length assumption is the weak link —
// this gives a good live estimate, not a GPS-exact count, which is why
// a small manual +1/-1 stays available throughout rather than locking
// the number away as unquestionable.

import { useRef, useState, useCallback, useEffect } from "react";

const STRIDE_METERS = 0.73; // rough average adult stride length
const STEP_MIN_INTERVAL_MS = 250; // debounce so a single footfall isn't counted twice
const ACCEL_PEAK_THRESHOLD = 1.2; // m/s² above resting gravity noise — tuned loosely, not device-calibrated

export function useMotionRitualTracker(counterConfig) {
  const [tracking, setTracking] = useState(false);
  const [steps, setSteps] = useState(0);
  const [circuit, setCircuit] = useState(0);
  const [completed, setCompleted] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const lastStepTime = useRef(0);
  const lastMagnitude = useRef(0);
  const handlerRef = useRef(null);

  const distanceMeters = steps * STRIDE_METERS;
  const target = counterConfig?.target ?? 7;
  const avgDistancePerCircuit = counterConfig?.avgDistanceMeters ?? 350;

  useEffect(() => {
    const estimated = Math.min(Math.floor(distanceMeters / avgDistancePerCircuit), target);
    setCircuit(estimated);
    if (estimated >= target) {
      setCompleted(true);
      setTracking(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [distanceMeters]);

  const handleMotion = useCallback((event) => {
    const acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc) return;
    const magnitude = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
    const delta = magnitude - lastMagnitude.current;
    lastMagnitude.current = magnitude;

    const now = Date.now();
    if (delta > ACCEL_PEAK_THRESHOLD && now - lastStepTime.current > STEP_MIN_INTERVAL_MS) {
      lastStepTime.current = now;
      setSteps((s) => s + 1);
    }
  }, []);

  const start = useCallback(async () => {
    if (typeof DeviceMotionEvent === "undefined") {
      setUnsupported(true);
      return;
    }
    // iOS requires an explicit permission prompt, triggered from a
    // user gesture (the Start button click itself satisfies that).
    if (typeof DeviceMotionEvent.requestPermission === "function") {
      try {
        const result = await DeviceMotionEvent.requestPermission();
        if (result !== "granted") {
          setPermissionDenied(true);
          return;
        }
      } catch {
        setPermissionDenied(true);
        return;
      }
    }
    handlerRef.current = handleMotion;
    window.addEventListener("devicemotion", handlerRef.current);
    setTracking(true);
    setCompleted(false);
  }, [handleMotion]);

  const stop = useCallback(() => {
    if (handlerRef.current) window.removeEventListener("devicemotion", handlerRef.current);
    setTracking(false);
  }, []);

  const reset = useCallback(() => {
    stop();
    setSteps(0);
    setCircuit(0);
    setCompleted(false);
    lastMagnitude.current = 0;
    lastStepTime.current = 0;
  }, [stop]);

  const adjustCircuit = useCallback(
    (delta) => {
      setCircuit((c) => {
        const next = Math.max(0, Math.min(target, c + delta));
        if (next >= target) setCompleted(true);
        return next;
      });
    },
    [target]
  );

  useEffect(() => () => stop(), [stop]);

  return { tracking, steps, distanceMeters, circuit, target, completed, unsupported, permissionDenied, start, stop, reset, adjustCircuit };
}
