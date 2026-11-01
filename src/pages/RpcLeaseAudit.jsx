import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function RpcLeaseAudit() {
  const [state, setState] = useState('idle');
  const [message, setMessage] = useState('Siap memeriksa sesi admin test.');
  const [result, setResult] = useState(null);

  async function runAudit() {
    if (state === 'running' || state === 'done') return;
    setState('running');
    setMessage('Memeriksa sesi, hak admin, dan AAL2...');
    setResult(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const session = sessionData?.session;
      if (!session?.access_token) throw new Error('Sesi login tidak ditemukan. Login ke proyek test terlebih dahulu.');

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData?.user) throw new Error('Sesi pengguna tidak valid.');

      const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalError) throw aalError;
      if (aal?.currentLevel !== 'aal2') throw new Error('Sesi belum mencapai AAL2. Selesaikan verifikasi MFA admin terlebih dahulu.');

      const { data: isAdmin, error: adminError } = await supabase.rpc('is_admin');
      if (adminError || isAdmin !== true) throw new Error('Akun ini tidak memiliki hak admin pada proyek test.');

      setMessage('Sesi admin AAL2 valid. Menjalankan audit RPC terisolasi...');
      const { data, error } = await supabase.functions.invoke('melostore-rpc-lease-audit', {
        body: { run_audit: true },
      });
      if (error) {
        let detail = error.message || 'Permintaan Edge Function gagal.';
        if (error.context && typeof error.context.json === 'function') {
          try {
            const body = await error.context.json();
            detail = body?.message || detail;
          } catch { /* retain safe generic error */ }
        }
        throw new Error(detail);
      }
      if (!data?.ok) throw new Error(data?.message || 'Audit RPC tidak berhasil.');

      setResult(data);
      setMessage('Audit RPC selesai. Periksa hasil pemeriksaan di bawah.');
      setState('done');
    } catch (error) {
      setMessage(error?.message || 'Audit gagal karena kesalahan yang tidak diketahui.');
      setState('error');
    }
  }

  return (
    <main className="admin-page">
      <header className="admin-heading">
        <p className="admin-eyebrow">SAVIXARA TEST · SECURITY AUDIT</p>
        <h1>Audit RPC Lease</h1>
        <p>Pengujian menggunakan sesi login aktif. Access token tidak ditampilkan atau disalin.</p>
      </header>

      <section className="admin-panel">
        <h2>Ruang lingkup aman</h2>
        <ul>
          <li>Memastikan akun admin dan sesi AAL2.</li>
          <li>Menguji RPC dengan array produk kosong.</li>
          <li>Menguji lease valid, halaman duplikat, token salah, dan lease kedaluwarsa.</li>
          <li>Tidak memanggil API Melostore dan tidak mengubah katalog.</li>
        </ul>
        <p className="admin-message" role="status">{message}</p>
        <button type="button" onClick={runAudit} disabled={state === 'running' || state === 'done'}>
          {state === 'running' ? 'Sedang menguji...' : state === 'done' ? 'Audit sudah dijalankan' : 'Jalankan Audit RPC Test'}
        </button>
        {state === 'error' && <p>Perbaiki kondisi yang disebutkan, lalu muat ulang halaman jika ingin mencoba kembali.</p>}
      </section>

      {result && (
        <section className="admin-panel">
          <h2>Hasil Audit</h2>
          <p>Status: BERHASIL</p>
          <p>Provider dipanggil: {result.provider_called ? 'Ya' : 'Tidak'}</p>
          <p>Katalog berubah: {result.catalog_changed ? 'Ya' : 'Tidak'}</p>
          <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
            {JSON.stringify(result.checks, null, 2)}
          </pre>
        </section>
      )}
    </main>
  );
}
