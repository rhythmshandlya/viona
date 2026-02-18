"use client";

import { useState, useCallback } from "react";

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

function setNestedValue(obj: any, path: string, value: any): any {
  const clone = JSON.parse(JSON.stringify(obj));
  const keys = path.split(".");
  let current = clone;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined) {
      current[keys[i]] = {};
    }
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
  return clone;
}

export function useTemplateProps(defaultProps: Record<string, unknown>) {
  const [props, setProps] = useState<Record<string, unknown>>(
    JSON.parse(JSON.stringify(defaultProps))
  );

  const updateProp = useCallback((path: string, value: unknown) => {
    setProps((prev) => setNestedValue(prev, path, value));
  }, []);

  const getValue = useCallback(
    (path: string) => {
      return getNestedValue(props, path);
    },
    [props]
  );

  const resetProps = useCallback(() => {
    setProps(JSON.parse(JSON.stringify(defaultProps)));
  }, [defaultProps]);

  const addArrayItem = useCallback(
    (path: string, item: unknown) => {
      const arr = getNestedValue(props, path);
      if (Array.isArray(arr)) {
        setProps((prev) => setNestedValue(prev, path, [...arr, item]));
      }
    },
    [props]
  );

  const removeArrayItem = useCallback(
    (path: string, index: number) => {
      const arr = getNestedValue(props, path);
      if (Array.isArray(arr)) {
        const newArr = arr.filter((_, i) => i !== index);
        setProps((prev) => setNestedValue(prev, path, newArr));
      }
    },
    [props]
  );

  return { props, updateProp, getValue, resetProps, addArrayItem, removeArrayItem };
}
