
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabase';

export default function Admin({ onBack }) {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [games, setGames] = useState([]);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    let active = true;

    async function checkAdmin() {
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

      if (active) {
        setAuthorized(true);
        await loadGames(active);
        setLoading(false);
      }
    }

    async function loadGames(isActive = true) {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .order('sort_order', { ascending: true });

      if (!isActive) return;

      if (error) {
        setMessage('Gagal memuat game: ' + error.message);
        return;
      }

      setGames(data || []);
    }

    checkAdmin();

    return () => {
      active = false;
    };
  }, []);

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

    const { error } = await supabase
      .from('games')
      .insert(payload);

    setSaving(false);

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

    const { data } = await supabase
      .from('games')
      .select('*')
      .order('sort_order', { ascending: true });

    setGames(data || []);
  }

  async function toggleGame(game) {
    setMessage('');

    const { error } = await supabase
      .from('games')
      .update({ status: !game.status })
      .eq('id', game.id);

    if (error) {
      setMessage('Status gagal diubah: ' + error.message);
      return;
    }

    setGames((previous) =>
      previous.map((item) =>
        item.id === game.id
          ? { ...item, status: !game.status }
          : item
      )
    );
  }

  async function deleteGame(game) {
    const confirmed = window.confirm(
      `Hapus game "${game.name}"?`
    );

    if (!confirmed) return;

    setMessage('');

    const { error } = await supabase
      .from('games')
      .delete()
      .eq('id', game.id);

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
    return <main className="admin-page"><p>Memeriksa akses admin...</p></main>;
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
              <small>
                Status: {game.status ? 'Aktif' : 'Nonaktif'}
              </small>
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
    </main>
  );
        }
      
