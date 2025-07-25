/**
 * Optimized state management hooks for React performance
 */

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { batchUpdates } from '@/lib/utils/performance';

/**
 * Optimized useState that batches multiple state updates
 */
export function useBatchedState<T>(initialState: T) {
  const [state, setState] = useState(initialState);
  const pendingUpdates = useRef<Array<(prev: T) => T>>([]);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const batchedSetState = useCallback((update: T | ((prev: T) => T)) => {
    const updateFn = typeof update === 'function' 
      ? update as (prev: T) => T
      : () => update;
    
    pendingUpdates.current.push(updateFn);
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (pendingUpdates.current.length > 0) {
        setState(prev => {
          let newState = prev;
          for (const update of pendingUpdates.current) {
            newState = update(newState);
          }
          pendingUpdates.current = [];
          return newState;
        });
      }
    }, 0);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [state, batchedSetState] as const;
}

/**
 * Optimized reducer with automatic batching
 */
export function useOptimizedReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initialState: S
) {
  const [state, setState] = useState(initialState);
  const pendingActions = useRef<A[]>([]);
  const isProcessing = useRef(false);

  const dispatch = useCallback((action: A) => {
    pendingActions.current.push(action);
    
    if (!isProcessing.current) {
      isProcessing.current = true;
      
      Promise.resolve().then(() => {
        if (pendingActions.current.length > 0) {
          setState(prevState => {
            let newState = prevState;
            const actions = [...pendingActions.current];
            pendingActions.current = [];
            
            for (const action of actions) {
              newState = reducer(newState, action);
            }
            
            return newState;
          });
        }
        isProcessing.current = false;
      });
    }
  }, [reducer]);

  return [state, dispatch] as const;
}

/**
 * Lazy initial state with performance tracking
 */
export function useLazyState<T>(
  initializer: () => T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    const start = performance.now();
    const initialState = initializer();
    const duration = performance.now() - start;
    
    if (duration > 10) {
      console.warn(
        `⚠️ Slow state initialization: ${duration.toFixed(2)}ms`
      );
    }
    
    return initialState;
  });

  return [state, setState];
}

/**
 * State with history for undo/redo functionality
 */
export function useStateWithHistory<T>(
  initialState: T,
  capacity: number = 10
) {
  const [state, setState] = useState(initialState);
  const [historyIndex, setHistoryIndex] = useState(0);
  const history = useRef<T[]>([initialState]);

  const setStateWithHistory = useCallback((newState: T | ((prev: T) => T)) => {
    setState(prev => {
      const nextState = typeof newState === 'function' 
        ? (newState as (prev: T) => T)(prev)
        : newState;
      
      // Remove any forward history
      history.current = history.current.slice(0, historyIndex + 1);
      
      // Add new state to history
      history.current.push(nextState);
      
      // Limit history size
      if (history.current.length > capacity) {
        history.current.shift();
      } else {
        setHistoryIndex(prev => prev + 1);
      }
      
      return nextState;
    });
  }, [historyIndex, capacity]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setState(history.current[newIndex]);
    }
  }, [historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.current.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setState(history.current[newIndex]);
    }
  }, [historyIndex]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.current.length - 1;

  return {
    state,
    setState: setStateWithHistory,
    undo,
    redo,
    canUndo,
    canRedo,
    history: history.current,
    historyIndex
  };
}

/**
 * Optimized form state management
 */
export function useOptimizedForm<T extends Record<string, any>>(
  initialValues: T
) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const setValue = useCallback(<K extends keyof T>(
    field: K,
    value: T[K]
  ) => {
    setValues(prev => ({ ...prev, [field]: value }));
  }, []);

  const setFieldTouched = useCallback(<K extends keyof T>(
    field: K,
    isTouched: boolean = true
  ) => {
    setTouched(prev => ({ ...prev, [field]: isTouched }));
  }, []);

  const setFieldError = useCallback(<K extends keyof T>(
    field: K,
    error?: string
  ) => {
    setErrors(prev => {
      if (error) {
        return { ...prev, [field]: error };
      } else {
        const { [field]: _, ...rest } = prev;
        return rest;
      }
    });
  }, []);

  const handleChange = useCallback(<K extends keyof T>(field: K) => {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = e.target.type === 'checkbox' 
        ? (e.target as HTMLInputElement).checked 
        : e.target.value;
      setValue(field, value as T[K]);
    };
  }, [setValue]);

  const handleBlur = useCallback(<K extends keyof T>(field: K) => {
    return () => {
      setFieldTouched(field, true);
    };
  }, [setFieldTouched]);

  const resetForm = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  const isValid = Object.keys(errors).length === 0;
  const isDirty = JSON.stringify(values) !== JSON.stringify(initialValues);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    isValid,
    isDirty,
    setValue,
    setFieldTouched,
    setFieldError,
    setIsSubmitting,
    handleChange,
    handleBlur,
    resetForm
  };
}

/**
 * Persistent state with localStorage
 */
export function useLocalStorageState<T>(
  key: string,
  initialValue: T,
  options?: {
    serialize?: (value: T) => string;
    deserialize?: (value: string) => T;
  }
) {
  const serialize = options?.serialize || JSON.stringify;
  const deserialize = options?.deserialize || JSON.parse;

  const [state, setState] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? deserialize(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((prev: T) => T)) => {
    try {
      setState(prev => {
        const nextValue = typeof value === 'function' 
          ? (value as (prev: T) => T)(prev)
          : value;
        
        window.localStorage.setItem(key, serialize(nextValue));
        return nextValue;
      });
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, serialize]);

  // Listen for changes in other tabs
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue) {
        try {
          setState(deserialize(e.newValue));
        } catch (error) {
          console.error(`Error parsing localStorage change for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, deserialize]);

  return [state, setValue] as const;
}

/**
 * Optimized toggle state
 */
export function useToggle(
  initialValue: boolean = false
): [boolean, () => void, (value: boolean) => void] {
  const [value, setValue] = useState(initialValue);
  
  const toggle = useCallback(() => {
    setValue(v => !v);
  }, []);
  
  const setToggle = useCallback((newValue: boolean) => {
    setValue(newValue);
  }, []);
  
  return [value, toggle, setToggle];
}

/**
 * Counter with increment/decrement
 */
export function useCounter(
  initialValue: number = 0,
  options?: {
    min?: number;
    max?: number;
    step?: number;
  }
) {
  const { min = -Infinity, max = Infinity, step = 1 } = options || {};
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => {
    setCount(c => Math.min(c + step, max));
  }, [step, max]);

  const decrement = useCallback(() => {
    setCount(c => Math.max(c - step, min));
  }, [step, min]);

  const set = useCallback((value: number) => {
    setCount(Math.max(min, Math.min(value, max)));
  }, [min, max]);

  const reset = useCallback(() => {
    setCount(initialValue);
  }, [initialValue]);

  return {
    count,
    increment,
    decrement,
    set,
    reset
  };
}