import { createClient } from '@supabase/supabase-js'

// =====================================================
// PICCOLO CORNER - Supabase Config
// =====================================================
// GANTI 2 NILAI DI BAWAH dengan credentials dari project Supabase kamu:
// 1. Login ke supabase.com
// 2. Project Settings → API
// 3. Copy "Project URL" dan "anon public" key
// =====================================================

const SUPABASE_URL = 'https://uepywjdrwquxommmumtx.supabase.co'
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlcHl3amRyd3F1eG9tbW11bXR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzODc2MzUsImV4cCI6MjA5Mzk2MzYzNX0.ihP4Ul5wazUlvTKdF0Ac2G77nwpFOeaR585srmPnzkU'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Helper untuk generate ID berbasis timestamp (sesuai pattern v1)
export const generateId = () => Date.now() + Math.floor(Math.random() * 1000)

// Helper untuk format tanggal Indonesia
export const formatTanggal = (date = new Date()) => {
  const d = new Date(date)
  return d.toISOString().split('T')[0] // YYYY-MM-DD
}

export const formatTanggalID = (date) => {
  if (!date) return '-'
  const d = new Date(date)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
                  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export const formatRupiah = (n) => {
  if (!n && n !== 0) return 'Rp -'
  return 'Rp ' + Number(n).toLocaleString('id-ID')
}

// Helper: Selisih hari dari sekarang
export const daysFromNow = (dateStr) => {
  if (!dateStr) return null
  const target = new Date(dateStr)
  const now = new Date()
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24))
  return diff
}
