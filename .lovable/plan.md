

# Exhibit Mode: Live Print Queue for Bambu Lab

## Concept

Visitors interact with the generator on a kiosk, enter their name/email, and tap "Send to Print." Their design enters a queue visible on a separate operator screen. The operator reviews and sends to the Bambu Lab printer.

```text
  ┌─────────────┐     ┌──────────────┐     ┌───────────┐
  │  KIOSK      │────▶│  PRINT QUEUE │────▶│  PRINTER  │
  │  (visitor)  │     │  (database)  │     │  (Bambu)  │
  │             │     │              │     │           │
  │ Design →    │     │ Operator     │     │ X1C/P1S   │
  │ Name/email  │     │ dashboard    │     │           │
  │ "Print!"    │     │ approve/send │     │           │
  └─────────────┘     └──────────────┘     └───────────┘
```

## What to Build

### 1. Print Queue Database
- `print_queue` table: id, visitor_name, visitor_email, params (jsonb), object_type, stl_url (stored in Supabase storage), thumbnail_url, status (pending/printing/done/failed), printer_id, created_at, started_at, completed_at
- RLS: public can INSERT (submit), only authenticated admin can UPDATE/SELECT all

### 2. STL Upload to Storage
- New storage bucket `print-files` for STL files
- When visitor taps "Print", generate STL blob client-side, upload to storage, create queue entry

### 3. Visitor Submit Flow (Kiosk Side)
- New `ExhibitSubmitDialog` component: name + email fields, "Send to Print" button
- Replaces the export/payment flow in exhibit mode
- After submit: show confirmation with queue position, auto-reset after 10 seconds
- New URL param `?exhibit=true` activates exhibit mode (hides export/payment, shows "Print" button instead)

### 4. Operator Dashboard (`/exhibit-admin`)
- Protected page (simple password or Supabase auth)
- Live queue list with realtime updates (Supabase realtime on print_queue)
- Each entry shows: thumbnail, visitor name, time submitted, status
- Actions per entry: "Download STL", "Mark Printing", "Mark Done", "Reject"
- Stats: items in queue, average wait, completed today

### 5. Bambu Lab Integration (Phase 2 — manual first)
- Initially: operator downloads STL from dashboard and loads into Bambu Studio manually
- Future: Bambu Cloud API integration via edge function (requires Bambu access token + printer serial)
- The queue + storage architecture supports both workflows

### 6. Exhibit Mode UI Tweaks
- When `?exhibit=true`: hide header nav links, hide export/payment buttons, hide drawer
- Show large "Print This!" button instead of export
- Auto-randomize after 30s idle (attract mode)
- Auto-reset form after successful submission

## Files

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: `print_queue` table + RLS |
| `src/components/exhibit/ExhibitSubmitDialog.tsx` | **New** — visitor name/email + submit |
| `src/components/exhibit/ExhibitQueueStatus.tsx` | **New** — confirmation + queue position |
| `src/pages/ExhibitAdmin.tsx` | **New** — operator dashboard with live queue |
| `src/lib/exhibit-submit.ts` | **New** — generate STL, upload, create queue entry |
| `src/pages/Index.tsx` | Detect `?exhibit=true`, swap export for print flow |
| `src/App.tsx` | Add `/exhibit-admin` route |

## Database Schema

```sql
CREATE TABLE print_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_name text NOT NULL,
  visitor_email text,
  params jsonb NOT NULL,
  object_type text NOT NULL,
  stl_url text,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

ALTER TABLE print_queue ENABLE ROW LEVEL SECURITY;

-- Anyone can submit
CREATE POLICY "Public can submit prints"
  ON print_queue FOR INSERT TO anon WITH CHECK (true);

-- Only authenticated users (operator) can view/manage
CREATE POLICY "Authenticated can view queue"
  ON print_queue FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can update queue"
  ON print_queue FOR UPDATE TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE print_queue;
```

## Visitor Flow

1. Visitor designs shape on kiosk (exhibit mode)
2. Taps "Print This!" → dialog asks name + optional email
3. STL generates client-side, uploads to storage
4. Queue entry created → visitor sees "You're #3 in line!"
5. Screen resets to fresh shape after 10 seconds

## Operator Flow

1. Opens `/exhibit-admin` on tablet/laptop, logs in
2. Sees live queue updating in realtime
3. Downloads STL → loads into Bambu Studio → starts print
4. Marks entry as "Printing" then "Done"
5. If visitor left email, they get notified (future enhancement)

## Technical Notes

- Exhibit mode is toggled by URL parameter, no code fork — same app, different UI surface
- STL generation reuses existing `exportBodyToSTL()` function
- Realtime subscription on `print_queue` keeps operator dashboard live
- Storage bucket `print-files` with public read access so operator can download
- Admin auth: simple Supabase email/password login on the admin page

