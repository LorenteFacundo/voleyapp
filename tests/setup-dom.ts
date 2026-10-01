import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach } from 'vitest';

// findBy* y waitFor esperan hasta 5 s (por defecto, 1 s) para tolerar corridas en paralelo.
configure({ asyncUtilTimeout: 5_000 });

afterEach(() => {
  cleanup();
});
