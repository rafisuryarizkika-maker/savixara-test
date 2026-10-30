import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function Admin({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [games, setGames] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productSavingId, setProductSavingId] = useState(null);

  const [providerTesting, setProviderTesting] = useState(false);
  const [providerMessage, setProviderMessage] = useState('');

  const [pricelistTesting, setPricelistTesting] = useState(false);
  const [pricelistMessage, setPricelistMessage] = useState('');
  const [pricelistData, setPricelistData] = useState([]);
  const [pricelistMeta, setPricelistMeta] = useState(null);

  const [syncRunning, setSyncRunning] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const [syncJobId, setSyncJobId] = useState(() => {
    try {
      return window.localStorage.getItem('savixara_melostore_sync_job_id') || '';
    } catch {
      return '';
    }
  });
  const [dryRunRunning, setDryRunRunning] = useState(false);
  const [dryRunMessage, setDryRunMessage] = useState('');
  const [dryRunResult, setDryRunResult] = useState(null);

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

  async function testMelostoreConnection() {
    setProviderTesting(true);
    setProviderMessage('Sedang memeriksa koneksi Melostore...');

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setProviderMessage(
          'Sesi login tidak ditemukan. Silakan login kembali.'
        );
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        'melostore-profile',
        {
          body: {},
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        setProviderMessage(
          'Tes gagal: ' + (error.message || 'Permintaan fungsi gagal.')
        );
        return;
      }

      if (data?.ok) {
        setProviderMessage(data.message || 'Koneksi Melostore berhasil.');
      } else {
        setProviderMessage(
          data?.message ||
            'Koneksi belum berhasil. Periksa Logs di Supabase.'
        );
      }
    } catch (error) {
      setProviderMessage(
        'Tes gagal dijalankan: ' +
          (error?.message || 'Kesalahan tidak diketahui.')
      );
    } finally {
      setProviderTesting(false);
    }
  }

  async function testMelostorePricelist() {
    setPricelistTesting(true);
    setPricelistMessage('Sedang mengambil daftar harga Melostore...');
    setPricelistData([]);
    setPricelistMeta(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setPricelistMessage(
          'Sesi login tidak ditemukan. Silakan login kembali.'
        );
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        'melostore-pricelist',
        {
          body: { limit: 5 },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (error) {
        setPricelistMessage(
          'Tes pricelist gagal: ' +
            (error.message || 'Permintaan fungsi gagal.')
        );
        return;
      }

      if (!data?.ok) {
        setPricelistMessage(
          data?.message || 'Daftar harga gagal diambil.'
        );
        return;
      }

      const items = Array.isArray(data.data) ? data.data : [];
      setPricelistData(items);
      setPricelistMeta(data.meta ?? null);
      setPricelistMessage(
        `${data.message || 'Pricelist berhasil diambil.'} Jumlah produk pada respons ini: ${items.length}.`
      );
    } catch (error) {
      setPricelistMessage(
        'Tes pricelist gagal: ' +
          (error?.message || 'Kesalahan tidak diketahui.')
      );
    } finally {
      setPricelistTesting(false);
    }
  }


  async function simulateMelostorePricelist() {
    setDryRunRunning(true);
    setDryRunMessage('Menjalankan simulasi pemetaan satu halaman...');
    setDryRunResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setDryRunMessage('Sesi login tidak ditemukan. Silakan login kembali.');
        return;
      }

      const { data, error } = await supabase.functions.invoke(
        'melostore-sync-pricelist-audit-candidate',
        {
          body: { limit: 5, dry_run: true },
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (error) {
        let detail = error.message || 'Permintaan simulasi gagal.';
        try {
          const response = error.context;
          if (response && typeof response.json === 'function') {
            const errorBody = await response.json();
            if (errorBody?.message) detail = errorBody.message;
          }
        } catch {
          // Pertahankan pesan error awal jika respons tidak dapat dibaca.
        }
        setDryRunMessage('Simulasi gagal: ' + detail);
        return;
      }

      setDryRunResult(data || null);
      if (!data?.ok || data?.dry_run !== true || data?.catalog_changed !== false) {
        setDryRunMessage(
          data?.message ||
            'Respons tidak mengonfirmasi dry-run aman. Periksa Logs Supabase; jangan jalankan sinkronisasi.'
        );
        return;
      }

      setDryRunMessage(
        data.message ||
          'Simulasi selesai. Katalog produk tidak diubah; metadata pekerjaan simulasi dicatat.'
      );
    } catch (error) {
      setDryRunMessage(
        'Simulasi gagal: ' + (error?.message || 'Kesalahan tidak diketahui.')
      );
    } finally {
      setDryRunRunning(false);
    }
  }

  async function syncMelostorePricelist() {
    const confirmed = window.confirm(
      syncJobId
        ? `Lanjutkan pemeriksaan pekerjaan sinkronisasi Melostore yang tersimpan (${syncJobId})? Produk baru dibuat nonaktif dengan harga jual Rp0; harga jual dan promo produk lama dipertahankan.`
        : 'Mulai pekerjaan sinkronisasi katalog Melostore ke database SAVIXARA? Proses berjalan per halaman. Produk baru dibuat nonaktif dengan harga jual Rp0; harga jual dan promo produk lama dipertahankan.'
    );
    if (!confirmed) return;

    setSyncRunning(true);
    setSyncMessage('Menyiapkan sinkronisasi Melostore...');
    setSyncResult(null);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        setSyncMessage('Sesi login tidak ditemukan. Silakan login kembali.');
        return;
      }

      let jobId = syncJobId || null;
      let finalData = null;
      let attempts = 0;
      let resumePaused = false;
      const maxPagesPerRun = 25;

      while (attempts < maxPagesPerRun) {
        attempts += 1;
        setSyncMessage(
          jobId
            ? `Melanjutkan pemeriksaan pekerjaan Melostore (permintaan ke-${attempts})...`
            : 'Memulai pekerjaan sinkronisasi Melostore...'
        );

        const requestBody = jobId
          ? { limit: 500, job_id: jobId, ...(resumePaused ? { resume_paused: true } : {}) }
          : { limit: 500 };

        const { data, error } = await supabase.functions.invoke(
          'melostore-sync-pricelist-audit-candidate',
          {
            body: requestBody,
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );

        let responseData = data || null;
        if (error) {
          try {
            const response = error.context;
            if (response && typeof response.json === 'function') {
              const errorBody = await response.json();
              if (errorBody && typeof errorBody === 'object') {
                responseData = errorBody;
              }
            }
          } catch {
            // Gunakan pesan error awal jika body respons tidak dapat dibaca.
          }

          if (!responseData?.requires_resume && !responseData?.active_job_exists) {
            const detail = responseData?.message || error.message || 'Permintaan fungsi gagal.';
            setSyncResult(responseData);
            setSyncMessage('Sinkronisasi berhenti: ' + detail + '. Periksa Logs di Supabase sebelum mencoba lagi.');
            return;
          }
        }

        if (responseData?.job_id) {
          jobId = responseData.job_id;
          setSyncJobId(responseData.job_id);
          try {
            window.localStorage.setItem('savixara_melostore_sync_job_id', responseData.job_id);
          } catch {
            // Sinkronisasi tetap dapat berjalan jika penyimpanan browser tidak tersedia.
          }
        }

        if (responseData?.requires_resume === true) {
          if (resumePaused) {
            setSyncResult(responseData);
            setSyncMessage(
              'Server masih meminta konfirmasi pelanjutan setelah konfirmasi dikirim. Proses dihentikan agar tidak mengulang permintaan tanpa batas; periksa kontrak fungsi kandidat.'
            );
            return;
          }

          const resumeConfirmed = window.confirm(
            `Pekerjaan ${responseData.job_id || jobId || ''} sedang dijeda. Apakah kamu ingin melanjutkan pekerjaan yang sama? Tidak ada pekerjaan baru yang akan dibuat.`
          );
          if (!resumeConfirmed) {
            setSyncResult(responseData);
            setSyncMessage('Pekerjaan tetap dijeda. Tidak ada pelanjutan yang dilakukan.');
            return;
          }
          resumePaused = true;
          attempts -= 1;
          continue;
        }

        if (responseData?.active_job_exists === true) {
          setSyncResult(responseData);
          const activeStatus = responseData.job_status || 'tidak diketahui';
          setSyncMessage(
            `Ditemukan pekerjaan aktif (${activeStatus})${responseData.job_id ? ` dengan ID ${responseData.job_id}` : ''}. Pekerjaan baru tidak dibuat. Periksa status pekerjaan sebelum mencoba lagi.`
          );
          return;
        }

        if (error) {
          setSyncResult(responseData);
          setSyncMessage(responseData?.message || error.message || 'Permintaan fungsi gagal.');
          return;
        }

        if (!responseData?.ok) {
          setSyncResult(responseData || null);
          setSyncMessage(responseData?.message || 'Sinkronisasi gagal. Periksa Logs di Supabase.');
          return;
        }

        finalData = responseData;
        setSyncResult(responseData);

        if (responseData.done === true || responseData.has_more === false) {
          setSyncJobId('');
          try {
            window.localStorage.removeItem('savixara_melostore_sync_job_id');
          } catch {
            // Tidak menghalangi penutupan pekerjaan jika penyimpanan tidak tersedia.
          }
          setSyncMessage(responseData.message || 'Sinkronisasi selesai.');
          await loadProducts();
          return;
        }

        const requestedWait = Number(responseData.wait_ms ?? 3200);
        const waitMs = Math.min(Math.max(requestedWait, 1000), 300000);
        const waitSeconds = Math.ceil(waitMs / 1000);
        setSyncMessage(
          `${responseData.message || 'Halaman berhasil diproses.'} Melanjutkan dalam ${waitSeconds} detik. Progres: ${JSON.stringify(responseData.summary || {})}`
        );
        await new Promise((resolve) => window.setTimeout(resolve, waitMs));
      }

      setSyncResult(finalData);
      setSyncMessage(
        `Sesi ini berhenti setelah ${maxPagesPerRun} permintaan agar browser tetap responsif. Pekerjaan${jobId ? ` ${jobId}` : ''} tetap tersimpan dan dapat diperiksa kembali.`
      );
    } catch (error) {
      setSyncMessage(
        'Sinkronisasi gagal: ' + (error?.message || 'Kesalahan tidak diketahui.')
      );
    } finally {
      setSyncRunning(false);
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
        <h2>Koneksi Provider</h2>
        <p>Periksa apakah SAVIXARA dapat menghubungi akun Melostore.</p>
        <button
          type="button"
          onClick={testMelostoreConnection}
          disabled={providerTesting}
        >
          {providerTesting ? 'Memeriksa koneksi...' : 'Tes Koneksi Melostore'}
        </button>
        {providerMessage && (
          <p className="admin-message" role="status">
            {providerMessage}
          </p>
        )}
      </section>

      <section className="admin-panel">
        <h2>Tes Pricelist Melostore</h2>
        <p>
          Ambil maksimal lima item untuk memeriksa respons daftar harga.
          Pengujian ini tidak membuat transaksi.
        </p>
        <button
          type="button"
          onClick={testMelostorePricelist}
          disabled={pricelistTesting}
        >
          {pricelistTesting
            ? 'Mengambil pricelist...'
            : 'Tes Pricelist Melostore'}
        </button>

        {pricelistMessage && (
          <p className="admin-message" role="status">
            {pricelistMessage}
          </p>
        )}

        {pricelistMeta && (
         <div>
            <h3>Metadata Pricelist</h3>
            <p>
              Bagian ini dapat berisi informasi pagination dari provider,
              jika disediakan oleh Melostore.
            </p>
            <pre
              style={{
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {JSON.stringify(pricelistMeta, null, 2)}
            </pre>
          </div>
        )}

        {pricelistData.length > 0 && (
          <details>
            <summary>Lihat data produk ({pricelistData.length})</summary>
            <pre
              style={{
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {JSON.stringify(pricelistData, null, 2)}
            </pre>
          </details>
        )}
      </section>

      <section className="admin-panel">
        <h2>Sinkronisasi Pricelist Melostore</h2>
        <p>
          Impor dan perbarui katalog dari Melostore. Produk baru akan berstatus
          nonaktif dengan harga jual Rp0, sedangkan harga jual dan harga promo
          produk lama tetap dipertahankan.
        </p>
        <button
          type="button"
          onClick={simulateMelostorePricelist}
          disabled={dryRunRunning || syncRunning}
        >
          {dryRunRunning ? 'Menjalankan simulasi...' : 'Simulasi Pricelist (Dry Run)'}
        </button>
        <p>
          Simulasi hanya memeriksa satu halaman (maksimal 5 item). Katalog produk
          tidak diubah, tetapi metadata pekerjaan simulasi akan dicatat dan dapat
          berstatus paused.
        </p>
        {dryRunMessage && (
          <p className="admin-message" role="status">
            {dryRunMessage}
          </p>
        )}
        {dryRunResult && (
          <details>
            <summary>Lihat hasil simulasi</summary>
            <pre
              style={{
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {JSON.stringify(dryRunResult, null, 2)}
            </pre>
          </details>
        )}

        <button
          type="button"
          onClick={syncMelostorePricelist}
          disabled={syncRunning || dryRunRunning}
        >
          {syncRunning ? 'Menyinkronkan katalog...' : 'Sinkronisasi Pricelist Melostore'}
        </button>

        {syncMessage && (
          <p className="admin-message" role="status">
            {syncMessage}
          </p>
        )}
        {!syncRunning && syncJobId && (
          <p className="admin-message" role="status">
            Ada pekerjaan sinkronisasi yang tersimpan dan belum selesai. Tekan tombol di atas untuk melanjutkan pekerjaan yang sama.
          </p>
        )}

        {syncResult?.summary && (
          <div>
            <h3>Ringkasan Sinkronisasi</h3>
            <pre
              style={{
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                overflowWrap: 'anywhere',
              }}
            >
              {JSON.stringify(syncResult.summary, null, 2)}
            </pre>
            {Array.isArray(syncResult.skippedProducts) && syncResult.skippedProducts.length > 0 && (
              <details>
                <summary>Produk dilewati ({syncResult.skippedProducts.length})</summary>
                <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {JSON.stringify(syncResult.skippedProducts, null, 2)}
                </pre>
              </details>
            )}
            {Array.isArray(syncResult.failedProducts) && syncResult.failedProducts.length > 0 && (
              <details>
                <summary>Produk gagal ({syncResult.failedProducts.length})</summary>
                <pre style={{ overflowX: 'auto', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {JSON.stringify(syncResult.failedProducts, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}
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
