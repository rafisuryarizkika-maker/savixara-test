import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function MfaEnrollmentAudit() {
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [email, setEmail] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      try {
        const { data: sessionData, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;
        if (!sessionData?.session) {
          throw new Error('Sesi login tidak ditemukan. Login ke SAVIXARA test terlebih dahulu.');
        }

        const { data: userData, error: userError } =
          await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData?.user) throw new Error('Akun tidak dapat diverifikasi.');

        const { data: factorsData, error: factorsError } =
          await supabase.auth.mfa.listFactors();
        if (factorsError) throw factorsError;

        if (!active) return;
        setEmail(userData.user.email || '');
        const verifiedTotp = (factorsData?.totp || []).find(
          (factor) => factor.status === 'verified'
        );

        if (verifiedTotp) {
          setVerified(true);
          setMessage('Akun ini sudah memiliki MFA TOTP terverifikasi. Tidak perlu mendaftarkan faktor baru.');
        }
      } catch (err) {
        if (active) setError(err?.message || 'Gagal memeriksa sesi akun.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccount();
    return () => { active = false; };
  }, []);

  async function beginEnrollment() {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'SAVIXARA Test Authenticator'
      });
      if (enrollError) throw enrollError;

      if (!data?.id || !data?.totp?.qr_code) {
        throw new Error('Supabase tidak mengembalikan QR code pendaftaran.');
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setMessage('Pindai QR code dengan aplikasi autentikator, lalu masukkan kode 6 digit yang muncul.');
    } catch (err) {
      setError(err?.message || 'Pendaftaran MFA gagal dimulai.');
    } finally {
      setWorking(false);
    }
  }

  async function verifyEnrollment(event) {
    event.preventDefault();
    if (!factorId || !/^\d{6}$/.test(code)) {
      setError('Masukkan kode autentikator yang terdiri dari 6 angka.');
      return;
    }

    setWorking(true);
    setError('');
    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code
      });
      if (verifyError) throw verifyError;

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (assuranceError) throw assuranceError;

      setVerified(true);
      setQrCode('');
      setCode('');
      setMessage(
        assurance?.currentLevel === 'aal2'
          ? 'MFA berhasil diverifikasi. Sesi akun sekarang berada pada AAL2.'
          : 'Faktor MFA terverifikasi. Periksa kembali tingkat sesi sebelum melanjutkan audit.'
      );
    } catch (err) {
      setError(err?.message || 'Kode MFA tidak dapat diverifikasi.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <main style={{
      minHeight: '100vh', background: '#080A12', color: '#F8FAFC',
      padding: '28px 18px', fontFamily: 'system-ui, sans-serif'
    }}>
      <section style={{
        maxWidth: 680, margin: '0 auto', padding: 24,
        background: '#111522', border: '1px solid rgba(148,163,184,.2)',
        borderRadius: 18
      }}>
        <p style={{ color: '#38BDF8', fontWeight: 700, letterSpacing: 1 }}>
          SAVIXARA TEST · AUDIT AUTENTIKASI
        </p>
        <h1 style={{ marginTop: 8 }}>Pendaftaran MFA TOTP</h1>
        <p style={{ color: '#CBD5E1', lineHeight: 1.7 }}>
          Halaman sementara untuk mendaftarkan autentikasi dua faktor pada akun
          SAVIXARA test yang sedang login. Pendaftaran dilakukan sendiri oleh
          pemilik akun melalui Supabase.
        </p>

        <div style={{
          background: '#0B1020', borderRadius: 12, padding: 14,
          margin: '18px 0', color: '#CBD5E1', lineHeight: 1.7
        }}>
          <strong style={{ color: '#F8FAFC' }}>Akun aktif</strong>
          <p style={{ margin: '8px 0 0', overflowWrap: 'anywhere' }}>
            {loading ? 'Memeriksa sesi...' : (email || 'Tidak ada sesi login')}
          </p>
          <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
            <li>Hanya menggunakan proyek Supabase savixara-test.</li>
            <li>Tidak mengubah peran akun atau memberikan hak admin.</li>
            <li>Tidak memanggil Melostore dan tidak mengubah katalog.</li>
            <li>QR code hanya ditampilkan pada sesi akun yang sedang login.</li>
          </ul>
        </div>

        {!loading && !verified && !qrCode && (
          <button type="button" onClick={beginEnrollment} disabled={working}
            style={{
              width: '100%', border: 0, borderRadius: 12, padding: 15,
              color: 'white', fontWeight: 700,
              background: 'linear-gradient(135deg,#7C3AED,#2563EB)'
            }}>
            {working ? 'Menyiapkan pendaftaran...' : 'Mulai Pendaftaran MFA'}
          </button>
        )}

        {qrCode && !verified && (
          <div style={{
            marginTop: 18, padding: 16, borderRadius: 12,
            background: '#0B1020', textAlign: 'center'
          }}>
            <h2 style={{ fontSize: 19 }}>Pindai QR code</h2>
            <p style={{ color: '#CBD5E1', lineHeight: 1.6 }}>
              Buka aplikasi autentikator, tambahkan akun dengan memindai QR code ini.
              Jangan bagikan QR code atau screenshot halaman ini.
            </p>
            <img src={qrCode} alt="QR code pendaftaran MFA"
              style={{ width: 220, maxWidth: '100%', background: 'white',
                padding: 10, borderRadius: 10 }} />
            <form onSubmit={verifyEnrollment}
              style={{ display: 'grid', gap: 12, marginTop: 18, textAlign: 'left' }}>
              <label htmlFor="mfa-code">Kode 6 digit dari aplikasi autentikator</label>
              <input id="mfa-code" value={code}
                onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                inputMode="numeric" autoComplete="one-time-code"
                pattern="[0-9]{6}" maxLength={6} required
                style={{ width: '100%', boxSizing: 'border-box', padding: 14,
                  borderRadius: 10, border: '1px solid #334155',
                  background: '#080A12', color: 'white', fontSize: 18,
                  letterSpacing: 5 }} />
              <button type="submit" disabled={working || code.length !== 6}
                style={{ width: '100%', border: 0, borderRadius: 12, padding: 14,
                  color: 'white', fontWeight: 700,
                  background: 'linear-gradient(135deg,#7C3AED,#2563EB)' }}>
                {working ? 'Memverifikasi...' : 'Verifikasi dan Aktifkan MFA'}
              </button>
            </form>
          </div>
        )}

        {message && <div role="status" style={{
          marginTop: 18, padding: 14, borderRadius: 12,
          background: '#0B1020', border: '1px solid rgba(56,189,248,.35)',
          lineHeight: 1.7
        }}>{message}</div>}

        {error && <div role="alert" style={{
          marginTop: 18, padding: 14, borderRadius: 12,
          background: 'rgba(248,113,113,.12)',
          border: '1px solid rgba(248,113,113,.35)',
          overflowWrap: 'anywhere'
        }}><strong>Pendaftaran belum berhasil</strong><p>{error}</p></div>}

        {verified && <a href="/savixara-test/?audit-auth-aal2=1"
          style={{ display: 'inline-block', marginTop: 20, color: '#93C5FD' }}>
          Lanjut ke tes endpoint AAL2 & hak admin
        </a>}

        <a href="/savixara-test/"
          style={{ display: 'inline-block', marginTop: 22, color: '#93C5FD' }}>
          ← Kembali ke SAVIXARA test
        </a>
      </section>
    </main>
  );
}
