import { Icon } from "./Icons";

export function RouteIllustration() {
  return (
    <div className="route-art">
      <div className="art-coordinate">
        CONEXIONES QUE IMPORTAN <span>01 — 03</span>
      </div>
      <svg
        className="route-svg"
        viewBox="0 0 680 570"
        role="img"
        aria-labelledby="route-title route-description"
      >
        <title id="route-title">
          Del hogar al colegio, un trayecto compartido
        </title>
        <desc id="route-description">
          Ilustración conceptual de una ruta que conecta un hogar, un furgón y
          un colegio. No representa ubicación ni seguimiento en vivo.
        </desc>
        <defs>
          <pattern
            id="grid"
            width="38"
            height="38"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-24 340 285)"
          >
            <path
              d="M38 0H0V38"
              fill="none"
              stroke="#d9dfd7"
              strokeWidth=".7"
            />
          </pattern>
          <pattern
            id="cross"
            width="14"
            height="14"
            patternUnits="userSpaceOnUse"
          >
            <path d="M5 7h4M7 5v4" stroke="#a8bf9b" strokeWidth=".8" />
          </pattern>
          <linearGradient id="land" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#eef2e8" />
            <stop offset="1" stopColor="#f7f8f5" />
          </linearGradient>
        </defs>
        <ellipse cx="350" cy="300" rx="305" ry="240" fill="url(#land)" />
        <rect
          width="680"
          height="570"
          fill="url(#grid)"
          style={{
            maskImage: "radial-gradient(ellipse, black 25%, transparent 70%)",
          }}
        />
        <path d="m65 257 113-51 56 25-2 67-76 37-74-32Z" fill="#e4ebda" />
        <path d="m65 257 113-51 56 25-2 67-76 37-74-32Z" fill="url(#cross)" />
        <path d="m415 398 90-42 76 35-14 66-89 33-63-35Z" fill="#e3ebd8" />
        <path d="m415 398 90-42 76 35-14 66-89 33-63-35Z" fill="url(#cross)" />
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path
            d="M-20 440 652 124M27 555 705 238M124 74l540 254M-10 207l589 278"
            stroke="#e2e7e0"
            strokeWidth="27"
          />
          <path
            d="M-20 440 652 124M27 555 705 238M124 74l540 254M-10 207l589 278"
            stroke="#fff"
            strokeWidth="21"
          />
          <path
            d="M-20 440 652 124M27 555 705 238M124 74l540 254M-10 207l589 278"
            stroke="#d7ded4"
            strokeWidth="1"
            strokeDasharray="5 8"
          />
        </g>
        <g fill="#e5e9e2" stroke="#d1d9cd" strokeWidth="1">
          <path d="m257 114 43-20 40 19-43 20Z" />
          <path d="m257 114 40 19v30l-40-19Z" fill="#dce3d8" />
          <path d="m297 133 43-20v30l-43 20Z" fill="#edf0e9" />
          <path d="m527 293 47-22 38 18-47 22Z" />
          <path d="m527 293 38 18v33l-38-18Z" fill="#dce3d8" />
          <path d="m565 311 47-22v33l-47 22Z" fill="#edf0e9" />
          <path d="m254 439 45-21 35 17-45 21Z" />
          <path d="m254 439 35 17v23l-35-17Z" fill="#dce3d8" />
          <path d="m289 456 45-21v23l-45 21Z" fill="#edf0e9" />
        </g>
        <g stroke="#a1b292" strokeWidth="2">
          <path d="M121 252v31M195 268v27M470 427v29M540 414v27M368 105v25" />
        </g>
        <g fill="#b8cba9">
          <ellipse cx="121" cy="246" rx="13" ry="19" />
          <ellipse cx="195" cy="262" rx="10" ry="15" />
          <ellipse cx="470" cy="422" rx="14" ry="21" />
          <ellipse cx="540" cy="408" rx="11" ry="17" />
          <ellipse cx="368" cy="99" rx="10" ry="16" />
        </g>
        <path
          d="M139 410 294 337Q312 329 329 337l28 13q18 9 36 0l101-47q17-8 17-26v-49"
          fill="none"
          stroke="#c9d7ff"
          strokeWidth="14"
          strokeLinecap="round"
        />
        <path
          className="animated-route"
          pathLength="1"
          d="M139 410 294 337Q312 329 329 337l28 13q18 9 36 0l101-47q17-8 17-26v-49"
          fill="none"
          stroke="#0752ac"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <g>
          <ellipse
            cx="139"
            cy="411"
            rx="15"
            ry="8"
            fill="#0752ac"
            opacity=".12"
          />
          <ellipse cx="139" cy="411" rx="7" ry="4" fill="#0752ac" />
          <ellipse
            cx="511"
            cy="229"
            rx="13"
            ry="7"
            fill="#0752ac"
            opacity=".15"
          />
          <ellipse cx="511" cy="229" rx="6" ry="3" fill="#0752ac" />
        </g>
        <g transform="translate(65 330)">
          <path d="m0 34 47-22 47 22-47 23Z" fill="#dce3d6" />
          <path d="M12 27 47 11l34 16v44L47 87 12 70Z" fill="#fdfdf8" />
          <path d="m47 44 34-17v44L47 87Z" fill="#e1e5dc" />
          <path d="M4 31 43 0l47 28-43 20Z" fill="#243c66" />
          <path d="M4 31v7l43 20v-10ZM47 48l43-20v7L47 58Z" fill="#182e54" />
          <path d="m26 52 12 6v19l-12-6Z" fill="#b7c8e9" />
          <path d="m58 57 11-5v12l-11 5Z" fill="#90a9ce" />
        </g>
        <g transform="translate(443 100)">
          <path d="m-10 77 79-37 82 39-79 37Z" fill="#d7ded1" />
          <path d="m0 52 68-32 68 32v50l-68 32L0 102Z" fill="#fffdf5" />
          <path d="m68 84 68-32v50l-68 32Z" fill="#e8e8dc" />
          <path d="m-5 50 73-34 73 34-73 35Z" fill="#aec0e8" />
          <path d="M-5 50v7l73 35v-7ZM68 85l73-35v7L68 92Z" fill="#829aca" />
          <path d="M41 38V14L68 1l27 26v24L68 64Z" fill="#faf9ef" />
          <path d="m68 1 27 26-27 13-27-26Z" fill="#2b4f91" />
          <path d="M68 40v24l27-13V27Z" fill="#e5e5d8" />
          <circle cx="56" cy="36" r="7" fill="#fff" stroke="#8597ae" />
          <path
            d="M56 31v5l3 3"
            fill="none"
            stroke="#2d4267"
            strokeWidth="1.5"
          />
          <path d="m52 92 13 6v29l-13-6Z" fill="#2b4f91" />
          <g fill="#95afd0">
            <path d="m12 70 9 4v13l-9-4ZM29 78l9 4v13l-9-4ZM80 95l10-5v13l-10 5ZM100 85l10-5v13l-10 5ZM120 75l9-4v13l-9 4Z" />
          </g>
          <path d="M97 14V-9" stroke="#7f91a6" strokeWidth="2" />
          <path d="M98-9h21l-5 6 5 6H98Z" fill="#c3d5a9" />
        </g>
        <g className="illustrated-van" transform="translate(308 267)">
          <ellipse
            className="van-shadow"
            cx="47"
            cy="84"
            rx="62"
            ry="13"
            fill="#1a355d"
            opacity=".09"
            transform="rotate(13 47 84)"
          />
          {/* Both wheels share the long side's perspective and sill line. */}
          <g className="van-side" transform="matrix(1 .475 0 1 -12 23)">
            <g className="van-wheel" transform="translate(15 32)">
              <ellipse rx="7" ry="10" fill="#26344a" />
              <ellipse rx="3" ry="5" fill="#c6cbd0" />
            </g>
            <g className="van-wheel" transform="translate(64 32)">
              <ellipse rx="7" ry="10" fill="#26344a" />
              <ellipse rx="3" ry="5" fill="#c6cbd0" />
            </g>
            <path
              className="van-body-side"
              d="M0 0H80V32H72a8 11 0 0 0-16 0H23a8 11 0 0 0-16 0H0Z"
              fill="#edb843"
            />
            <path d="M0 0H80v3H0Z" fill="#ffdc78" />
            <path
              className="van-side-windows"
              d="M7 6h12v14H7ZM25 6h12v14H25ZM43 6h12v14H43ZM61 6h13v14H61Z"
              fill="#263e61"
            />
          </g>
          <path
            className="van-front"
            d="m68 61 39-18.5v32L68 93Z"
            fill="#ffd369"
          />
          <path d="m-12 23 39-18.5 80 38-39 18.5Z" fill="#ffe5a0" />
          <path d="m75 64 25-12v15L75 79Z" fill="#344d6d" />
          <path
            d="m74 84 7-3.3m14-6.7 7-3.3"
            stroke="#fff7d8"
            strokeWidth="3"
          />
          <path d="m74 89 28-13.3" stroke="#d89d2e" strokeWidth="2" />
        </g>
        <g
          fill="#6e7a72"
          fontSize="9"
          fontFamily="sans-serif"
          letterSpacing="2"
        >
          <text transform="translate(205 480) rotate(-25)">
            UN MISMO CAMINO
          </text>
        </g>
      </svg>
      <div className="map-label map-label-home">
        <span className="label-icon">
          <Icon name="home" size={16} />
        </span>
        <span>
          Todo parte en casa<small>01 / HOGAR</small>
        </span>
      </div>
      <div className="map-label map-label-school">
        <span className="label-icon green">
          <Icon name="school" size={16} />
        </span>
        <span>
          Un destino compartido<small>03 / COLEGIO</small>
        </span>
      </div>
      <div className="map-label map-label-van">
        <span className="small-dot" /> Más conexión en el camino
      </div>
      <ol className="route-stages" role="list" aria-label="Etapas del trayecto">
        <li className="map-label route-stage-home">
          <span className="stage-number" aria-hidden="true">01</span>
          <span>Hogar</span>
        </li>
        <li className="map-label route-stage-van">
          <span className="stage-number" aria-hidden="true">02</span>
          <span>Trayecto compartido</span>
        </li>
        <li className="map-label route-stage-school">
          <span className="stage-number" aria-hidden="true">03</span>
          <span>Colegio</span>
        </li>
      </ol>
      <span className="route-mobile-note">Recorrido ilustrativo</span>
      <div className="art-caption">
        <span>Una ruta. Muchas historias.</span>
        <span>Visualización referencial del trayecto</span>
      </div>
    </div>
  );
}
