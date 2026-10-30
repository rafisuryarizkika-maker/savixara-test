import React from 'react';
import { ArrowRight, Sparkles, Tag, Clock3 } from 'lucide-react';

function PromoCard({
  promo,
  onClick
}) {
  if (!promo) return null;

  const {
    title,
    text,
    tone = 'promo1',
    image,
    badge = 'PROMO'
  } = promo;

  return (
    <button
      type="button"
      className={`promo-card ${tone}`}
      onClick={onClick}
      aria-label={`Lihat promo ${title}`}
    >
      <div className="promo-art">

        {image ? (
          <img
            src={image}
            alt={title}
            className="promo-image"
            loading="lazy"
          />
        ) : (
          <>
            <div className="promo-glow"></div>

            <div className="promo-icon">
              <Sparkles size={34} />
            </div>
          </>
        )}

        <span className="promo-badge">
          <Tag size={11} />
          {badge}
        </span>

      </div>

      <div className="promo-content">

        <b>{title}</b>

        <span>{text}</span>

        <div className="promo-bottom">

          <em>
            <Clock3 size={12} />
            Penawaran terbatas
          </em>

          <strong>
            Lihat
            <ArrowRight size={14} />
          </strong>

        </div>

      </div>

    </button>
  );
}

export default PromoCard;
