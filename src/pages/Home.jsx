import React, { useEffect, useMemo, useState } from 'react';

import {
  Search,
  Gamepad2,
  ShieldCheck,
  Zap,
  Headphones,
  WalletCards,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  ReceiptText,
  Trophy,
  BookOpen,
  HelpCircle,
  MessageCircle,
  CheckCircle2,
  RefreshCw,
  ArrowUpRight,
  Gem,
  Globe,
  Info,
  Tag,
  Users
} from 'lucide-react';

import Header from '../components/Header';
import Footer from '../components/Footer';
import GameCard from '../components/GameCard';
import Account from './Account';
import Admin from './Admin';
import { supabase } from '../supabase';

/* =========================================================
   DATA CADANGAN
   Digunakan jika database belum dapat diakses.
========================================================= */

const fallbackGames = [
  {
    name: 'Mobile Legends',
    publisher: 'Moonton',
    tag: 'MLBB',
    tone: 'mlbb',
    slug: 'mobile-legends',
    cover: '/savixara/images/games/mobile-legends.png',
    category: 'MOBA',
    status: true
  },
  {
    name: 'Free Fire',
    publisher: 'Garena',
    tag: 'FF',
    tone: 'ff',
    slug: 'free-fire',
    cover: '/savixara/images/games/free-fire.png',
    category: 'Battle Royale',
    status: true
  },
  {
    name: 'PUBG Mobile',
    publisher: 'Tencent Games',
    tag: 'PUBG',
    tone: 'pubg',
    slug: 'pubg-mobile',
    cover: '/savixara/images/games/pubg-mobile.png',
    category: 'Battle Royale',
    status: true
  },
  {
    name: 'Roblox',
    publisher: 'Roblox Corporation',
    tag: 'RBLX',
    tone: 'roblox',
    slug: 'roblox',
    cover: '/savixara/images/games/roblox.png',
    category: 'Adventure',
    status: true
  },
  {
    name: 'Honor of Kings',
    publisher: 'Tencent Games',
    tag: 'HOK',
    tone: 'hok',
    slug: 'honor-of-kings',
    cover: '/savixara/images/games/honor-of-kings.png',
    category: 'MOBA',
    status: true
  },
  {
    name: 'Genshin Impact',
    publisher: 'HoYoverse',
    tag: 'GEN',
    tone: 'genshin',
    slug: 'genshin-impact',
    cover: '/savixara/images/games/genshin-impact.png',
    category: 'RPG',
    status: true
  }
];

const fallbackMobileLegendsProducts = [
  { id: 'ml-5', name: '5 Diamonds', selling_price: 1500 },
  { id: 'ml-12', name: '12 Diamonds', selling_price: 3500 },
  { id: 'ml-19', name: '19 Diamonds', selling_price: 5500 },
  { id: 'ml-28', name: '28 Diamonds', selling_price: 8000 },
  { id: 'ml-36', name: '36 Diamonds', selling_price: 10000 },
  { id: 'ml-44', name: '44 Diamonds', selling_price: 12000 },
  { id: 'ml-59', name: '59 Diamonds', selling_price: 16000 },
  { id: 'ml-85', name: '85 Diamonds', selling_price: 23000 },
  { id: 'ml-170', name: '170 Diamonds', selling_price: 45000 },
  { id: 'ml-240', name: '240 Diamonds', selling_price: 62000 },
  { id: 'ml-296', name: '296 Diamonds', selling_price: 76000 },
  { id: 'ml-408', name: '408 Diamonds', selling_price: 105000 },
  { id: 'ml-568', name: '568 Diamonds', selling_price: 145000 },
  { id: 'ml-875', name: '875 Diamonds', selling_price: 220000 }
];

const services = [
  {
    name: 'WDP Mobile Legends',
    sub: 'Weekly Diamond Pass',
    tone: 'wdp'
  },
  {
    name: 'Joki Rank Mobile Legends',
    sub: 'Layanan push rank',
    tone: 'joki'
  },
  {
    name: 'Mabar Push Mobile Legends',
    sub: 'Main bareng pro player',
    tone: 'mabar'
  }
];

const promos = [
  {
    title: 'Promo MLBB',
    text: 'Diskon khusus produk pilihan',
    tone: 'promo1'
  },
  {
    title: 'Weekly Diamond Pass',
    text: 'Harga spesial minggu ini',
    tone: 'promo2'
  },
  {
    title: 'Roblox',
    text: 'Penawaran cashback pilihan',
    tone: 'promo3'
  },
  {
    title: 'Free Fire',
    text: 'Bonus untuk produk tertentu',
    tone: 'promo4'
  }
];

const features = [
  {
    title: 'Proses Cepat',
    text: 'Pesanan diproses setelah pembayaran terverifikasi.',
    icon: Zap
  },
  {
    title: 'Harga Kompetitif',
    text: 'Informasi harga produk tersedia dengan jelas.',
    icon: WalletCards
  },
  {
    title: 'Transaksi Aman',
    text: 'Data pesanan dikelola dengan memperhatikan keamanan.',
    icon: ShieldCheck
  },
  {
    title: 'Customer Support',
    text: 'Pusat bantuan untuk pertanyaan seputar layanan.',
    icon: Headphones
  }
];

/* =========================================================
   HELPER
========================================================= */

const formatRupiah = (value) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);

const createSlug = (value = '') =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

const getProductPrice = (product) => {
  const promo = Number(product?.promo_price);

  if (promo > 0) {
    return promo;
  }

  return Number(product?.selling_price) || 0;
};

const getProductName = (product) =>
  product?.name || product?.amount || 'Produk Game';

const getTone = (game) => {
  const slug = game?.slug || createSlug(game?.name);

  const tones = {
    'mobile-legends': 'mlbb',
    'free-fire': 'ff',
    'pubg-mobile': 'pubg',
    roblox: 'roblox',
    'honor-of-kings': 'hok',
    'genshin-impact': 'genshin'
  };

  return tones[slug] || '';
};

/* =========================================================
   HOME
========================================================= */

function Home() {
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [showAccount, setShowAccount] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  
useEffect(() => {
  const openAdmin = () => {
    setShowAccount(false);
    setShowAdmin(true);
  };

  window.addEventListener('savixara-open-admin', openAdmin);

  return () => {
    window.removeEventListener('savixara-open-admin', openAdmin);
  };
}, []);
  
  

  const [games, setGames] = useState(fallbackGames);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [databaseAvailable, setDatabaseAvailable] = useState(false);

  const [selectedGame, setSelectedGame] = useState(null);
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);
  const [userId, setUserId] = useState('');
  const [serverId, setServerId] = useState('');

  const [toastTimer, setToastTimer] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);

  /* =======================================================
     TOAST
  ======================================================= */

  const notify = (message) => {
    setToast(message);

    if (toastTimer) {
      window.clearTimeout(toastTimer);
    }

    const timer = window.setTimeout(() => {
      setToast('');
      setToastTimer(null);
    }, 2800);

    setToastTimer(timer);
  };

  useEffect(() => {
    return () => {
      if (toastTimer) {
        window.clearTimeout(toastTimer);
      }
    };
  }, [toastTimer]);

  /* =======================================================
     AMBIL GAME DARI SUPABASE
  ======================================================= */

  const loadGames = async () => {
    setGamesLoading(true);

    try {
      const { data, error } = await supabase
        .from('games')
        .select('*')
        .eq('status', true)
        .order('sort_order', { ascending: true });

      if (error) {
        throw error;
      }

      if (Array.isArray(data) && data.length > 0) {
        const normalizedGames = data.map((game) => {
          const slug = game.slug || createSlug(game.name);

          const localCovers = {
            'mobile-legends': '/savixara/images/games/mobile-legends.png',
            'free-fire': '/savixara/images/games/free-fire.png',
            'pubg-mobile': '/savixara/images/games/pubg-mobile.png',
            roblox: '/savixara/images/games/roblox.png',
            'honor-of-kings': '/savixara/images/games/honor-of-kings.png',
            'genshin-impact': '/savixara/images/games/genshin-impact.png'
          };

          return {
            ...game,
            slug,
            tag: game.tag || game.name,
            tone: getTone(game),
            cover: localCovers[slug] || game.cover || game.icon || null
          };
        });

        setGames(normalizedGames);
        setDatabaseAvailable(true);
      } else {
        setGames(fallbackGames);
        setDatabaseAvailable(false);
      }
    } catch (error) {
      console.error('Gagal memuat game:', error);
      setGames(fallbackGames);
      setDatabaseAvailable(false);
    } finally {
      setGamesLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
  }, []);

  /* =======================================================
     PENCARIAN GAME
  ======================================================= */

  const filteredGames = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    if (!keyword) {
      return games;
    }

    return games.filter((game) =>
      [
        game.name,
        game.publisher,
        game.tag,
        game.category
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(keyword)
    );
  }, [games, query]);

  /* =======================================================
     SCROLL
  ======================================================= */

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  };

  /* =======================================================
     BUKA GAME
  ======================================================= */

  const openGame = async (game) => {
    if (!game) return;

    setSelectedGame(game);
    setSelectedProduct(null);
    setProducts([]);
    setUserId('');
    setServerId('');
    setProductsLoading(true);

    const slug = game.slug || createSlug(game.name);

    window.history.replaceState(
      null,
      '',
      `#topup/${slug}`
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });

    try {
      if (!game.id) {
        throw new Error('Game belum memiliki ID database.');
      }

      const { data, error } = await supabase
  .from('products')
  .select(`
    id,
    game_id,
    name,
    slug,
    category,
    provider,
    selling_price,
    promo_price,
    description,
    status,
    sort_order
  `)
  .eq('game_id', game.id)
  .eq('status', true)
  .order('selling_price', { ascending: true });

      if (error) {
        throw error;
      }

      setProducts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Gagal memuat produk:', error);

      if (slug === 'mobile-legends') {
        setProducts(fallbackMobileLegendsProducts);
      } else {
        setProducts([]);
      }

      notify(
        'Data produk database belum dapat dimuat. Periksa koneksi dan kebijakan RLS.'
      );
    } finally {
      setProductsLoading(false);
    }
  };

  /* =======================================================
     KEMBALI KE BERANDA
  ======================================================= */

  const closeCatalog = () => {
    setSelectedGame(null);
    setSelectedProduct(null);
    setProducts([]);
    setUserId('');
    setServerId('');

    window.history.replaceState(
      null,
      '',
      window.location.pathname
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  /* =======================================================
     CHECKOUT SEMENTARA
     Belum membuat pesanan atau memproses pembayaran.
  ======================================================= */

  const handleContinue = () => {
    if (!userId.trim()) {
      notify('Silakan masukkan User ID terlebih dahulu.');
      return;
    }

    if (
      selectedGame?.slug === 'mobile-legends' &&
      !serverId.trim()
    ) {
      notify('Silakan masukkan Server ID terlebih dahulu.');
      return;
    }

    if (!selectedProduct) {
      notify('Silakan pilih nominal produk terlebih dahulu.');
      return;
    }

    notify(
      'Pilihan produk sudah siap. Sistem checkout dan pembayaran belum diaktifkan.'
    );
  };

  /* =======================================================
     KATALOG TOP UP
  ======================================================= */

  if (selectedGame) {
    const isMobileLegends =
      (selectedGame.slug || createSlug(selectedGame.name)) ===
      'mobile-legends';

    return (
      <div className="app">
        <Header />

        <main>
          <section className="section topup-page">
            <button
              type="button"
              className="outline-btn"
              onClick={closeCatalog}
            >
              <ArrowLeft size={17} />
              Kembali
            </button>

            <div className="topup-header">
              <div className="section-kicker">
                <Gamepad2 size={18} />
                TOP UP GAME
              </div>

              <h1>Top Up {selectedGame.name}</h1>

              <p>
                Pilih produk, masukkan data pemain,
                lalu lanjutkan ke tahap berikutnya.
              </p>
            </div>

            <div className="topup-layout">
              <div className="topup-products">
                <div className="topup-card">
                  <div className="topup-card-head">
                    <div>
                      <span className="topup-label">
                        {selectedGame.name.toUpperCase()}
                      </span>

                      <h2>Pilih Produk</h2>

                      <p>
                        Pilih nominal yang sesuai dengan kebutuhanmu.
                      </p>
                    </div>

                    <Gamepad2 size={28} />
                  </div>

                  {productsLoading ? (
                    <div className="empty-state">
                      <RefreshCw size={24} />
                      <p>Memuat produk dari database...</p>
                    </div>
                  ) : products.length > 0 ? (
                    <div className="product-grid">
                      {products.map((product) => {
                        const price = getProductPrice(product);
                        const active =
                          selectedProduct?.id === product.id;

                        return (
                          <button
                            key={product.id}
                            type="button"
                            className={`product-option ${
                              active ? 'active' : ''
                            }`}
                            onClick={() =>
                              setSelectedProduct({
                                ...product,
                                amount: getProductName(product),
                                price
                              })
                            }
                          >
                            <div>
                              <strong>
                                {getProductName(product)}
                              </strong>

                              <small>
                                {product.description ||
                                  'Produk top up game'}
                              </small>
                            </div>

                            <span>{formatRupiah(price)}</span>

                            {active && (
                              <CheckCircle2 size={18} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Gamepad2 size={30} />
                      <h3>Produk belum tersedia</h3>
                      <p>
                        Tambahkan produk untuk game ini melalui
                        tabel products di Supabase.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="topup-sidebar">
                <div className="topup-card">
                  <div className="topup-card-head">
                    <div>
                      <span className="topup-label">
                        DATA AKUN
                      </span>

                      <h2>Detail Pemain</h2>
                    </div>

                    <ShieldCheck size={26} />
                  </div>

                  <div className="form-group">
                    <label htmlFor="user-id">User ID</label>

                    <input
                      id="user-id"
                      type="text"
                      value={userId}
                      onChange={(event) =>
                        setUserId(event.target.value)
                      }
                      placeholder="Masukkan User ID"
                      autoComplete="off"
                    />
                  </div>

                  {isMobileLegends && (
                    <div className="form-group">
                      <label htmlFor="server-id">
                        Server ID
                      </label>

                      <input
                        id="server-id"
                        type="text"
                        value={serverId}
                        onChange={(event) =>
                          setServerId(event.target.value)
                        }
                        placeholder="Masukkan Server ID"
                        autoComplete="off"
                      />
                    </div>
                  )}

                  <div className="account-note">
                    <ShieldCheck size={17} />

                    <span>
                      Jangan berikan password akun game kamu.
                    </span>
                  </div>
                </div>

                <div className="topup-card summary-card">
                  <span className="topup-label">
                    RINGKASAN PESANAN
                  </span>

                  <h3>
                    {selectedProduct
                      ? selectedProduct.amount
                      : 'Belum memilih produk'}
                  </h3>

                  <div className="summary-row">
                    <span>Produk</span>

                    <strong>
                      {selectedProduct
                        ? selectedProduct.amount
                        : '-'}
                    </strong>
                  </div>

                  <div className="summary-row">
                    <span>Harga</span>

                    <strong>
                      {selectedProduct
                        ? formatRupiah(
                            selectedProduct.price ??
                              getProductPrice(selectedProduct)
                          )
                        : '-'}
                    </strong>
                  </div>

                  <div className="summary-total">
                    <span>Total</span>

                    <strong>
                      {selectedProduct
                        ? formatRupiah(
                            selectedProduct.price ??
                              getProductPrice(selectedProduct)
                          )
                        : 'Rp0'}
                    </strong>
                  </div>

                  <button
                    type="button"
                    className="checkout-btn"
                    onClick={handleContinue}
                    disabled={
                      productsLoading || products.length === 0
                    }
                  >
                    Lanjutkan
                    <ArrowRight size={18} />
                  </button>

                  <p className="checkout-disclaimer">
                    Pembayaran belum terhubung. Tombol ini belum
                    membuat transaksi sungguhan.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>

        <Footer />

        {toast && <div className="toast">{toast}</div>}
      </div>
    );
  }

  /* =========================================================
     BERANDA
  ========================================================= */

  return (
    <div className="app">
      <Header onOpenAccount={() => {
      setShowAccount(true);
}} />


{showAdmin ? (
  <Admin onBack={() => setShowAdmin(false)} />
) : showAccount ? (
  <Account onBack={() => setShowAccount(false)} />
) : (
  <>
    
  <main>
    
        {/* HERO */}

        <section className="hero">
          <div className="hero-glow glow-a"></div>
          <div className="hero-glow glow-b"></div>

          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={14} />
              PLATFORM GAMING
            </div>

            <h1>
              Top Up Game
              <br />
              Jadi Lebih <span>Mudah</span>
            </h1>

            <p>
              Top up game, voucher, dan layanan gaming
              dalam satu tempat. Pilih game favoritmu
              dan lihat katalog produk SAVIXARA.
            </p>

            <div className="search-box">
              <Search size={20} />

              <input
                id="search"
                type="search"
                value={query}
                onChange={(event) =>
                  setQuery(event.target.value)
                }
                placeholder="Cari game, layanan, atau voucher..."
                aria-label="Cari game"
              />

              <button
                type="button"
                onClick={() => scrollToSection('games')}
                aria-label="Cari"
              >
                <Search size={18} />
              </button>
            </div>

            <div className="trust-row">
              <div>
                <Zap size={18} />
                <span>
                  <b>Proses Cepat</b>
                  <small>Informasi pesanan jelas</small>
                </span>
              </div>

              <div>
                <WalletCards size={18} />
                <span>
                  <b>Harga Kompetitif</b>
                  <small>Harga dari katalog</small>
                </span>
              </div>

              <div>
                <ShieldCheck size={18} />
                <span>
                  <b>Transaksi Aman</b>
                  <small>Utamakan keamanan</small>
                </span>
              </div>

              <div>
                <Headphones size={18} />
                <span>
                  <b>Customer Support</b>
                  <small>Pusat bantuan</small>
                </span>
              </div>
            </div>
          </div>

          <div className="hero-art">
            <div className="orb orb-1"></div>
            <div className="orb orb-2"></div>

            <div className="character-placeholder">
              <div className="character-ring"></div>
              <div className="character-core">S</div>
            </div>

            <div className="hero-chip chip-1">TOP UP</div>
            <div className="hero-chip chip-2">
              FAST • SECURE
            </div>
          </div>
        </section>
    
    {/* GAME POPULER */}

        <section className="section" id="games">
          <div className="section-head">
            <div>
              <div className="section-kicker">
                <Gamepad2 size={18} />
                PILIH GAME FAVORITMU
              </div>

              <h2>Game Populer</h2>

              <p>
                Pilih game untuk melihat produk top up yang tersedia.
              </p>
              </div>

            <button
              type="button"
              className="text-link"
              onClick={() => {
                setQuery('');
                scrollToSection('games');
              }}
            >
              Lihat Semua
              <ArrowRight size={17} />
            </button>
          </div>

          {gamesLoading ? (
            <div className="empty-state">
              <RefreshCw size={24} />
              <p>Memuat katalog game...</p>
            </div>
          ) : (
            <>
              {databaseAvailable && (
                <p className="catalog-note">
                  <CheckCircle2 size={15} />
                  Katalog game dimuat dari database.
                </p>
              )}

              <div className="game-grid">
                {filteredGames.map((game) => (
                  <GameCard
                    key={game.id || game.slug}
                    game={{
                      ...game,
                      tone: game.tone || getTone(game),
                      icon: game.icon_url || null,
                      cover: game.cover || game.cover_url || null,
                    }}
                    onClick={() => openGame(game)}
                  />
                ))}
              </div>

              {filteredGames.length === 0 && (
                <div className="empty-state">
                  <Search size={28} />
                  <h3>Game tidak ditemukan</h3>
                  <p>
                    Coba kata kunci lain atau hapus pencarian.
                  </p>

                  <button
                    type="button"
                    className="outline-btn"
                    onClick={() => setQuery('')}
                  >
                    Reset Pencarian
                  </button>
                </div>
              )}
            </>
          )}

          <button
            type="button"
            className="outline-btn refresh-catalog"
            onClick={loadGames}
            disabled={gamesLoading}
          >
            <RefreshCw size={16} />
            Muat Ulang Katalog
          </button>
        </section>

                        {/* =========================================================
                KEUNGGULAN SAVIXARA
            ========================================================= */}

            <section className="section features-section" id="keunggulan">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">
                    KENAPA MEMILIH KAMI?
                  </span>
                  <h2>Kenapa SAVIXARA?</h2>
                  <p>
                    Pengalaman top up game yang praktis, nyaman, dan tepercaya.
                  </p>
                </div>
              </div>

              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">
                    <Zap size={24} />
                  </div>
                  <h3>Proses Cepat</h3>
                  <p>
                    Proses transaksi dirancang agar praktis dan mudah diikuti.
                  </p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">
                    <Tag size={24} />
                  </div>
                  <h3>Harga Kompetitif</h3>
                  <p>
                    Temukan pilihan produk game dengan harga yang bersaing.
                  </p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">
                    <ShieldCheck size={24} />
                  </div>
                  <h3>Transaksi Aman</h3>
                  <p>
                    Informasi transaksi ditampilkan dengan jelas untuk
                    membantu kamu bertransaksi dengan lebih nyaman.
                  </p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">
                    <Headphones size={24} />
                  </div>
                  <h3>Customer Support</h3>
                  <p>
                    Hubungi layanan pelanggan jika kamu membutuhkan bantuan.
                  </p>
                </div>
              </div>
            </section>

                        {/* =========================================================
                PROMO SAVIXARA
                          ========================================================= */}

            <section className="section promo-section" id="promo">
              <div className="promo-banner">
                <div className="promo-content">
                  <span className="section-eyebrow">
                    PENAWARAN SPESIAL
                  </span>

                  <h2>
                    Makin Seru Main Game,
                    <br />
                    Makin Mudah Top Up!
                  </h2>

                  <p>
                    Temukan berbagai pilihan produk dan promo menarik
                    di SAVIXARA.
                  </p>

                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => {
                      document
                        .getElementById("games")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }}
                  >
                    Jelajahi Game
                    <ArrowUpRight size={18} />
                  </button>
                </div>

                <div className="promo-visual">
                  <div className="promo-glow"></div>

                  <div className="promo-controller">
                    <Gamepad2 size={100} strokeWidth={1.3} />
                  </div>

                  <span className="promo-spark promo-spark-one">✦</span>
                  <span className="promo-spark promo-spark-two">✧</span>
                </div>
              </div>
            </section>

                        {/* =========================================================
                LAYANAN GAMING
            ========================================================= */}

            <section className="section services-section" id="layanan">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">
                    LEBIH DARI SEKADAR TOP UP
                  </span>
                  <h2>Layanan Gaming</h2>
                  <p>
                    Pilihan layanan untuk menemani pengalaman bermain game kamu.
                  </p>
                </div>
              </div>

              <div className="services-grid">
                <div className="service-card">
                  <div className="service-icon">
                    <Gem size={28} />
                  </div>

                  <span className="service-label">MOBILE LEGENDS</span>
                  <h3>Weekly Diamond Pass</h3>
                  <p>
                    Pilihan layanan WDP untuk pemain Mobile Legends.
                  </p>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => notify("Layanan WDP segera tersedia.")}
                  >
                    Lihat Layanan
                    <ArrowUpRight size={16} />
                  </button>
                </div>

                <div className="service-card">
                  <div className="service-icon">
                    <Trophy size={28} />
                  </div>

                  <span className="service-label">MOBILE LEGENDS</span>
                  <h3>Joki Rank</h3>
                  <p>
                    Informasi layanan bantuan push rank Mobile Legends.
                  </p>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => notify("Layanan Joki Rank segera tersedia.")}
                  >
                    Lihat Layanan
                    <ArrowUpRight size={16} />
                  </button>
                </div>

                <div className="service-card">
                  <div className="service-icon">
                    <Users size={28} />
                  </div>

                  <span className="service-label">MABAR BARENG</span>
                  <h3>Mabar Push Rank</h3>
                  <p>
                    Temukan layanan mabar untuk bermain bersama.
                  </p>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => notify("Layanan Mabar segera tersedia.")}
                  >
                    Lihat Layanan
                    <ArrowUpRight size={16} />
                  </button>
                </div>
              </div>
            </section>

                        {/* =========================================================
                INFORMASI SAVIXARA
            ========================================================= */}

            <section className="section info-section" id="informasi">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">
                    KENALI SAVIXARA
                  </span>
                  <h2>Informasi SAVIXARA</h2>
                  <p>
                    Kenali layanan, komitmen, dan dukungan yang kami sediakan.
                  </p>
                </div>
                </div>

              <div className="info-grid">
                <div className="info-card">
                  <div className="info-icon">
                    <Info size={24} />
                  </div>
                  <h3>Tentang SAVIXARA</h3>
                  <p>
                    SAVIXARA adalah platform yang dirancang untuk membantu
                    pemain menemukan pilihan produk dan layanan game dalam
                    satu tempat.
                  </p>
                </div>

                <div className="info-card">
                  <div className="info-icon">
                    <ShieldCheck size={24} />
                  </div>
                  <h3>Keamanan Transaksi</h3>
                  <p>
                    Kami mengutamakan kejelasan informasi produk dan proses
                    transaksi agar pelanggan dapat berbelanja dengan nyaman.
                  </p>
                </div>

                <div className="info-card">
                  <div className="info-icon">
                    <Headphones size={24} />
                  </div>
                  <h3>Dukungan Pelanggan</h3>
                  <p>
                    Hubungi customer support jika kamu memiliki pertanyaan
                    mengenai produk atau transaksi.
                  </p>
                </div>

                <div className="info-card">
                  <div className="info-icon">
                    <Globe size={24} />
                  </div>
                  <h3>Layanan Game</h3>
                  <p>
                    Temukan berbagai kategori game dan layanan gaming yang
                    tersedia di SAVIXARA.
                  </p>
                </div>
              </div>
            </section>

            
            {/* =========================================================
                FAQ - PERTANYAAN YANG SERING DITANYAKAN
            ========================================================= */}

            <section className="section faq-section" id="faq">
              <div className="section-heading">
                <div>
                  <span className="section-eyebrow">
                    BUTUH BANTUAN?
                  </span>
                  <h2>Pertanyaan yang Sering Ditanyakan</h2>
                  <p>
                    Temukan jawaban untuk pertanyaan umum tentang SAVIXARA.
                  </p>
                </div>
              </div>

              <div className="faq-list">
                <details className="faq-item">
                  <summary>
                    Apa itu SAVIXARA?
                    <span className="faq-toggle">+</span>
                  </summary>
                  <p>
                    SAVIXARA adalah platform yang menyediakan informasi
                    produk dan layanan game untuk membantu pemain menemukan
                    pilihan yang sesuai.
                  </p>
                </details>

                <details className="faq-item">
                  <summary>
                    Bagaimana cara melakukan top up?
                    <span className="faq-toggle">+</span>
                  </summary>
                  <p>
                    Pilih game yang kamu inginkan, periksa produk yang
                    tersedia, lalu ikuti petunjuk transaksi yang ditampilkan
                    pada platform.
                  </p>
                </details>

                <details className="faq-item">
                  <summary>
                    Apakah pembayaran saya aman?
                    <span className="faq-toggle">+</span>
                  </summary>
                  <p>
                    Selalu periksa detail pesanan dan metode pembayaran
                    sebelum menyelesaikan transaksi. Gunakan metode pembayaran
                    resmi yang tersedia dan jangan membagikan kata sandi akun
                    game kepada siapa pun.
                  </p>
                </details>

                <details className="faq-item">
                  <summary>
                    Bagaimana cara menghubungi customer service?
                    <span className="faq-toggle">+</span>
                  </summary>
                  <p>
                    Kamu dapat menghubungi customer service melalui tombol
                    WhatsApp yang tersedia di website.
                  </p>
                </details>

                <details className="faq-item">
                  <summary>
                    Apakah semua layanan tersedia setiap saat?
                    <span className="faq-toggle">+</span>
                  </summary>
                  <p>
                    Ketersediaan produk dan layanan dapat berbeda. Periksa
                    informasi pada halaman produk atau hubungi customer
                    service untuk mendapatkan kepastian.
                  </p>
                </details>

                
<details className="faq-item">
  <summary>
    Bagaimana kebijakan refund di SAVIXARA?
    <span className="faq-toggle">+</span>
  </summary>
  <p>
    Pengajuan refund akan ditinjau berdasarkan status transaksi
    dan ketentuan layanan yang berlaku. Jika transaksi mengalami
    kendala, silakan hubungi Customer Service SAVIXARA melalui
    WhatsApp dengan menyertakan informasi transaksi agar dapat
    diperiksa lebih lanjut. Refund tidak dijamin untuk setiap
    transaksi dan mengikuti hasil pemeriksaan.
  </p>
</details>

              </div>
            </section>
            
          </main>

          {/* FOOTER */}
          <Footer onNotify={notify} />

          {/* FLOATING WHATSAPP */}
          <a
            className="float-wa"
            href="https://wa.me/6285795191215"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="WhatsApp Customer Service"
          >
            <MessageCircle size={24} />
          </a>

          {/* TOAST NOTIFICATION */}
          {toast && <div className="toast">{toast}</div>}
        </>
      )}
    </div>
  );
}

export default Home;
            

