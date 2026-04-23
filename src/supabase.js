import { createClient } from '@supabase/supabase-js'

// Ganti dengan URL dan anon key dari Supabase project Anda
const SUPABASE_URL  = 'https://wplwokaolgfcjxtuqmyl.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndwbHdva2FvbGdmY2p4dHVxbXlsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3Mzk0NTcsImV4cCI6MjA5MjMxNTQ1N30.OBYMl5vmN6FwT7-0Qc2XHtm8pbodBSXkWk55_gt-v6Q'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)
