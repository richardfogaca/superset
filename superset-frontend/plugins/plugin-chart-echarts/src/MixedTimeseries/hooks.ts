import { useEffect, useRef } from 'react';
import { isEqual } from 'lodash';

export function useDeepCompareEffect(callback: () => void, dependencies: any) {
  const dependenciesRef = useRef();

  if (
    !dependenciesRef.current ||
    !isEqual(dependenciesRef.current, dependencies)
  ) {
    dependenciesRef.current = dependencies;
  }

  useEffect(callback, [callback, dependenciesRef.current]);
}
