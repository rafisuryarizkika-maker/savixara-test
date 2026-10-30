import React from 'react';
import {
  ArrowRight,
  Instagram,
  MessageCircle,
  Youtube,
  Music2,
  Gamepad2,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';

const logoUrl = `${import.meta.env.BASE_URL}assets/logo/savixara-horizontal.svg`;

const footerColumns = [
  {
    title: 'Tentang SAVIXARA',
    items: [
      'Tentang Kami',
      'Kenapa SAVIXARA',
      'Keamanan Transaksi',
      'Layanan Game'
    ]
  },
  {
    title: 'Peta Situs',
    items: [
      'Beranda',
      'Top Up Games',
      'Layanan Gaming',
      'Voucher',
      'Promo',
      'Cek Transaksi',
      'Artikel'
    ]
  },
  {
    title: 'Dukungan',
    items: [
      'Pusat Bantuan',
      'FAQ',
      'Cara Top Up',
      'Cara Pembayaran',
      'Refund',
      'Hubungi Kami'
    ]
  },
  {
    title: 'Legalitas',
    items: [
      'Syarat & Ketentuan',
      'Kebijakan Privasi',
      'Kebijakan Refund',
      'Kebijakan Cookie'
    ]
  }
];

const WHATSAPP_NUMBER = "6285795191215";
function Footer({ onNotify }) {
  
  const handleClick = (item) => {
    const scrollTo = (ids) => {
      const target = ids
        .map((id) => document.getElementById(id))
        .find(Boolean);

      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        return true;
      }

      return false;
    };

    if (item === 'Beranda') {
      window.location.href = window.location.pathname;
      return;
    }

    if (item === 'Top Up Games') {
      scrollTo(['games']) ||
        (window.location.href = `${window.location.pathname}#games`);
      return;
    }

    if (item === 'Layanan Gaming' || item === 'Layanan Game') {
      if (!scrollTo(['services', 'layanan'])) {
        window.location.href = `${window.location.pathname}#layanan`;
      }
      return;
    }

    if (item === 'Promo') {
      scrollTo(['promo']) ||
        (window.location.href = `${window.location.pathname}#promo`);
      return;
    }

    if (item === 'Voucher') {
      if (!scrollTo(['voucher'])) {
        onNotify?.('Katalog voucher sedang disiapkan.');
      }
      return;
    }

    if (item === 'Cek Transaksi') {
      scrollTo(['transaction', 'cek-transaksi']) ||
        onNotify?.('Fitur cek transaksi sedang disiapkan.');
      return;
    }

    if (item === 'Artikel') {
      scrollTo(['articles', 'artikel']) ||
        onNotify?.('Artikel SAVIXARA sedang disiapkan.');
      return;
    }

    if (item === 'Hubungi Kami') {
      window.open(
        `https://wa.me/${WHATSAPP_NUMBER}`,
        '_blank',
        'noopener,noreferrer'
      );
      return;
    }

    if (
      item === 'Pusat Bantuan' ||
      item === 'FAQ' ||
      item === 'Cara Top Up' ||
      item === 'Cara Pembayaran' ||
      item === 'Refund'
    ) {
      const section =
        document.getElementById('help') ||
        document.getElementById('faq');

      if (!section) {
        window.location.href =
          `${window.location.pathname}#help`;
        return;
      }

      section.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });

      if (item === 'Pusat Bantuan' || item === 'FAQ') {
        return;
      }

      const keywords = {
        'Cara Top Up': ['top up', 'topup'],
        'Cara Pembayaran': ['pembayaran', 'metode pembayaran'],
        Refund: ['refund', 'pengembalian dana'],
      };

      const questions = section.querySelectorAll('details.faq-item');

      
const match = Array.from(questions).find((detail) => {
  const summary =
    detail.querySelector('summary')?.textContent?.toLowerCase() || '';

  if (item === 'Refund') {
    return summary.includes('refund');
  }

  return keywords[item].some((keyword) =>
    summary.includes(keyword)
  );
});
      

      if (match) {
        match.open = true;
        match.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      } else {
        onNotify?.(`Pertanyaan ${item} belum ditemukan di FAQ.`);
      }

      return;
    }

    if (onNotify) {
      onNotify(`${item} akan segera tersedia.`);
    }
  };
  

  return (
    <footer className="footer">

      <div className="footer-top">

        <div className="footer-brand">

          <a href="#" aria-label="SAVIXARA">
            <img
              src={logoUrl}
              alt="SAVIXARA"
            />
          </a>

          <p>
            SAVIXARA adalah platform gaming untuk kebutuhan
            top up, voucher, dan layanan gaming pilihan
            dengan pengalaman yang praktis, cepat, dan aman.
          </p>

          <div className="footer-trust">

            <div>
              <ShieldCheck size={17} />
              <span>
                Transaksi Aman
              </span>
            </div>

            <div>
              <Gamepad2 size={17} />
              <span>
                Banyak Game
              </span>
            </div>

            <div>
              <HelpCircle size={17} />
              <span>
                Bantuan CS
              </span>
            </div>

          </div>

        </div>

        {footerColumns.map((column) => (
          <div
            className="footer-col"
            key={column.title}
          >

            <h4>{column.title}</h4>

            {column.items.map((item) => (
              <button
                type="button"
                key={item}
                onClick={() => handleClick(item)}
              >
                {item}
              </button>
            ))}

          </div>
        ))}

        <div className="footer-col footer-social">

          <h4>Ikuti SAVIXARA</h4>

          <p>
            Dapatkan informasi promo, update game,
            dan berita terbaru dari SAVIXARA.
          </p>

          <div className="social-links">

            
<a
  href="https://instagram.com/savixara"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="Instagram SAVIXARA"
>
  <Instagram size={18} />
</a>
            

            
<a
  href="https://www.tiktok.com/@savixaraa"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="TikTok SAVIXARA"
>
  <Music2 size={18} />
</a>
            

            <button
              type="button"
              aria-label="YouTube"
              onClick={() => handleClick('YouTube')}
            >
              <Youtube size={18} />
            </button>

            
<a
  href="https://wa.me/6285795191215"
  target="_blank"
  rel="noopener noreferrer"
  aria-label="WhatsApp SAVIXARA"
>
  <MessageCircle size={18} />
</a>


          </div>

          <button
            type="button"
            className="footer-help"
            onClick={() => handleClick('Pusat Bantuan')}
          >
            Pusat Bantuan
            <ArrowRight size={15} />
          </button>

        </div>

      </div>

      <div className="footer-bottom">

        <span>
          © 2026 SAVIXARA. All rights reserved.
        </span>

        <span>
          Top Up Game Jadi Lebih Mudah.
        </span>

      </div>

    </footer>
  );
}

export default Footer;
