import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// Yang di-scroll adalah #root (lihat index.html); jendela browser sendiri seharusnya selalu di posisi 0.
// iPhone tetap bisa menggeser jendela saat keyboard terbuka supaya kolom isian terlihat, dan kadang tidak
// mengembalikannya setelah keyboard ditutup, sehingga menu bawah "menggantung" dengan area kosong di bawahnya.
// Begitu keyboard tertutup (layar kembali tinggi penuh) atau kolom isian ditinggalkan, jendela dikembalikan ke 0.
const pulihkanJendela = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0) }
window.visualViewport?.addEventListener('resize', () => {
  if (window.visualViewport.height >= window.innerHeight - 60) setTimeout(pulihkanJendela, 50)
})
document.addEventListener('focusout', (e) => {
  if (!e.target?.matches?.('input, textarea, select')) return
  setTimeout(pulihkanJendela, 300)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
