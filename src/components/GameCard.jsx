import React from 'react';
import {
  ChevronRight,
  Gamepad2
} from 'lucide-react';

function GameCard({
  game,
  onClick
}) {
  if (!game) return null;

  const {
    name,
    publisher,
    tag,
    tone = '',
    icon,
    cover,
    status = 'Tersedia',
    slug
  } = game;

  const handleClick = () => {
    // Jika Home.jsx memberikan fungsi onClick,
    // gunakan fungsi tersebut terlebih dahulu.
    if (onClick) {
      onClick(game);
      return;
    }

    // Fallback untuk navigasi langsung.
    const gameSlug =
      slug ||
      name
        ?.toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    if (gameSlug) {
      window.location.hash = `#topup/${gameSlug}`;
    }
  };

  return (
    <button
      type="button"
      className={`game-card ${tone}`}
      onClick={handleClick}
      aria-label={`Top up ${name}`}
    >

      {/* COVER GAME */}
      <div className="cover">

        {cover ? (
          <img
            src={cover}
            alt={name}
            className="game-cover-image"
            loading="lazy"
          />
        ) : (
          <div className="game-cover-fallback">

            {icon ? (
              <img
                src={icon}
                alt=""
                className="game-icon"
                loading="lazy"
              />
            ) : (
              <Gamepad2 size={44} />
            )}

          </div>
        )}

        <div className="cover-overlay"></div>

        {/* TAG */}
        {tag && (
          <span className="game-tag">
            {tag}
          </span>
        )}

        {/* STATUS */}
        <span className="game-status">
          {status}
        </span>

      </div>

      {/* INFORMASI GAME */}
      <div className="game-meta">

        <div className="game-info">

          <b>{name}</b>

          {publisher && (
            <small>
              {publisher}
            </small>
          )}

        </div>

        {/* ARROW */}
        <div className="game-arrow">
          <ChevronRight size={18} />
        </div>

      </div>

    </button>
  );
}

export default GameCard;
