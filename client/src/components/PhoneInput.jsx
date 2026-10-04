import React from 'react'
import PhoneInputBase from 'react-phone-number-input'
import { isValidPhoneNumber } from 'libphonenumber-js'
import 'react-phone-number-input/style.css'

const defaultInputClass =
  'h-12 border border-borderColor px-3 rounded-lg w-full bg-white text-[15px] text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30'

const PhoneInput = ({
  id,
  value,
  onChange,
  required = false,
  defaultCountry = 'MA',
  className = '',
  inputClassName = '',
  placeholder = '',
}) => (
  <PhoneInputBase
    id={id}
    international
    defaultCountry={defaultCountry}
    value={value || undefined}
    onChange={(next) => onChange(next || '')}
    className={`phone-input-field ${className}`}
    numberInputProps={{
      className: `${defaultInputClass} ${inputClassName}`.trim(),
      required,
      placeholder,
    }}
  />
)

export const isPhoneValid = (value) => {
  if (!value) return false
  try {
    return isValidPhoneNumber(value)
  } catch {
    return false
  }
}

export default PhoneInput
