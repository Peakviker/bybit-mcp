export type RuntimeStore = {
  appendJsonl: (fileName: string, value: unknown) => string;
};

import { appendJsonl } from './persist.js';

export const jsonlRuntimeStore: RuntimeStore = {
  appendJsonl,
};
