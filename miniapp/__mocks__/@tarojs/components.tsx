// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Jest mock · @tarojs/components
 * ============================================================
 *  把 Taro 组件降级成普通 HTML 元素, 让 RTL 能在 jsdom 里 render.
 *  用 @ts-nocheck 关类型检查 · 单测 mock 要简单别较真
 * ============================================================ */
import React from 'react'

type AnyProps = Record<string, unknown> & { children?: React.ReactNode }

export const View: React.FC<AnyProps> = ({ children, className, ...rest }) => (
  <div className={className as string | undefined} {...(rest as never)}>
    {children}
  </div>
)

export const Text: React.FC<AnyProps> = ({ children, className, ...rest }) => (
  <span className={className as string | undefined} {...(rest as never)}>
    {children}
  </span>
)

interface ButtonProps extends AnyProps {
  loading?: boolean
  disabled?: boolean
  onClick?: (e: unknown) => void
}

export const Button: React.FC<ButtonProps> = ({
  children,
  loading,
  disabled,
  onClick,
  className,
  ...rest
}) => (
  <button
    className={className as string | undefined}
    disabled={disabled || loading}
    onClick={onClick as never}
    {...(rest as never)}
  >
    {children}
  </button>
)

interface InputProps extends AnyProps {
  value?: string
  onChange?: (e: unknown) => void
  onInput?: (e: unknown) => void
  placeholder?: string
  type?: string
}

export const Input: React.FC<InputProps> = ({
  value,
  onChange,
  onInput,
  placeholder,
  type = 'text',
  className,
  ...rest
}) => (
  <input
    type={type}
    value={value}
    placeholder={placeholder}
    onChange={(e) => {
      const handler = onInput || onChange
      if (handler) handler({ detail: { value: e.target.value } })
    }}
    className={className as string | undefined}
    {...(rest as never)}
  />
)

export const ScrollView: React.FC<AnyProps> = ({ children, className, ...rest }) => (
  <div className={className as string | undefined} data-component="scroll-view" {...(rest as never)}>
    {children}
  </div>
)

export const Image: React.FC<AnyProps> = ({ src, className, ...rest }) => (
  <img src={src as string} className={className as string | undefined} {...(rest as never)} alt="" />
)

export const Navigator: React.FC<AnyProps> = ({ children, ...rest }) => (
  <a {...(rest as never)}>{children}</a>
)

export const Form: React.FC<AnyProps> = ({ children, ...rest }) => (
  <form {...(rest as never)}>{children}</form>
)

export const Label: React.FC<AnyProps> = ({ children, ...rest }) => (
  <label {...(rest as never)}>{children}</label>
)
