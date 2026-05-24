import { useEffect, useState } from 'react';

import { readStorage, writeStorage } from '../utils/storage';

export function useLocalStorageState<T>(key: string, initialValue: T | (() => T)) {
  const getInitialValue = () => {
    const fallback = typeof initialValue === 'function'
      ? (initialValue as () => T)()
      : initialValue;

    return readStorage<T>(key, fallback);
  };

  const [value, setValue] = useState<T>(getInitialValue);

  useEffect(() => {
    writeStorage(key, value);
  }, [key, value]);

  return [value, setValue] as const;
}
