'use client';

import { useEffect } from 'react';
import clarity from '@microsoft/clarity';

export function ClarityScript() {
  useEffect(() => {
    clarity.init('vib59k8pij');
  }, []);

  return null;
}
