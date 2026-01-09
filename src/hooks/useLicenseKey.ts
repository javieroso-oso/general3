import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const LICENSE_KEY_STORAGE = 'export-license-key';
const LICENSE_VALIDATED_STORAGE = 'export-license-validated';

export const useLicenseKey = () => {
  const [licenseKey, setLicenseKeyState] = useState<string | null>(null);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isValidating, setIsValidating] = useState(false);

  // Load license key from localStorage on mount and verify it's still valid
  useEffect(() => {
    const stored = localStorage.getItem(LICENSE_KEY_STORAGE);
    const wasValidated = localStorage.getItem(LICENSE_VALIDATED_STORAGE) === 'true';
    
    if (stored && wasValidated) {
      setLicenseKeyState(stored);
      setIsUnlocked(true);
    }
  }, []);

  // Server-side validation of license key
  const validateKeyOnServer = useCallback(async (key: string): Promise<boolean> => {
    if (!supabase) return false;
    
    try {
      const { data, error } = await supabase.functions.invoke('create-export-payment', {
        body: { 
          exportType: 'body', // Minimal request to check license
          licenseKey: key 
        },
      });

      if (error) {
        console.error('License validation error:', error);
        return false;
      }

      return data?.authorized === true;
    } catch (err) {
      console.error('License validation failed:', err);
      return false;
    }
  }, []);

  const setLicenseKey = useCallback(async (key: string): Promise<boolean> => {
    if (!key || key.trim().length === 0) return false;
    
    setIsValidating(true);
    
    try {
      const isValid = await validateKeyOnServer(key);
      
      if (isValid) {
        localStorage.setItem(LICENSE_KEY_STORAGE, key);
        localStorage.setItem(LICENSE_VALIDATED_STORAGE, 'true');
        setLicenseKeyState(key);
        setIsUnlocked(true);
      }
      
      return isValid;
    } finally {
      setIsValidating(false);
    }
  }, [validateKeyOnServer]);

  const clearLicense = useCallback(() => {
    localStorage.removeItem(LICENSE_KEY_STORAGE);
    localStorage.removeItem(LICENSE_VALIDATED_STORAGE);
    setLicenseKeyState(null);
    setIsUnlocked(false);
  }, []);

  // Client-side validation is no longer used - all validation happens server-side
  const validateKey = useCallback(async (key: string): Promise<boolean> => {
    return validateKeyOnServer(key);
  }, [validateKeyOnServer]);

  return {
    licenseKey,
    isUnlocked,
    isValidating,
    setLicenseKey,
    clearLicense,
    validateKey,
  };
};

export default useLicenseKey;
