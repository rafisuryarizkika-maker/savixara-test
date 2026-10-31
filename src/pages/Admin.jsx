import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function Admin({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaChallengeId, setMfaChallengeId] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [games, setGames] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSavingId, setProductSavingId] = useState(null);

  const [form, setForm] = useState({
    name: '',
    publisher: '',
    category: '',
    cover_url: '',
    icon_url: '',
    description: '',
    sort_order: 0,
    status: true,
  });

  async function loadGames() {
    const { data, error } = await supabase.rpc('admin_list_games');

    if (error) {
      setMessage('Gagal memuat game: ' + error.message);
      return;
    }

    setGames(data || []);
  }
  
async function loadProducts() {
  setProductsLoading(true);

  try {
    const { data, error } = await supabase.rpc(
      'admin_list_products'
    );

    if (error) {
      setMessage(
        'Gagal memuat produk: ' + error.message
      );
      return;
    }

    setProducts(data || []);
  } catch (error) {
    setMessage(
      'Gagal memuat produk: ' +
        (error?.message || 'Kesalahan tidak diketahui.')
    );
  } finally {
    setProductsLoading(false);
  }
}

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
      try {
        const { data: userData, error: userError } =
          await supabase.auth.getUser();

        if (userError || !userData?.user) {
          if (active) {
            setMessage('Silakan login terlebih dahulu.');
            setLoading(false);
          }
          return;
        }

        const { data: isAdmin, error: adminError } =
          await supabase.rpc('is_admin');

        if (adminError || isAdmin !== true) {
          if (active) {
            setMessage('Akses ditolak. Akun admin diperlukan.');
            setLoading(false);
          }
          return;
        }

        if (!active) return;

        const { data: assurance, error: assuranceError } =
          await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

        if (assuranceError) {
          throw assuranceError;
        }

        if (assurance?.currentLevel !== 'aal2') {
          const { data: factorsData, error: factorsError } =
            await supabase.auth.mfa.listFactors();

          if (factorsError) throw factorsError;

          const verifiedTotp = (factorsData?.totp || []).find(
            (factor) => factor.status === 'verified'
          );

          if (!verifiedTotp) {
            if (active) {
              setMessage('Akun admin memerlukan MFA TOTP terverifikasi. Daftarkan faktor MFA terlebih dahulu.');
              setLoading(false);
            }
            return;
          }

          const { data: challengeData, error: challengeError } =
            await supabase.auth.mfa.challenge({ factorId: verifiedTotp.id });

          if (challengeError) throw challengeError;

          if (active) {
            setMfaFactorId(verifiedTotp.id);
            setMfaChallengeId(challengeData.id);
            setMfaRequired(true);
            setMessage('Masukkan kode 6 digit dari aplikasi autentikator untuk melanjutkan.');
            setLoading(false);
          }
          return;
        }

        setAuthorized(true);
        await Promise.all([loadGames(), loadProducts()]);

        if (active) setLoading(false);
      } catch (error) {
        if (active) {
          setMessage(
            'Gagal memeriksa akses admin: ' +
              (error?.message || 'Kesalahan tidak diketahui.')
          );
          setLoading(false);
        }
      }
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, []);

  async function verifyMfaCode(event) {
    event.preventDefault();
    setMessage('');

    if (!/^\d{6}$/.test(mfaCode)) {
      setMessage('Masukkan kode autentikator 6 digit.');
      return;
    }

    setMfaBusy(true);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: mfaFactorId,
        challengeId: mfaChallengeId,
        code: mfaCode,
      });

      if (error) throw error;

      const { data: assurance, error: assuranceError } =
        await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (assuranceError) throw assuranceError;
      if (assurance?.currentLevel !== 'aal2') {
        throw new Error('Verifikasi belum meningkatkan sesi ke AAL2.');
      }

      const { data: isAdmin, error: adminError } =
        await supabase.rpc('is_admin');

      if (adminError || isAdmin !== true) {
        throw new Error('Akses ditolak. Akun admin diperlukan.');
      }

      setMfaRequired(false);
      setAuthorized(true);
      setMessage('Verifikasi MFA berhasil. Sesi admin berada pada AAL2.');
      await Promise.all([loadGames(), loadProducts()]);
    } catch (error) {
      setMessage(error?.message || 'Verifikasi MFA gagal.');
      setMfaCode('');
    } finally {
      setMfaBusy(false);
    }
  }

  async function saveProduct(product) {
    setMessage('');

    const costPrice =
      product.cost_price === '' || product.cost_price == null
        ? NaN
        : Number(product.cost_price);

    const sellingPrice =
      product.selling_price === '' || product.selling_price == null
        ? NaN
        : Number(product.selling_price);

    const promoPrice =
      product.promo_price === '' || product.promo_price == null
        ? null
        : Number(product.promo_price);

    if (
      !Number.isFinite(costPrice) ||
      !Number.isFinite(sellingPrice) ||
      costPrice < 0 ||
      sellingPrice < 0
    ) {
      setMessage('Harga modal dan harga jual harus valid dan tidak negatif.');
      return;
    }

    if (
      promoPrice !== null &&
      (!Number.isFinite(promoPrice) || promoPrice < 0)
    ) {
      setMessage('Harga promo harus valid atau dikosongkan.');
      return;
    }

    setProductSavingId(product.id);

    try {
      const { error } = await supabase.rpc(
        'admin_save_product_prices',
        {
          p_product_id: product.id,
          p_cost_price: costPrice,
          p_selling_price: sellingPrice,
          p_promo_price: promoPrice,
        }
      );

      if (error) {
        setMessage(
          'Gagal menyimpan harga: ' + error.message
        );
        return;
      }

      setMessage('Harga produk berhasil diperbarui.');
      await loadProducts();
    } catch (error) {
      setMessage(
        'Gagal menyimpan harga: ' +
          (error?.message || 'Kesalahan tidak diketahui.')
      );
    } finally {
      setProductSavingId(null);
    }
  }

  function updateForm(event) {
    const { name, value, type, checked } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]:
        type === 'checkbox'
          ? checked
          : name === 'sort_order'
            ? Number(value)
            : value,
    }));
  }

  async function saveGame(event) {
    event.preventDefault();
    setMessage('');

    if (!form.name.trim()) {
      setMessage('Nama game wajib diisi.');
      return;
    }

    setSaving(true);

    const payload = {
      ...form,
      name: form.name.trim(),
      slug: form.name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      publisher: form.publisher.trim() || null,
      category: form.category.trim() || null,
      cover_url: form.cover_url.trim() || null,
      icon_url: form.icon_url.trim() || null,
      description: form.description.trim() || null,
    };

    try {
      const { data, error } = await supabase.rpc(
  'admin_create_game',
  {
    p_name: payload.name,
    p_slug: payload.slug,
    p_publisher: payload.publisher,
    p_category: payload.category,
    p_cover_url: payload.cover_url,
    p_icon_url: payload.icon_url,
    p_description: payload.description,
    p_sort_order: payload.sort_order,
    p_status: payload.status,
  }
);

      if (error) {
        setMessage('Game gagal ditambahkan: ' + error.message);
        return;
      }

      setMessage('Game berhasil ditambahkan.');
      setForm({
        name: '',
        publisher: '',
        category: '',
        cover_url: '',
        icon_url: '',
        description: '',
        sort_order: 0,
        status: true,
      });

      await loadGames();
    } finally {
      setSaving(false);
    }
  }

  async function toggleGame(game) {
    setMessage('');

    const { error } = await supabase.rpc(
  'admin_set_game_status',
  {
    p_game_id: game.id,
    p_status: !game.status,
  }
);

    if (error) {
      setMessage('Status gagal diubah: ' + error.message);
      return;
    }

    setGames((previous) =>
      previous.map((item) =>
        item.id === game.id ? { ...item, status: !game.status } : item
      )
    );
  }

  async function deleteGame(game) {
    const confirmed = window.confirm(`Hapus game "${game.name}"?`);

    if (!confirmed) return;

    setMessage('');

    const { error } = await supabase.rpc(
  'admin_delete_game',
  {
    p_game_id: game.id,
  }
);

    if (error) {
      setMessage('Game gagal dihapus: ' + error.message);
      return;
    }

    setGames((previous) =>
      previous.filter((item) => item.id !== game.id)
    );
    setMessage('Game berhasil dihapus.');
  }

  if (loading) {
    return (
      <main className="admin-page">
        <p>Memeriksa akses admin...</p>
      </main>
    );
  }

  if (mfaRequired) {
    return (
      <main className="admin-page">
        <button onClick={onBack}>← Kembali</button>
        <header className="admin-heading">
          <p className="admin-eyebrow">VERIFIKASI KEAMANAN</p>
          <h1>Verifikasi MFA Admin</h1>
          <p>Masukkan kode 6 digit dari aplikasi autentikator yang sudah terdaftar pada akun admin.</p>
        </header>
        {message && <p className="admin-message" role="status">{message}</p>}
        <form className="admin-form" onSubmit={verifyMfaCode}>
          <label>
            Kode autentikator
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={mfaCode}
              onChange={(event) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              required
            />
          </label>
          <button type="submit" disabled={mfaBusy || mfaCode.length !== 6}>
            {mfaBusy ? 'Memverifikasi...' : 'Verifikasi dan buka Panel Admin'}
          </button>
        </form>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="admin-page">
        <button onClick={onBack}>← Kembali</button>
        <h1>Akses Admin</h1>
        <p>{message}</p>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <button onClick={onBack}>← Kembali ke SAVIXARA</button>

      <header className="admin-heading">
        <p className="admin-eyebrow">SAVIXARA CONTROL CENTER</p>
        <h1>Panel Admin</h1>
        <p>Kelola katalog game dari satu tempat.</p>
      </header>

      {message && (
        <p className="admin-message" role="status">
          {message}
        </p>
      )}

      <section className="admin-panel">
        <h2>Integrasi Provider</h2>
        <p>Pengujian koneksi, pengambilan pricelist, dry-run, dan sinkronisasi provider dinonaktifkan selama audit keamanan. Jangan menjalankan proses provider dari panel TEST sampai endpoint dan izin operasional diaudit serta diaktifkan kembali secara terpisah.</p>
      </section>

      <section className="admin-panel">
        <h2>Tambah Game</h2>

        <form onSubmit={saveGame} className="admin-form">
          <label>
            Nama game *
            <input
              name="name"
              value={form.name}
              onChange={updateForm}
              required
            />
          </label>

          <label>
            Publisher
            <input
              name="publisher"
              value={form.publisher}
              onChange={updateForm}
            />
          </label>

          <label>
            Kategori
            <input
              name="category"
              value={form.category}
              onChange={updateForm}
         placeholder="Contoh: MOBA"
            />
          </label>

          <label>
            URL gambar cover
            <input
              name="cover_url"
              type="url"
              value={form.cover_url}
              onChange={updateForm}
              placeholder="https://..."
            />
          </label>

          <label>
            URL ikon game
            <input
              name="icon_url"
              type="url"
              value={form.icon_url}
              onChange={updateForm}
              placeholder="https://..."
            />
          </label>

          <label>
            Deskripsi
            <textarea
              name="description"
              value={form.description}
              onChange={updateForm}
              rows={3}
            />
          </label>

          <label>
            Urutan tampil
            <input
              name="sort_order"
              type="number"
              value={form.sort_order}
              onChange={updateForm}
            />
          </label>

          <label className="admin-checkbox">
            <input
              name="status"
              type="checkbox"
              checked={form.status}
              onChange={updateForm}
            />
            Game aktif
          </label>

          <button type="submit" disabled={saving}>
            {saving ? 'Menyimpan...' : 'Tambah Game'}
          </button>
        </form>
      </section>

      <section className="admin-panel">
        <h2>Daftar Game ({games.length})</h2>

        {games.map((game) => (
          <article className="admin-game" key={game.id}>
            <div>
              <strong>{game.name}</strong>
              <p>{game.category || 'Tanpa kategori'}</p>
              <small>Status: {game.status ? 'Aktif' : 'Nonaktif'}</small>
            </div>

            <div className="admin-game-actions">
              <button
                type="button"
                onClick={() => toggleGame(game)}
              >
                {game.status ? 'Nonaktifkan' : 'Aktifkan'}
              </button>

              <button
                type="button"
                onClick={() => deleteGame(game)}
              >
                Hapus
              </button>
            </div>
          </article>
      ))}
      </section>

      <section className="admin-panel">
        <h2>Pengaturan Harga Produk ({products.length})</h2>

        {productsLoading ? (
          <p>Memuat produk...</p>
        ) : products.length === 0 ? (
          <p>Belum ada produk di tabel products.</p>
        ) : (
          products.map((product) => (
            <article className="admin-game" key={product.id}>
              <div>
                <strong>{product.name || product.title || 'Produk'}</strong>
                <p>{product.category || 'Tanpa kategori'}</p>
              </div>

              <form
                className="admin-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  saveProduct(product);
                }}
              >
                <label>
                  Harga Modal (Rp)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={product.cost_price ?? ''}
                    onChange={(event) =>
                      setProducts((previous) =>
                        previous.map((item) =>
                          item.id === product.id
                            ? { ...item, cost_price: event.target.value }
                       : item
                        )
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Harga Jual (Rp)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={product.selling_price ?? ''}
                    onChange={(event) =>
                      setProducts((previous) =>
                        previous.map((item) =>
                          item.id === product.id
                            ? { ...item, selling_price: event.target.value }
                            : item
                        )
                      )
                    }
                    required
                  />
                </label>

                <label>
                  Harga Promo (Rp, opsional)
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={product.promo_price ?? ''}
                    onChange={(event) =>
                      setProducts((previous) =>
                        previous.map((item) =>
                          item.id === product.id
                            ? { ...item, promo_price: event.target.value }
      : item
                        )
                      )
                    }
                    placeholder="Kosongkan jika tidak promo"
                  />
                </label>

                <button
                  type="submit"
                  disabled={productSavingId === product.id}
                >
                  {productSavingId === product.id
                    ? 'Menyimpan...'
                    : 'Simpan Harga'}
                </button>
              </form>
            </article>
          ))
      )}
      </section>
    </main>
  );
}
