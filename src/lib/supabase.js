import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://tvaswbatjcucmnnkzjst.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2YXN3YmF0amN1Y21ubmt6anN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTU4MzQsImV4cCI6MjA5Nzk3MTgzNH0.S9l_mAeHHLSbMC-sHenyMK7udxE9sdeV2USImHaJQWE';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
