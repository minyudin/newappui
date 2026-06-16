import { Text } from '@tarojs/components'
import { useEffect, useState } from 'react'
import './index.scss'

/**
 * Typewriter · 打字机式 reveal
 * ============================================================
 *  逐字 reveal 一段文字, 配合一个闪烁的方块光标.
 *  专给 hero 标题 / 章节首行 / 印章字 用.
 *
 *  实现:
 *    - 用 setInterval 推进 visibleCount, 控制渲染前 N 字
 *    - 已显字符之后接一个伪元素 caret (CSS 闪烁)
 *    - 完成后 caret 自动消失 (props.showCaret=false 时也关)
 *
 *  性能:
 *    - 单条文字 ≤ 64 字, 30ms/字, 满载 ~2s
 *    - 用单一 interval, 不为每个字符开 timeout
 * ============================================================ */

interface Props {
  text: string
  /** 每字 ms, 默认 36 */
  speed?: number
  /** 起始延迟, 让多个 typewriter 串行 */
  delay?: number
  /** 完成后是否保留 caret · 默认 false */
  keepCaret?: boolean
  /** className 透传, 让外层控制字体大小 */
  className?: string
}

export default function Typewriter({
  text,
  speed = 36,
  delay = 0,
  keepCaret = false,
  className,
}: Props) {
  const [n, setN] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    setN(0)
    setDone(false)
    let timer: ReturnType<typeof setInterval> | null = null
    const start = setTimeout(() => {
      timer = setInterval(() => {
        setN((cur) => {
          const next = cur + 1
          if (next >= text.length) {
            if (timer) clearInterval(timer)
            setDone(true)
          }
          return next
        })
      }, speed)
    }, delay)
    return () => {
      clearTimeout(start)
      if (timer) clearInterval(timer)
    }
  }, [text, speed, delay])

  const showCaret = keepCaret || !done

  return (
    <Text className={`tw ${className || ''}`}>
      <Text className='tw__text'>{text.slice(0, n)}</Text>
      {showCaret ? <Text className='tw__caret'>&#9608;</Text> : null}
    </Text>
  )
}
