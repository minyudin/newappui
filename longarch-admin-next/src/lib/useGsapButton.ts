import { useEffect, type RefObject } from 'react'
import { gsap } from 'gsap'

interface UseGsapButtonOptions {
  disabled?: boolean
}

/**
 * 管理端按钮动效:
 * - hover: 轻微浮起
 * - press: 压缩回弹
 * - click: 径向高光脉冲
 */
export function useGsapButton(
  ref: RefObject<HTMLElement | null>,
  options?: UseGsapButtonOptions,
) {
  const disabled = Boolean(options?.disabled)

  useEffect(() => {
    const el = ref.current
    if (!el || disabled) return
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return
    }

    gsap.set(el, { transformPerspective: 600, transformOrigin: '50% 50%' })

    const hoverIn = () => {
      gsap.to(el, {
        y: -2,
        scale: 1.01,
        duration: 0.18,
        ease: 'power2.out',
      })
    }
    const hoverOut = () => {
      gsap.to(el, {
        y: 0,
        scale: 1,
        duration: 0.2,
        ease: 'power2.out',
      })
    }
    const pressIn = () => {
      gsap.to(el, {
        scale: 0.97,
        duration: 0.08,
        ease: 'power1.out',
      })
    }
    const pressOut = () => {
      gsap.to(el, {
        scale: 1,
        duration: 0.28,
        ease: 'back.out(4)',
      })
    }
    const pulse = () => {
      gsap.fromTo(
        el,
        { boxShadow: '0 0 0 0 rgba(111, 138, 118, 0.35)' },
        {
          boxShadow: '0 0 0 10px rgba(111, 138, 118, 0)',
          duration: 0.45,
          ease: 'power2.out',
        },
      )
    }

    el.addEventListener('mouseenter', hoverIn)
    el.addEventListener('mouseleave', hoverOut)
    el.addEventListener('pointerdown', pressIn)
    el.addEventListener('pointerup', pressOut)
    el.addEventListener('click', pulse)

    return () => {
      el.removeEventListener('mouseenter', hoverIn)
      el.removeEventListener('mouseleave', hoverOut)
      el.removeEventListener('pointerdown', pressIn)
      el.removeEventListener('pointerup', pressOut)
      el.removeEventListener('click', pulse)
    }
  }, [ref, disabled])
}

