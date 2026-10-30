import React from 'react';
import {
  ArrowRight,
  Headphones,
  Gamepad2,
  Trophy,
  Users,
  Zap
} from 'lucide-react';

function ServiceCard({
  service,
  onClick
}) {
  if (!service) return null;

  const {
    name,
    sub,
    description,
    tone = 'wdp',
    icon = 'headphones',
    image,
    badge
  } = service;

  const icons = {
    headphones: Headphones,
    gamepad: Gamepad2,
    trophy: Trophy,
    users: Users,
    zap: Zap
  };

  const Icon = icons[icon] || Headphones;

  return (
    <button
      type="button"
      className={`service-card ${tone}`}
      onClick={onClick}
      aria-label={`Lihat layanan ${name}`}
    >

      <div className="service-icon">

        {image ? (
          <img
            src={image}
            alt=""
            className="service-image"
            loading="lazy"
          />
        ) : (
          <Icon size={25} />
        )}

      </div>

      <div className="service-content">

        {badge && (
          <span className="service-badge">
            {badge}
          </span>
        )}

        <b>{name}</b>

        {sub && (
          <span>{sub}</span>
        )}

        {description && (
          <small>{description}</small>
        )}

      </div>

      <div className="service-arrow">
        <ArrowRight size={18} />
      </div>

    </button>
  );
}

export default ServiceCard;
