export function cleanupResources(resources = {}) {
  if (resources.streamRef?.current) {
    resources.streamRef.current.getTracks().forEach((track) => track.stop());

    resources.streamRef.current = null;
  }

  if (resources.videoRef?.current) {
    resources.videoRef.current.srcObject = null;
  }

  if (resources.watchIdRef?.current != null) {
    navigator.geolocation.clearWatch(resources.watchIdRef.current);

    resources.watchIdRef.current = null;
  }

  if (resources.intervalRef?.current) {
    clearInterval(resources.intervalRef.current);

    resources.intervalRef.current = null;
  }

  if (resources.timeoutRef?.current) {
    clearTimeout(resources.timeoutRef.current);

    resources.timeoutRef.current = null;
  }
}
