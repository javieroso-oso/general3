export interface ExportOptions {
  includeBody: boolean;
  includeLegs: boolean;
  includeMolds: boolean;
  includeSocketCradle: boolean;  // 3D printed socket holder
  includeBasePlate: boolean;     // Base plate with LED puck recess
  mergeMode: 'separate' | 'bodyWithLegs' | 'allMerged';
}

export const DEFAULT_EXPORT_OPTIONS: ExportOptions = {
  includeBody: true,
  includeLegs: true,
  includeMolds: false,
  includeSocketCradle: false,
  includeBasePlate: false,
  mergeMode: 'separate',
};

// Storage key for persisting user preferences
export const EXPORT_OPTIONS_STORAGE_KEY = 'lovable_export_options';

// Get saved export options from localStorage
export function getSavedExportOptions(): ExportOptions {
  try {
    const saved = localStorage.getItem(EXPORT_OPTIONS_STORAGE_KEY);
    if (saved) {
      return { ...DEFAULT_EXPORT_OPTIONS, ...JSON.parse(saved) };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_EXPORT_OPTIONS;
}

// Save export options to localStorage
export function saveExportOptions(options: ExportOptions): void {
  try {
    localStorage.setItem(EXPORT_OPTIONS_STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Ignore storage errors
  }
}
