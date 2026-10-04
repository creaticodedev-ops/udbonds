import React from 'react'

const Title = ({ title, subTitle, align, eyebrow }) => {
  return (
    <div className={`flex flex-col justify-center items-center text-center ${align === 'left' ? 'md:items-start md:text-left' : ''}`}>
      {eyebrow && (
        <p className="text-[11px] uppercase tracking-[0.2em] text-primary font-medium mb-3">
          {eyebrow}
        </p>
      )}
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-medium text-ink leading-tight px-1">
        {title}
      </h2>
      {subTitle && (
        <p className="text-sm md:text-base text-muted mt-3 max-w-xl leading-relaxed font-light px-1">
          {subTitle}
        </p>
      )}
    </div>
  )
}

export default Title
