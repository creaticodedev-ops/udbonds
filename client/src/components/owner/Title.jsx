import React from 'react'

const Title = ({ title, subTitle }) => {
  return (
    <div className="min-w-0">
      <h1 className="font-semibold text-2xl md:text-3xl tracking-tight text-gray-900 break-words">
        {title}
      </h1>
      {subTitle && (
        <p className="text-sm md:text-base text-gray-500 mt-2 max-w-2xl leading-relaxed">
          {subTitle}
        </p>
      )}
    </div>
  )
}

export default Title
