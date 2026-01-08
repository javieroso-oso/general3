import { useState, useEffect, useCallback } from 'react';

const LICENSE_KEY_STORAGE = 'export-license-key';
const VALID_LICENSE_KEY = 'oso3d';

export const useLicenseKey = () => {
  const [licenseKey, setLicenseKeyState] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // Load license key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(LICENSE_KEY_STORAGE);
    if (stored) {
      setLicenseKeyState(stored);
      setIsUnlocked(stored === VALID_LICENSE_KEY);
    }
  }, []);

  const setLicenseKey = useCallback((key: string) => {
    const isValid = key === VALID_LICENSE_KEY;
    if (isValid) {
      localStorage.setItem(LICENSE_KEY_STORAGE, key);
      setLicenseKeyState(key);
      setIsUnlocked(true);
    }
    return isValid;
  }, []);

  const clearLicense = useCallback(() => {
    localStorage.removeItem(LICENSE_KEY_STORAGE);
    setLicenseKeyState(null);
    setIsUnlocked(false);
  }, []);

  const validateKey = useCallback((key: string) => {
    return key === VALID_LICENSE_KEY;
  }, []);

  return {
    licenseKey,
    isUnlocked,
    setLicenseKey,
    clearLicense,
    validateKey,
  };
};

export default useLicenseKey;
