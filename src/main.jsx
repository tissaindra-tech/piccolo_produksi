import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// iPhone: setelah keyboard ditutup, layar kadang tidak kembali ke tinggi penuh sehingga menu bawah "menggantung"
// di tengah dengan area kosong di bawahnya. Menggulir ke posisi yang sama memaksa browser menghitung ulang ukuran layar.
document.addEventListener('focusout', (e) => {
  if (!e.target?.matches?.('input, textarea, select')) return
  setTimeout(() => window.scrollTo(window.scrollX, window.scrollY), 100)
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
