

# Fix: STL Upload RLS Policy

## Problem
The storage INSERT policy `Anyone can upload print files` on `storage.objects` is restricted to the `anon` role only. This causes "new row violates row-level security policy" when uploading STL files.

## Fix
Drop the existing policy and recreate it targeting both `anon` and `authenticated` roles.

### Database Migration
```sql
DROP POLICY IF EXISTS "Anyone can upload print files" ON storage.objects;

CREATE POLICY "Anyone can upload print files"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'print-files');
```

## Files
| File | Change |
|------|--------|
| New migration | Update storage INSERT policy to allow both `anon` and `authenticated` roles |

One migration, no code file changes needed.

