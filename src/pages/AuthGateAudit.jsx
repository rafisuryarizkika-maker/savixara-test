import React, { useState } from 'react';
import { supabase } from '../supabase';

export default function AuthGateAudit() {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [verifiedFactorId, setVerifiedFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [mfaWorking, setMfaWorking] = useState(false);

  async function runAuthGateCheck() {
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

      if (currentLevel !== 'aal2' && nextLevel === 'aal2') {
        const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;
        const verifiedTotp = (factors?.totp || []).find((factor) => factor.status === 'verified');
        setVerifiedFactorId(verifiedTotp?.id || '');
      } else {
        setVerifiedFactorId('');
      }

      // Supabase JS attaches the current user's access token internally.
      // The token is never displayed, logged, or copied into the page.
      // This invokes only the isolated auth-gate function, never the provider.
      const { data, error: invokeError } =
        await supabase.functions.invoke('melostore-auth-gate-audit-v2', {
          body: {}
        });

      if (invokeError) {
        let responseBody = null;
        const status = invokeError.context?.status ?? null;

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
        message: 'Endpoint menerima permintaan. Cocokkan hasilnya dengan tingkat AAL dan status akun yang digunakan.'
      });
    } catch (err) {
      setError(err?.message || 'Pengujian gagal karena kesalahan yang tidak diketahui.');
    } finally {
      setChecking(false);
    }
  }

  async function completeMfaChallenge(event) {
    event.preventDefault();
    if (!verifiedFactorId || !/^\\d{6}$/.test(mfaCode)) {
      setError('Masukkan kode 6 digit dari aplikasi autentikator.');
      return;
    }

    setMfaWorking(true);
    setError('');
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: verifiedFactorId,
        code: mfaCode
      });
      if (verifyError) throw verifyError;
      setMfaCode('');
      await runAuthGateCheck();
    } catch (err) {
      setError(err?.message || 'Verifikasi MFA gagal.');
    } finally {
      setMfaWorking(false);
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
        <h1 style={{ marginTop: 8 }}>Tes Endpoint AAL2 & Hak Admin</h1>
        <p style={{ color: '#CBD5E1', lineHeight: 1.6 }}>
          Halaman ini memeriksa sesi dan tingkat autentikasi saat ini, lalu
          memanggil endpoint pemeriksaan autentikasi saja. Endpoint akan
          memeriksa AAL2 dan hak admin. Halaman ini tidak menjalankan
          sinkronisasi, tidak memanggil Melostore, dan tidak mengubah katalog.
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
          <strong style={{ color: '#F8FAFC' }}>Tujuan pengujian</strong>
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Non-admin dengan AAL2 harus ditolak sebagai bukan admin.</li>
            <li>Admin dengan AAL2 harus lolos pemeriksaan autentikasi.</li>
            <li>Sesi AAL1 tetap harus ditolak karena belum memenuhi MFA.</li>
            <li>Token dikelola oleh Supabase JS dan tidak ditampilkan.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={runAuthGateCheck}
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
          {checking ? 'Memeriksa sesi dan endpoint...' : 'Jalankan Tes Autentikasi'}
        </button>

        {result?.currentLevel !== 'aal2' && result?.nextLevel === 'aal2' && verifiedFactorId && (
          <form onSubmit={completeMfaChallenge} style={{
            marginTop: 18, padding: 14, borderRadius: 12,
            background: '#0B1020', border: '1px solid rgba(56,189,248,.35)'
          }}>
            <strong>Verifikasi MFA untuk sesi ini</strong>
            <p style={{ color: '#CBD5E1', lineHeight: 1.6 }}>
              Akun sudah memiliki TOTP terverifikasi, tetapi sesi masih AAL1.
              Masukkan kode 6 digit dari aplikasi autentikator untuk menaikkan sesi ke AAL2.
            </p>
            <input
              aria-label="Kode autentikator 6 digit"
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\\D/g, '').slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              style={{
                width: '100%', boxSizing: 'border-box', padding: 14,
                borderRadius: 10, border: '1px solid #334155',
                background: '#080A12', color: 'white', fontSize: 18,
                letterSpacing: 5, marginBottom: 12
              }}
            />
            <button type="submit" disabled={mfaWorking || mfaCode.length !== 6}
              style={{
                width: '100%', border: 0, borderRadius: 12, padding: 14,
                color: 'white', fontWeight: 700,
                background: 'linear-gradient(135deg,#7C3AED,#2563EB)'
              }}>
              {mfaWorking ? 'Memverifikasi MFA...' : 'Verifikasi MFA dan Ulangi Tes'}
            </button>
          </form>
        )}

        {result?.currentLevel !== 'aal2' && result?.nextLevel === 'aal2' && !verifiedFactorId && (
          <p style={{ marginTop: 16, color: '#FCA5A5' }}>
            Tidak ditemukan faktor TOTP terverifikasi pada akun ini.
          </p>
        )}

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
