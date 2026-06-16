import { useEffect, useRef, useState } from 'react'
import flvjs from 'flv.js'
import Hls from 'hls.js'

/**
 * §7 · LivePreview · admin 端摄像头实时预览
 * ============================================================
 *  浏览器端 flv.js / hls.js 播 SRS 实时流, 不需要备案域名 (浏览器同域 + CORS).
 *
 *  播放策略:
 *    1) 优先用 FLV (低延迟 ~3s)
 *    2) FLV 失败或不可用时降级 HLS (高兼容 ~10s+)
 *    3) 都失败显示错误占位
 *
 *  生命周期:
 *    · 组件挂载 → 创建 player → load → play
 *    · flvUrl/hlsUrl 改变 → destroy 旧 player + 重建
 *    · 组件卸载 → destroy + clear video src
 *
 *  错误恢复:
 *    · 网络错或解码错: 5s 后自动尝试重新挂载 (最多 3 次)
 * ============================================================ */

interface Props {
  flvUrl?: string | null
  hlsUrl?: string | null
  /** 海报占位图 (传 snapshotUrl, 视频开始播之前显示) */
  poster?: string
  /** 容器自定义 className */
  className?: string
}

export default function LivePreview({ flvUrl, hlsUrl, poster, className }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const flvPlayerRef = useRef<flvjs.Player | null>(null)
  const hlsPlayerRef = useRef<Hls | null>(null)
  const retryCountRef = useRef(0)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [status, setStatus] = useState<'idle' | 'loading' | 'playing' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string>('')

  useEffect(() => {
    cleanup()
    if (!flvUrl && !hlsUrl) {
      setStatus('error')
      setErrMsg('未配置 FLV / HLS URL')
      return
    }
    setStatus('loading')
    setErrMsg('')
    retryCountRef.current = 0

    // 优先 flv.js
    if (flvUrl && flvjs.isSupported()) {
      tryFlv()
    } else if (hlsUrl) {
      tryHls()
    } else {
      setStatus('error')
      setErrMsg('当前浏览器不支持 FLV, 且无 HLS 备用 URL')
    }
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flvUrl, hlsUrl])

  function tryFlv() {
    const video = videoRef.current
    if (!video || !flvUrl) return
    try {
      const player = flvjs.createPlayer(
        { type: 'flv', url: flvUrl, isLive: true, hasAudio: false, hasVideo: true },
        { enableStashBuffer: false, stashInitialSize: 128, lazyLoad: false, autoCleanupSourceBuffer: true },
      )
      player.attachMediaElement(video)
      player.load()
      player.play()?.catch((e: unknown) => console.warn('[LivePreview] flv autoplay blocked', e))

      player.on(flvjs.Events.ERROR, (errType, errDetail) => {
        console.warn('[LivePreview] flv error', errType, errDetail)
        scheduleRetry(`FLV error: ${errType}/${errDetail}`)
      })
      player.on(flvjs.Events.STATISTICS_INFO, () => {
        if (status !== 'playing') setStatus('playing')
      })

      flvPlayerRef.current = player
    } catch (e) {
      console.error('[LivePreview] flv create failed', e)
      // FLV 不行 → 降级 HLS
      if (hlsUrl) tryHls()
      else {
        setStatus('error')
        setErrMsg('FLV 播放器初始化失败')
      }
    }
  }

  function tryHls() {
    const video = videoRef.current
    if (!video || !hlsUrl) return
    try {
      // Safari 原生支持 HLS, 直接给 video.src 即可
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = hlsUrl
        video.play()?.catch((e) => console.warn('[LivePreview] native hls autoplay blocked', e))
        setStatus('playing')
        return
      }
      // Chrome/Edge/Firefox 用 hls.js
      if (Hls.isSupported()) {
        const hls = new Hls({ liveDurationInfinity: true, lowLatencyMode: true })
        hls.loadSource(hlsUrl)
        hls.attachMedia(video)
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play()?.catch((e) => console.warn('[LivePreview] hls.js autoplay blocked', e))
          setStatus('playing')
        })
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          if (data.fatal) {
            console.warn('[LivePreview] hls fatal', data)
            scheduleRetry(`HLS error: ${data.type}`)
          }
        })
        hlsPlayerRef.current = hls
      } else {
        setStatus('error')
        setErrMsg('当前浏览器不支持 HLS')
      }
    } catch (e) {
      console.error('[LivePreview] hls init failed', e)
      setStatus('error')
      setErrMsg('HLS 播放器初始化失败')
    }
  }

  function scheduleRetry(reason: string) {
    if (retryCountRef.current >= 3) {
      setStatus('error')
      setErrMsg(`${reason} · 已重试 3 次仍失败, 请检查推流是否正常`)
      return
    }
    retryCountRef.current += 1
    setStatus('loading')
    setErrMsg(`重连中 (第 ${retryCountRef.current} 次)…`)
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    retryTimerRef.current = setTimeout(() => {
      cleanupPlayer()
      if (flvUrl && flvjs.isSupported()) tryFlv()
      else if (hlsUrl) tryHls()
      else {
        setStatus('error')
        setErrMsg(reason)
      }
    }, 5000)
  }

  function cleanupPlayer() {
    if (flvPlayerRef.current) {
      try {
        flvPlayerRef.current.pause()
        flvPlayerRef.current.unload()
        flvPlayerRef.current.detachMediaElement()
        flvPlayerRef.current.destroy()
      } catch (e) {
        console.warn('[LivePreview] flv destroy', e)
      }
      flvPlayerRef.current = null
    }
    if (hlsPlayerRef.current) {
      try {
        hlsPlayerRef.current.destroy()
      } catch (e) {
        console.warn('[LivePreview] hls destroy', e)
      }
      hlsPlayerRef.current = null
    }
  }

  function cleanup() {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
    cleanupPlayer()
    const video = videoRef.current
    if (video) {
      try {
        video.pause()
        video.removeAttribute('src')
        video.load()
      } catch {
        // noop
      }
    }
  }

  return (
    <div className={`relative w-full aspect-video bg-black ${className ?? ''}`.trim()}>
      <video
        ref={videoRef}
        poster={poster ?? undefined}
        muted
        autoPlay
        playsInline
        controls
        className="w-full h-full object-contain"
      />
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-paper-light font-folio text-[12px] uppercase tracking-widest">
          {errMsg || 'Loading…'}
        </div>
      )}
      {status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 text-clay font-folio text-[12px] uppercase tracking-widest gap-2 px-4 text-center">
          <span className="text-[14px] tracking-wider">视频流不可用</span>
          <span className="text-paper-light text-[11px] normal-case tracking-normal">
            {errMsg}
          </span>
        </div>
      )}
    </div>
  )
}
