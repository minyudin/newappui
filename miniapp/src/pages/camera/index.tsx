import { View, Text, Image, Button, WebView } from '@tarojs/components'
import Taro, {
  useLoad,
  useRouter,
  useUnload,
  useDidShow,
  useDidHide,
  usePullDownRefresh,
} from '@tarojs/taro'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getSnapshot, getLiveUrl } from '@/api/camera'
import './index.scss'

/**
 * §5 · 摄像头页 · 双模式
 * ============================================================
 *  入口: /pages/camera/index?cameraId=X&cameraName=Y&mode=snapshot|live
 *
 *  mode=snapshot (默认 · miniapp 推荐):
 *    · 拉 GET /cameras/{id}/snapshot 拿单帧 JPG
 *    · 30 秒自动刷新, 下拉手动刷新
 *    · 不消耗带宽, 不要求备案域名, 任何账号能跑
 *    · 提示: "实时直播请用管理端"
 *
 *  mode=live (备用 · 等域名备案 + 业务域名白名单):
 *    · 走 <web-view src=${TARO_APP_CAMERA_H5_BASE}/play.html?url=...>
 *    · 加载 H5 flv.js/hls.js 播 RTMP 流
 *    · 没配 H5 域名时降级成"配置缺失"占位
 *
 *  为什么 miniapp 默认快照:
 *    · 小程序 <live-player> 要直播类目白名单 + 企业主体, 农业类目走不通
 *    · <web-view> 要备案 HTTPS 业务域名 + 加白名单, 上线节奏长
 *    · 实时画面走 admin / bridge-viz 大屏的浏览器 flv.js, 不受小程序约束
 * ============================================================ */

const SNAPSHOT_INTERVAL_MS = 30_000

export default function CameraPage() {
  const router = useRouter()
  const cameraId = Number(router.params.cameraId || 0)
  const cameraName = decodeParam(router.params.cameraName) || `摄像头 #${cameraId}`
  // 默认 snapshot. live 模式仅在路由显式传 mode=live 时启用
  const mode: 'snapshot' | 'live' = router.params.mode === 'live' ? 'live' : 'snapshot'

  if (mode === 'live') {
    return <CameraLiveView cameraId={cameraId} cameraName={cameraName} />
  }
  return <CameraSnapshotView cameraId={cameraId} cameraName={cameraName} />
}

// ============================================================
//  Snapshot 模式 · 默认 / miniapp 推荐
// ============================================================

function CameraSnapshotView({ cameraId, cameraName }: { cameraId: number; cameraName: string }) {
  const [imgUrl, setImgUrl] = useState<string>('')
  const [capturedAt, setCapturedAt] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string>('')
  // 用于 cache-bust, 让同一 URL 强制重新拉取
  const [version, setVersion] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 切后台时停轮询省电, 切回来恢复
  const visibleRef = useRef(true)
  // 防并发: 同一时间只允许一次拉取
  const fetchingRef = useRef(false)

  useLoad(() => {
    if (!cameraId) {
      setErr('参数缺失: cameraId')
      return
    }
    pullSnapshot()
    startPolling()
  })

  useDidShow(() => {
    visibleRef.current = true
    // 重新可见时立即拉一次, 避免界面看到一张过期照片
    if (cameraId) pullSnapshot()
  })

  useDidHide(() => {
    visibleRef.current = false
  })

  useUnload(() => {
    stopPolling()
  })

  usePullDownRefresh(() => {
    pullSnapshot().finally(() => Taro.stopPullDownRefresh())
  })

  function startPolling() {
    if (timerRef.current) return
    timerRef.current = setInterval(() => {
      if (visibleRef.current) pullSnapshot()
    }, SNAPSHOT_INTERVAL_MS)
  }

  function stopPolling() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  async function pullSnapshot() {
    if (fetchingRef.current) return
    fetchingRef.current = true
    setLoading(true)
    setErr('')
    try {
      const snap = await getSnapshot(cameraId)
      if (snap?.snapshotUrl) {
        // SRS 截图 URL 可能不变, 加个 v= cache-bust 让 Image 强制重载
        setImgUrl(snap.snapshotUrl)
        setCapturedAt(snap.capturedAt || '')
        setVersion((v) => v + 1)
      } else {
        setErr('无快照数据 · 摄像头可能暂未推流')
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : '获取快照失败')
    } finally {
      setLoading(false)
      fetchingRef.current = false
    }
  }

  // 给 Image 加 cache-bust 参数 (SRS 实时截图 URL 通常不变)
  const displayUrl = useMemo(() => {
    if (!imgUrl) return ''
    const sep = imgUrl.includes('?') ? '&' : '?'
    return `${imgUrl}${sep}v=${version}`
  }, [imgUrl, version])

  // "更新于 X 秒前" 格式化
  const elapsedLabel = useMemo(() => {
    if (!capturedAt) return ''
    const ts = new Date(capturedAt.replace(' ', 'T')).getTime()
    if (!Number.isFinite(ts)) return capturedAt
    const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000))
    if (sec < 60) return `${sec} 秒前`
    if (sec < 3600) return `${Math.floor(sec / 60)} 分钟前`
    return `${Math.floor(sec / 3600)} 小时前`
  }, [capturedAt, version])

  return (
    <View className='camera-snapshot'>
      <View className='camera-snapshot__head'>
        <Text className='camera-snapshot__seal'>§ 05 · 现场画面</Text>
        <Text className='camera-snapshot__title'>{cameraName}</Text>
        <Text className='camera-snapshot__sub'>
          快照预览 · 每 30 秒自动刷新 · 下拉立即更新
        </Text>
      </View>

      <View className='camera-snapshot__stage'>
        {displayUrl ? (
          <Image
            key={displayUrl}
            className='camera-snapshot__img'
            src={displayUrl}
            mode='aspectFit'
            onError={() => setErr('快照加载失败 · 摄像头流媒体可能未连接')}
          />
        ) : err ? (
          <View className='camera-snapshot__err'>
            <Text className='camera-snapshot__err-title'>快照不可用</Text>
            <Text className='camera-snapshot__err-msg'>{err}</Text>
          </View>
        ) : (
          <View className='camera-snapshot__loading'>
            <Text>{loading ? '加载快照…' : '准备中…'}</Text>
          </View>
        )}
      </View>

      <View className='camera-snapshot__meta'>
        <Text className='camera-snapshot__meta-key'>更新于</Text>
        <Text className='camera-snapshot__meta-val'>
          {capturedAt ? `${elapsedLabel} · ${capturedAt}` : '—'}
        </Text>
      </View>

      <Button
        className='camera-snapshot__btn'
        loading={loading}
        disabled={loading}
        onClick={pullSnapshot}
      >
        <Text>立即刷新</Text>
      </Button>

      <View className='camera-snapshot__foot'>
        <Text className='camera-snapshot__foot-text'>
          · 实时直播画面请使用「管理端大屏」或 PC 浏览器观看
        </Text>
        <Text className='camera-snapshot__foot-text'>
          · 小程序仅展示快照, 不消耗手机流量看视频
        </Text>
      </View>
    </View>
  )
}

// ============================================================
//  Live 模式 · 备用 (等域名备案 + 业务域名白名单后启用)
// ============================================================

function CameraLiveView({ cameraId, cameraName }: { cameraId: number; cameraName: string }) {
  const [flvUrl, setFlvUrl] = useState('')
  const [hlsUrl, setHlsUrl] = useState('')
  const [fetchErr, setFetchErr] = useState('')
  const [loadError, setLoadError] = useState('')
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const loadedRef = useRef(false)

  const h5Base = process.env.TARO_APP_CAMERA_H5_BASE

  useLoad(() => {
    if (!cameraId) {
      setFetchErr('参数缺失: cameraId')
      return
    }
    pullLiveUrl()
  })

  useDidShow(() => {
    if (loadError) {
      setLoadError('')
      loadedRef.current = false
    }
  })

  useUnload(() => {
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
  })

  async function pullLiveUrl() {
    try {
      const live = await getLiveUrl(cameraId)
      setFlvUrl(live.flvUrl || '')
      setHlsUrl(live.hlsUrl || '')
    } catch (e) {
      setFetchErr(e instanceof Error ? e.message : '获取直播地址失败')
    }
  }

  const webviewSrc = useMemo(() => {
    if (!h5Base) return ''
    if (!flvUrl && !hlsUrl) return ''
    const url = flvUrl || hlsUrl
    const qs = new URLSearchParams({ url, name: cameraName }).toString()
    return `${h5Base}/play.html?${qs}`
  }, [h5Base, flvUrl, hlsUrl, cameraName])

  useEffect(() => {
    if (!webviewSrc) return
    if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    loadedRef.current = false
    loadTimerRef.current = setTimeout(() => {
      if (!loadedRef.current) {
        setLoadError('H5 播放页加载超时, 请检查备案域名或网络')
      }
    }, 8000)
    return () => {
      if (loadTimerRef.current) clearTimeout(loadTimerRef.current)
    }
  }, [webviewSrc])

  // 1. 完全没配 H5 域名 → 占位 + 提示
  if (!h5Base) {
    return (
      <View className='camera-fallback'>
        <View className='camera-fallback__head'>
          <Text className='camera-fallback__seal'>§ 05 · 摄像头</Text>
          <Text className='camera-fallback__title'>{cameraName}</Text>
          <Text className='camera-fallback__sub'>
            直播 H5 页尚未配置 (TARO_APP_CAMERA_H5_BASE 为空)
          </Text>
        </View>
        <View className='camera-fallback__card'>
          <Text className='camera-fallback__label'>FLV URL</Text>
          <Text className='camera-fallback__url' selectable>
            {flvUrl || '—'}
          </Text>
          <Text className='camera-fallback__label'>HLS URL</Text>
          <Text className='camera-fallback__url' selectable>
            {hlsUrl || '—'}
          </Text>
          <Text className='camera-fallback__hint'>
            · 备案域名配好后, 在 .env 里设 TARO_APP_CAMERA_H5_BASE=https://yourdomain.com 即可
          </Text>
          <Text className='camera-fallback__hint'>
            · 当前可在 admin-next 大屏或浏览器 flv.js demo 里播放上述 URL 验证流通
          </Text>
        </View>
      </View>
    )
  }

  // 2. 配了 H5 但没拿到 url → 错误占位
  if (fetchErr || (!flvUrl && !hlsUrl)) {
    return (
      <View className='camera-fallback'>
        <View className='camera-fallback__head'>
          <Text className='camera-fallback__seal'>§ 05 · 摄像头 · 异常</Text>
          <Text className='camera-fallback__title'>{cameraName}</Text>
          <Text className='camera-fallback__sub'>
            {fetchErr || '未收到直播 URL, 请从 task 页重进'}
          </Text>
        </View>
      </View>
    )
  }

  // 3. H5 已配 + URL 齐全 → 全屏 webview
  return (
    <View className='camera-stage'>
      <WebView
        src={webviewSrc}
        onMessage={(e) => console.log('[CameraPage] webview message', e)}
        onLoad={() => {
          loadedRef.current = true
          if (loadTimerRef.current) {
            clearTimeout(loadTimerRef.current)
            loadTimerRef.current = null
          }
        }}
        onError={(e) => {
          console.error('[CameraPage] webview error', e)
          setLoadError('H5 播放页加载失败, 检查业务域名是否已加白名单')
        }}
      />
      {loadError ? (
        <View className='camera-stage__err'>
          <Text>{loadError}</Text>
        </View>
      ) : null}
    </View>
  )
}

// ---- 辅助 ----
function decodeParam(raw: string | undefined): string {
  if (!raw) return ''
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}
