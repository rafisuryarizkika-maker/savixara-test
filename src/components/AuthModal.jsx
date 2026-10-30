import React, { useState } from 'react';
import { supabase } from '../supabase';
import { X, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage('');

    if (!email.trim() || !password) {
      setMessage('Email dan kata sandi wajib diisi.');
      return;
    }

    if (password.length < 6) {
      setMessage('Kata sandi minimal 6 karakter.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          });

        if (error) throw error;

        setMessage('Login berhasil!');
        onSuccess?.(data.user);
        onClose?.();
      } else {
        
const { data, error } = await supabase.auth.signUp({
  email: email.trim(),
  password,
  options: {
    emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`
  }
});
        

        if (error) throw error;

        if (data.session) {
          setMessage('Pendaftaran berhasil!');
          onSuccess?.(data.user);
          onClose?.();
        } else {
          setMessage(
            'Pendaftaran berhasil. Periksa email untuk verifikasi akun.'
          );
        }
      }
    } catch (error) {
      setMessage(error.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Login SAVIXARA"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="auth-close"
          onClick={onClose}
          aria-label="Tutup"
        >
          <X size={22} />
        </button>

        <div className="auth-brand">SAVIXARA</div>
        <h2>
          {mode === 'login' ? 'Selamat datang kembali!' : 'Buat akun baru'}
        </h2>
        <p className="auth-description">
          {mode === 'login'
            ? 'Login untuk melanjutkan pengalaman gaming kamu.'
            : 'Daftar untuk mulai menggunakan akun SAVIXARA.'}
        </p>

        <form onSubmit={handleSubmit}>
          <label htmlFor="auth-email">Email</label>
          <div className="auth-input-wrap">
            <Mail size={18} />
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              placeholder="nama@email.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <label htmlFor="auth-password">Kata sandi</label>
          <div className="auth-input-wrap">
            <LockKeyhole size={18} />
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {message && (
            <p className="auth-message" role="status">
              {message}
            </p>
          )}

          <button
            type="submit"
            className="auth-submit"
            disabled={loading}
          >
            {loading
              ? 'Memproses...'
              : mode === 'login'
                ? 'Masuk'
                : 'Daftar sekarang'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? 'Belum punya akun?' : 'Sudah punya akun?'}
          {' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setMessage('');
            }}
          >
            {mode === 'login' ? 'Daftar' : 'Login'}
          </button>
        </p>
      </section>
    </div>
  );
            }
              
