import React from 'react';
import { ArrowRight, Gamepad2 } from 'lucide-react';

function FeatureCard({
  title,
  text,
  cta,
  tone = 'blue',
  onClick
}) {
  return (
    <div className={`feature-card ${tone}`}>

      <div className="feature-art">
        <div className="feature-orb"></div>

        <Gamepad2 size={50} />
      </div>

      <div className="feature-copy">

        <b>{title}</b>

        <span>{text}</span>

        <button
          type="button"
          onClick={onClick}
        >
          {cta}

          <ArrowRight size={14} />
        </button>

      </div>

    </div>
  );
}

export default FeatureCard;
