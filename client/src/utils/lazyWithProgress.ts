import { lazy } from 'react';
import type { ComponentType } from 'react';
import NProgress from 'nprogress';

let configured = false;

function ensureConfigured() {
  if (configured) {
    return;
  }

  NProgress.configure({
    showSpinner: false,
    minimum: 0.12,
    speed: 360,
    trickleSpeed: 140,
  });

  configured = true;
}

export function lazyWithProgress<T extends ComponentType>(
  importer: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    ensureConfigured();
    NProgress.start();

    try {
      const module = await importer();
      NProgress.done();
      return module;
    } catch (error) {
      NProgress.done();
      throw error;
    }
  });
}
