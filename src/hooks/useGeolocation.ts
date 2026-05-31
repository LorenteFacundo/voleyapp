import { useState, useEffect } from 'react';

const DEFAULT_CENTER: [number, number] = [-34.6037, -58.3816];

export function useGeolocation() {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCenter([position.coords.latitude, position.coords.longitude]);
      },
      () => {
        setCenter(DEFAULT_CENTER);
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  }, []);

  return { center };
}
