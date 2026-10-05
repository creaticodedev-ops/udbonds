const TICKS = Array.from({ length: 120 }, (_, i) => i * 3)
const C = 200

const polar = (deg, radius) => {
  const a = ((deg - 90) * Math.PI) / 180
  return { x: C + radius * Math.cos(a), y: C + radius * Math.sin(a) }
}

const arc = (from, to, radius) => {
  const s = polar(from, radius)
  const e = polar(to, radius)
  return `M${s.x} ${s.y} A${radius} ${radius} 0 ${to - from > 180 ? 1 : 0} 1 ${e.x} ${e.y}`
}

/** Gold as a chemical element (Au, 79) inside a precision dial. */
export const GoldElement = ({ name, numberLabel, massLabel, mass, label }) => (
  <figure className="gold" aria-label={label}>
    <svg className="gold-dial" viewBox="0 0 400 400" aria-hidden="true">
      <circle className="gold-ring" cx={C} cy={C} r="196" />
      <g className="gold-ticks">
        {TICKS.map((deg) => {
          const major = deg % 30 === 0
          const a = polar(deg, 186)
          const b = polar(deg, major ? 170 : 178)
          return <line key={deg} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={major ? 'is-major' : undefined} />
        })}
      </g>
      <path className="gold-arc" d={arc(300, 352, 160)} />
      <circle className="gold-ring is-inner" cx={C} cy={C} r="150" />
    </svg>
    <div className="gold-tile">
      <span className="gold-number" title={numberLabel}>
        79
      </span>
      <span className="gold-symbol" lang="la">
        Au
      </span>
      <span className="gold-name">{name}</span>
      <span className="gold-mass" title={massLabel}>
        {mass}
      </span>
    </div>
  </figure>
)

export default GoldElement
