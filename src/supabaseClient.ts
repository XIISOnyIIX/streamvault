// src/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://tvifqpyuuvduskopkxjh.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR2aWZxcHl1dXZkdXNrb3BreGpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgyNzcxNzMsImV4cCI6MjA2Mzg1MzE3M30.tRs20IKtkoIXEhtDsq2p1f5IxhuaQQfBWjLGvh2jOhk';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key are required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
