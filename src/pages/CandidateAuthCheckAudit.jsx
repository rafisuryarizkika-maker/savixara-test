import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function CandidateAuthCheckAudit() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const [checkingConnection, setCheckingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [connectionError, setConnectionError] = useState('');

  const [checkingCatalog, setCheckingCatalog] = useState(false);
  const [catalogResult, setCatalogResult] = useState(null);
  const [catalogError, setCatalogError] = useState('');

  async function runMelostoreConnectionCheck() {
    setCheckingConnection(true);
    setConnectionResult(null);
    setConnectionError('');

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session) {
        throw new Error('Sesi login tidak ditemukan. Login ke SAVIXARA-test terlebih dahulu.');
      }

      const { data, error: invokeError } = await supabase.functions.invoke(
        'melostore-connection-audit',
        { method: 'POST' }
      );

      if (invokeError) {
        let response = null;
        try {
          if (invokeError.context?.clone) {
            response = await invokeError.context.clone().json();
          }
        } catch {
          response = null;
        }
        setConnectionResult({
          httpStatus: invokeError.context?.status ?? null,
          response,
          message: invokeError.message || 'Pemeriksaan koneksi ditolak.'
        });
        return;
      }

      setConnectionResult({
        httpStatus: 200,
        response: data,
        message: data?.message || 'Pemeriksaan koneksi selesai.'
      });
    } catch (err) {
      setConnectionError(err?.message || 'Pemeriksaan koneksi gagal.');
    } finally {
      setCheckingConnection(false);
    }
  }

  async function runCatalogReadAudit() {
    setCheckingCatalog(true);
    setCatalogResult(null);
    setCatalogError('');
    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session) throw new Error('Sesi login tidak ditemukan. Login terlebih dahulu.');
      const { data, error: invokeError } = await supabase.functions.invoke(
        'melostore-catalog-read-audit',
        { method: 'POST' }
      );
      if (invokeError) {
        let response = null;
        try {
          if (invokeError.context?.clone) response = await invokeError.context.clone().json();
        } catch { response = null; }
        setCatalogResult({
          httpStatus: invokeError.context?.status ?? null,
          response,
          message: invokeError.message || 'Pemeriksaan katalog ditolak.'
        });
        return;
      }
      setCatalogResult({ httpStatus: 200, response: data, message: data?.message || 'Pemeriksaan selesai.' });
    } catch (err) {
      setCatalogError(err?.message || 'Pemeriksaan katalog gagal.');
    } finally {
      setCheckingCatalog(false);
    }
  }

  async function runCandidateAuthCheck() {
    setChecking(true);
    setResult(null);
    setError('');

    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData?.session) {
        throw new Error('Sesi login tidak ditemukan. Login ke SAVIXARA-test terlebih dahulu.');
      }

      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData?.user) {
        throw new Error('Pengguna tidak terautentikasi. Silakan login kembali.');
      }

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;

      const currentLevel = assurance?.currentLevel || 'unknown';
      const nextLevel = assurance?.nextLevel || 'unknown';

      // Supabase JS attaches the current session internally.
      // The query flag is the only input; no sync request body is supplied.
      const { data, error: invokeError } = await supabase.functions.invoke(
        'melostore-sync-pricelist-candidate?auth_check_only=1',
        { method: 'POST' }
      );

      if (invokeError) {
        let response = null;
        try {
          if (invokeError.context?.clone) {
            response = await invokeError.context.clone().json();
          }
        } catch {
          response = null;
        }
        setResult({
          currentLevel, nextLevel,
          httpStatus: invokeError.context?.status ?? null,
          response,
          message: invokeError.message || 'Permintaan fungsi ditolak.'
        });
        return;
      }

      setResult({
        currentLevel, nextLevel, httpStatus: 200, response: data,
        message: 'Fungsi kandidat menerima permintaan pemeriksaan autentikasi.'
      });
    } catch (err) {
      setError(err?.message || 'Pengujian gagal karena kesalahan yang tidak diketahui.');
    } finally {
      setChecking(false);
    }
  }

  const passed = result?.httpStatus === 200 &&
    result?.response?.ok === true &&
    result?.response?.auth_check_only === true;

  return (
    <main style={{ minHeight: '100vh', background: '#080A12', color: '#F8FAFC',
      padding: '28px 18px', fontFamily: 'system-ui, sans-serif' }}>
      <section style={{ maxWidth: 680, margin: '0 auto', background: '#111522',
        border: '1px solid rgba(148,163,184,.2)', borderRadius: 18, padding: 24 }}>
        <p style={{ color: '#38BDF8', fontWeight: 700, letterSpacing: 1 }}>
          SAVIXARA TEST · KANDIDAT EDGE FUNCTION
        </p>
        <h1 style={{ marginTop: 8 }}>Tes auth_check_only Kandidat</h1>
        <p style={{ color: '#CBD5E1', lineHeight: 1.65 }}>
          Halaman ini menguji fungsi kandidat melostore-sync-pricelist-candidate
          pada proyek savixara-test dengan parameter auth_check_only=1.
          Tidak ada body sinkronisasi yang dikirim.
        </p>
        <div style={{ background: '#0B1020', borderRadius: 12, padding: 14,
          margin: '18px 0', color: '#CBD5E1', fontSize: 14, lineHeight: 1.7 }}>
          <strong style={{ color: '#F8FAFC' }}>Batas keamanan tes</strong>
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Target aplikasi dikunci ke proyek tes savixara-test.</li>
            <li>Sesi dikelola oleh Supabase JS; token tidak ditampilkan.</li>
            <li>Hanya parameter auth_check_only=1 yang dikirim.</li>
            <li>Tidak memanggil Melostore dan tidak mengubah katalog.</li>
          </ul>
        </div>
        <button type="button" onClick={runCandidateAuthCheck} disabled={checking}
          style={{ width: '100%', border: 0, borderRadius: 12, padding: '14px 18px',
            color: 'white', fontWeight: 700,
            background: checking ? '#475569' : 'linear-gradient(135deg,#7C3AED,#2563EB)' }}>
          {checking ? 'Memeriksa fungsi kandidat...' : 'Uji Fungsi Kandidat'}
        </button>
        {error && <div role="alert" style={{ marginTop: 18, padding: 14,
          borderRadius: 12, background: 'rgba(248,113,113,.12)',
          border: '1px solid rgba(248,113,113,.35)', overflowWrap: 'anywhere' }}>
          <strong>Pengujian belum berhasil</strong><p>{error}</p>
        </div>}
        {result && <div role="status" style={{ marginTop: 18, padding: 14,
          borderRadius: 12, background: '#0B1020',
          border: '1px solid rgba(56,189,248,.35)', overflowWrap: 'anywhere' }}>
          <strong>Hasil pemeriksaan fungsi kandidat</strong>
          <p>Tingkat sesi saat ini: <b>{result.currentLevel}</b></p>
          <p>Tingkat berikutnya: <b>{result.nextLevel}</b></p>
          <p>Status HTTP: <b>{result.httpStatus ?? 'tidak tersedia'}</b></p>
          <p>{result.message}</p>
          <p style={{ color: passed ? '#86EFAC' : '#FCA5A5', fontWeight: 700 }}>
            {passed ? 'LULUS: auth_check_only diterima fungsi kandidat.'
              : 'BELUM LULUS: periksa respons fungsi kandidat di bawah.'}
          </p>
          {result.response && <pre style={{ whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere', background: '#05070D', padding: 12,
            borderRadius: 8, fontSize: 12 }}>
            {JSON.stringify(result.response, null, 2)}
          </pre>}
        </div>}

        <div style={{ height: 1, background: 'rgba(148,163,184,.2)', margin: '26px 0' }} />
        <h2 style={{ marginBottom: 8 }}>Tes koneksi API Melostore (read-only)</h2>
        <p style={{ color: '#CBD5E1', lineHeight: 1.65 }}>
          Memeriksa kredensial melalui GET /api/v1/h2h/profile.
          Hanya admin dengan AAL2 yang dapat menjalankan tes ini.
          Respons profil sensitif tidak ditampilkan; tidak ada pesanan,
          sinkronisasi, atau perubahan katalog.
        </p>
        <button type="button" onClick={runMelostoreConnectionCheck}
          disabled={checkingConnection}
          style={{ width: '100%', border: 0, borderRadius: 12, padding: '14px 18px',
            color: 'white', fontWeight: 700,
            background: checkingConnection ? '#475569' : 'linear-gradient(135deg,#0F766E,#0891B2)' }}>
          {checkingConnection ? 'Memeriksa koneksi Melostore...' : 'Uji Koneksi Melostore (GET Profile)'}
        </button>
        {connectionError && <div role="alert" style={{ marginTop: 18, padding: 14,
          borderRadius: 12, background: 'rgba(248,113,113,.12)',
          border: '1px solid rgba(248,113,113,.35)', overflowWrap: 'anywhere' }}>
          <strong>Koneksi belum terverifikasi</strong><p>{connectionError}</p>
        </div>}
        {connectionResult && <div role="status" style={{ marginTop: 18, padding: 14,
          borderRadius: 12, background: '#0B1020',
          border: '1px solid rgba(56,189,248,.35)', overflowWrap: 'anywhere' }}>
          <strong>Hasil tes koneksi Melostore</strong>
          <p>Status HTTP: <b>{connectionResult.httpStatus ?? 'tidak tersedia'}</b></p>
          <p>{connectionResult.message}</p>
          {connectionResult.response?.account_mode &&
            <p>Mode akun H2H: <b>{connectionResult.response.account_mode}</b></p>}
          <p style={{ color: connectionResult.response?.provider_authenticated === true
            ? '#86EFAC' : '#FCA5A5', fontWeight: 700 }}>
            {connectionResult.response?.provider_authenticated === true
              ? 'TERHUBUNG: autentikasi API Melostore berhasil.'
              : 'BELUM TERVERIFIKASI: periksa hasil dan mode akun.'}
          </p>
          {connectionResult.response && <pre style={{ whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere', background: '#05070D', padding: 12,
            borderRadius: 8, fontSize: 12 }}>
            {JSON.stringify(connectionResult.response, null, 2)}
          </pre>}
        </div>}

        <div style={{ height: 1, background: 'rgba(148,163,184,.2)', margin: '26px 0' }} />
        <h2 style={{ marginBottom: 8 }}>Audit katalog Melostore (GET read-only)</h2>
        <p style={{ color: '#CBD5E1', lineHeight: 1.65 }}>
          Mengambil maksimal 5 contoh dari katalog reguler dan Smart. Memeriksa bentuk SKU,
          harga, status, varian, serta metadata pagination. Hanya admin AAL2.
          Tidak membuat job, tidak menjalankan sinkronisasi, dan tidak mengubah katalog.
        </p>
        <button type="button" onClick={runCatalogReadAudit} disabled={checkingCatalog}
          style={{ width: '100%', border: 0, borderRadius: 12, padding: '14px 18px',
            color: 'white', fontWeight: 700,
            background: checkingCatalog ? '#475569' : 'linear-gradient(135deg,#6D28D9,#2563EB)' }}>
          {checkingCatalog ? 'Memeriksa katalog...' : 'Uji Katalog Reguler + Smart (GET)'}
        </button>
        {catalogError && <div role="alert" style={{ marginTop: 18, padding: 14,
          borderRadius: 12, background: 'rgba(248,113,113,.12)',
          border: '1px solid rgba(248,113,113,.35)', overflowWrap: 'anywhere' }}>
          <strong>Audit katalog belum berhasil</strong><p>{catalogError}</p>
        </div>}
        {catalogResult && <div role="status" style={{ marginTop: 18, padding: 14,
          borderRadius: 12, background: '#0B1020',
          border: '1px solid rgba(56,189,248,.35)', overflowWrap: 'anywhere' }}>
          <strong>Hasil audit katalog Melostore</strong>
          <p>Status HTTP: <b>{catalogResult.httpStatus ?? 'tidak tersedia'}</b></p>
          <p>{catalogResult.message}</p>
          <p style={{ color: catalogResult.response?.ok === true ? '#86EFAC' : '#FCA5A5', fontWeight: 700 }}>
            {catalogResult.response?.ok === true
              ? 'LULUS: struktur respons katalog berhasil dibaca.'
              : 'BELUM LULUS: periksa respons katalog di bawah.'}
          </p>
          {catalogResult.response && <pre style={{ whiteSpace: 'pre-wrap',
            overflowWrap: 'anywhere', background: '#05070D', padding: 12,
            borderRadius: 8, fontSize: 12 }}>
            {JSON.stringify(catalogResult.response, null, 2)}
          </pre>}
        </div>}

        <a href="/savixara-test/" style={{ display: 'inline-block', marginTop: 22,
          color: '#93C5FD', textDecoration: 'none' }}>
          ← Kembali ke SAVIXARA test
        </a>
      </section>
    </main>
  );
}
