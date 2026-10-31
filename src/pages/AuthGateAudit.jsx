import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function AuthGateAudit() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  async function runAal1Check() {
    setChecking(true);
    setResult(null);
    setError('');

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!sessionData?.session?.access_token) {
        setError('Sesi login tidak ditemukan. Silakan login melalui aplikasi SAVIXARA test terlebih dahulu.');
        return;
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError) throw userError;
      if (!userData?.user) {
        setError('Pengguna tidak terautentikasi. Silakan login kembali.');
        return;
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceError) throw assuranceError;

      const currentLevel = assurance?.currentLevel || 'unknown';
      const nextLevel = assurance?.nextLevel || 'unknown';

      if (currentLevel !== 'aal1') {
        setResult({
          skipped: true,
          currentLevel,
          nextLevel,
          message: 'Pengujian endpoint dilewati. Halaman ini hanya menjalankan tes AAL1 agar hasilnya tidak salah ditafsirkan.'
        });
        return;
      }

      // Supabase JS attaches the current user's access token internally.
      // The token is never displayed, logged, or copied into the page.
      const { data, error: invokeError } =
        await supabase.functions.invoke('melostore-auth-gate-audit-v2', {
          body: {}
        });

      if (invokeError) {
        let responseBody = null;
        let status = invokeError.context?.status ?? null;

        try {
          if (invokeError.context && typeof invokeError.context.clone === 'function') {
            responseBody = await invokeError.context.clone().json();
          } else if (invokeError.context && typeof invokeError.context.json === 'function') {
            responseBody = await invokeError.context.json();
          }
        } catch {
          responseBody = null;
        }

        setResult({
          currentLevel,
          nextLevel,
          httpStatus: status,
          response: responseBody,
          message: invokeError.message || 'Permintaan endpoint ditolak.'
        });
        return;
      }

      setResult({
        currentLevel,
        nextLevel,
        httpStatus: 200,
        response: data,
        message: 'Endpoint menerima permintaan. Periksa hasil ini bersama tingkat AAL yang terdeteksi.'
      });
    } catch (err) {
      setError(err?.message || 'Pengujian gagal karena kesalahan yang tidak diketahui.');
    } finally {
      setChecking(false);
    }
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: '#080A12',
      color: '#F8FAFC',
      padding: '28px 18px',
      fontFamily: 'system-ui, sans-serif'
    }}>
      <section style={{
        maxWidth: 680,
        margin: '0 auto',
        background: '#111522',
        border: '1px solid rgba(148,163,184,.2)',
        borderRadius: 18,
        padding: 24
      }}>
        <p style={{ color: '#38BDF8', fontWeight: 700, letterSpacing: 1 }}>
          SAVIXARA TEST · AUDIT AUTENTIKASI
        </p>
        <h1 style={{ marginTop: 8 }}>Tes Endpoint AAL1</h1>
        <p style={{ color: '#CBD5E1', lineHeight: 1.6 }}>
          Halaman sementara ini memeriksa sesi login dan tingkat autentikasi,
          lalu mengirim permintaan hanya ke endpoint pemeriksaan autentikasi.
          Halaman ini tidak menjalankan sinkronisasi, tidak memanggil Melostore,
          dan tidak mengubah katalog.
        </p>

        <div style={{
          background: '#0B1020',
          borderRadius: 12,
          padding: 14,
          margin: '18px 0',
          color: '#CBD5E1',
          fontSize: 14,
          lineHeight: 1.7
        }}>
          <strong style={{ color: '#F8FAFC' }}>Batas pengujian</strong>
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Hanya berjalan jika sesi aktif berada pada AAL1.</li>
            <li>Token tetap dikelola oleh Supabase JS dan tidak ditampilkan.</li>
            <li>Jika sesi AAL2, permintaan tidak dikirim.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={runAal1Check}
          disabled={checking}
          style={{
            width: '100%',
            border: 0,
            borderRadius: 12,
            padding: '14px 18px',
            color: 'white',
            fontWeight: 700,
            background: checking ? '#475569' : 'linear-gradient(135deg,#7C3AED,#2563EB)',
            cursor: checking ? 'wait' : 'pointer'
          }}
        >
          {checking ? 'Memeriksa sesi dan endpoint...' : 'Jalankan Tes AAL1'}
        </button>

        {error && (
          <div role="alert" style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            background: 'rgba(248,113,113,.12)',
            border: '1px solid rgba(248,113,113,.35)',
            overflowWrap: 'anywhere'
          }}>
            <strong>Pengujian belum berhasil</strong>
            <p style={{ marginBottom: 0 }}>{error}</p>
          </div>
        )}

        {result && (
          <div role="status" style={{
            marginTop: 18,
            padding: 14,
            borderRadius: 12,
            background: '#0B1020',
            border: '1px solid rgba(56,189,248,.35)',
            overflowWrap: 'anywhere'
          }}>
            <strong>Hasil pemeriksaan</strong>
            <p>Tingkat sesi saat ini: <b>{result.currentLevel}</b></p>
            <p>Tingkat berikutnya: <b>{result.nextLevel}</b></p>
            {result.httpStatus != null && <p>Status HTTP: <b>{result.httpStatus}</b></p>}
            <p>{result.message}</p>
            {result.response && (
              <pre style={{
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
                background: '#05070D',
                padding: 12,
                borderRadius: 8,
                fontSize: 12
              }}>
                {JSON.stringify(result.response, null, 2)}
              </pre>
            )}
            {result.skipped && (
              <p style={{ color: '#FBBF24' }}>
                Endpoint tidak dipanggil karena sesi bukan AAL1.
              </p>
            )}
          </div>
        )}

        <a
          href="/savixara-test/"
          style={{
            display: 'inline-block',
            marginTop: 22,
            color: '#93C5FD',
            textDecoration: 'none'
          }}
        >
          ← Kembali ke SAVIXARA test
        </a>
      </section>
    </main>
  );
}
