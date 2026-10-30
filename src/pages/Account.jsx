import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import {
  UserRound,
  Mail,
  ShoppingBag,
  Clock,
  CheckCircle2,
  ArrowLeft,
  LogOut,
  RefreshCw
} from 'lucide-react';

export default function Account({ onBack }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadAccount() {
      try {
        const { data, error } =
          await supabase.auth.getUser();

        if (error) throw error;

        if (active) {
          setUser(data.user ?? null);
        }

        if (data.user) {
          const result = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', data.user.id)
            .order('created_at', { ascending: false });

          if (result.error) {
            if (active) {
              setError(
                'Riwayat transaksi belum tersedia. Silakan coba lagi nanti.'
              );
            }
          } else if (active) {
            setOrders(result.data ?? []);
          }
        }
      } catch (err) {
        if (active) {
          setError(
            'Gagal memuat akun. Silakan login kembali.'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadAccount();

    return () => {
      active = false;
    };
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setError('Gagal keluar dari akun.');
      return;
    }

    onBack?.();
  };

  if (loading) {
    return (
      <main className="account-page">
        <p>Memuat akun SAVIXARA...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="account-page">
        <h2>Silakan login terlebih dahulu</h2>
        <button onClick={onBack}>
          <ArrowLeft size={18} /> Kembali ke beranda
        </button>
      </main>
    );
  }

  return (
    <main className="account-page">
      <button
        className="account-back"
        onClick={onBack}
      >
        <ArrowLeft size={18} />
        Kembali ke beranda
      </button>

      <section className="account-heading">
        <div className="account-avatar">
          {(user.email?.charAt(0) || 'A').toUpperCase()}
        </div>
        <div>
          <p>AKUN SAVIXARA</p>
          <h1>Profil Saya</h1>
          <span>Kelola akun dan pesanan kamu</span>
        </div>
      </section>

      <section className="account-card">
        <h2>
          <UserRound size={20} />
          Informasi Akun
        </h2>

        <div className="account-field">
          <Mail size={19} />
          <div>
            <span>Email</span>
            <strong>{user.email}</strong>
          </div>
        </div>

        <div className="account-field">
          <CheckCircle2 size={19} />
          <div>
            <span>Status akun</span>
            <strong>
              {user.email_confirmed_at
                ? 'Email terverifikasi'
                : 'Menunggu verifikasi email'}
            </strong>
          </div>
        </div>
      </section>

      <section className="account-card">
        <div className="account-orders-title">
          <h2>
            <ShoppingBag size={20} />
            Riwayat Transaksi
          </h2>
          <button
            onClick={() => window.location.reload()}
            aria-label="Muat ulang"
          >
            <RefreshCw size={17} />
          </button>
        </div>

        {error && (
          <p className="account-notice">{error}</p>
        )}

        {orders.length === 0 ? (
          <div className="account-empty">
            <ShoppingBag size={34} />
            <h3>Belum ada transaksi</h3>
            <p>
              Pesanan kamu akan muncul di sini setelah
              sistem transaksi tersedia.
            </p>
          </div>
        ) : (
          <div className="account-order-list">
            {orders.map((order) => (
              <article
                className="account-order"
                key={order.id}
              >
                <div>
                  <strong>
                    Pesanan #{order.id}
                  </strong>
                  <p>
                    <Clock size={14} />
                    {order.created_at
                      ? new Date(
                          order.created_at
                        ).toLocaleDateString('id-ID')
                      : 'Tanggal tidak tersedia'}
                  </p>
                </div>
                <span>
                  {order.status || 'Menunggu'}
                </span>
              </article>
            ))}
          </div>
        )}
      </section>

      <button
        className="account-logout"
        onClick={handleLogout}
      >
        <LogOut size={18} />
        Keluar dari Akun
      </button>
    </main>
  );
}
          
