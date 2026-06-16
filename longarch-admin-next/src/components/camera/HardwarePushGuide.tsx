import { useMemo, useState } from 'react'
import { Button } from '@/components/ui'
import { toast } from '@/lib/toast'

/**
 * §7 · 摄像头硬件推流指引
 * ============================================================
 *  给硬件安装人员看的"推流配置卡":
 *    · 完整的 RTMP Push URL (一键复制)
 *    · 拆开成 服务器地址 (Server) + 流密钥 (Stream Key) 两段, 兼容 OBS / 海康 NVR / 大华 DSS 不同表单
 *    · 主流摄像头牌子的填法示例 (海康 / 大华 / 萤石 / 通用 ONVIF)
 *
 *  用在两个地方:
 *    1. PlotsPage 绑定成功后的结果对话框
 *    2. CamerasPage 编辑对话框顶部
 *
 *  入参字段都来自后端 CameraListVO / BindCameraVO:
 *    · deviceNo · 摄像头业务编号
 *    · streamProtocol · rtmp / rtsp / hls / webrtc
 *    · rtmpPushUrl · 完整的 rtmp://host:1935/live/{streamName}
 *    · streamName · SRS 流名 (= Stream Key)
 *    · streamApp · 默认 live
 * ============================================================ */

interface Props {
  deviceNo?: string | null
  streamProtocol?: string | null
  rtmpPushUrl?: string | null
  streamName?: string | null
  streamApp?: string | null
  /** 紧凑模式: 不显示主流摄像头示例那段 */
  compact?: boolean
}

export default function HardwarePushGuide({
  deviceNo,
  streamProtocol,
  rtmpPushUrl,
  streamName,
  streamApp,
  compact,
}: Props) {
  const protocol = (streamProtocol || 'rtmp').toLowerCase()

  // 把 rtmp://host:port/app/stream 拆成 server + key 两段, 给 OBS / 海康表单填用
  const split = useMemo(() => splitRtmpUrl(rtmpPushUrl, streamApp, streamName), [
    rtmpPushUrl,
    streamApp,
    streamName,
  ])

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-line-soft bg-paper-light p-3">
      <div className="flex items-baseline gap-2">
        <span className="font-folio text-[10px] uppercase tracking-widest text-ink-faint">
          § HARDWARE · push setup
        </span>
        <span className="font-folio text-[10px] text-ink-soft">
          硬件配置 · 把以下信息填到摄像头/NVR 的推流设置里
        </span>
      </div>

      {/* 完整 RTMP URL */}
      <Field
        label="Push URL · 完整推流地址"
        value={rtmpPushUrl || '—'}
        hint={
          protocol === 'rtmp'
            ? '若摄像头表单只有一个 URL 输入框, 直接粘这一段'
            : `当前协议是 ${protocol.toUpperCase()}; 摄像头按此协议推流`
        }
        copyable
      />

      {/* 拆分: Server URL + Stream Key (OBS / 海康 / 大华 表单是分开两栏) */}
      {protocol === 'rtmp' && split && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Server URL · 服务器" value={split.server} copyable mono small />
            <Field
              label="Stream Key · 流密钥"
              value={split.key}
              copyable
              mono
              small
              hint="OBS/海康 表单里"
            />
          </div>
        </>
      )}

      {/* 业务字段 */}
      <div className="grid grid-cols-3 gap-3">
        <Field label="Device No." value={deviceNo || '—'} copyable mono small />
        <Field label="Stream Name" value={streamName || deviceNo || '—'} copyable mono small />
        <Field label="Protocol" value={protocol.toUpperCase()} mono small />
      </div>

      {/* 主流摄像头填法 */}
      {!compact && protocol === 'rtmp' && split && (
        <details className="text-[12px]">
          <summary className="cursor-pointer font-folio text-[10px] uppercase tracking-widest text-ink-faint hover:text-ink select-none">
            常见摄像头怎么填 ▾
          </summary>
          <div className="mt-2 flex flex-col gap-2 pl-2 border-l border-line-soft text-ink-soft">
            <BrandRow
              brand="海康威视"
              steps={[
                '配置 → 网络 → 高级配置 → 平台接入 → 选 RTMP',
                `服务器地址: ${split.server}`,
                `流密钥 / 流名称: ${split.key}`,
              ]}
            />
            <BrandRow
              brand="大华"
              steps={[
                '设置 → 网络管理 → RTMP',
                `URL: ${rtmpPushUrl ?? '—'}`,
                '保存并启用',
              ]}
            />
            <BrandRow
              brand="萤石"
              steps={[
                '萤石云 IPC 不直接支持自定义 RTMP 推流',
                '需走"萤石开放平台 → 设备接入"通过萤石 SDK 拉流',
                '或通过 NVR 桥接 (NVR 收 ONVIF, 桥接 RTMP 出口)',
              ]}
            />
            <BrandRow
              brand="OBS Studio · 测试推流用"
              steps={[
                '设置 → 推流 → 服务: 自定义',
                `服务器: ${split.server}`,
                `推流密钥: ${split.key}`,
              ]}
            />
            <BrandRow
              brand="ffmpeg · 命令行测试"
              steps={[`ffmpeg -re -stream_loop -1 -i sample.mp4 -c copy -f flv ${rtmpPushUrl ?? ''}`]}
              code
            />
          </div>
        </details>
      )}

      {/* 提示 */}
      <p className="font-sans text-[11px] text-ink-faint leading-relaxed">
        · 推流端口默认 <code className="font-folio">1935</code>; 公网部署需在防火墙放行 <br />
        · 推流后管理端"推流"列约 5~10 秒后会显示绿色「推流中」
      </p>
    </div>
  )
}

// ---- 辅助 ----

interface FieldProps {
  label: string
  value: string
  hint?: string
  copyable?: boolean
  mono?: boolean
  small?: boolean
}

function Field({ label, value, hint, copyable, mono, small }: FieldProps) {
  const [copied, setCopied] = useState(false)
  async function handleCopy() {
    if (!value || value === '—') return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      toast.success('已复制')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.warning('剪贴板不可用')
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <span className="font-folio text-[10px] uppercase tracking-widest text-ink-faint">
        {label}
      </span>
      <div
        className={`flex items-center gap-2 border border-line-soft bg-paper px-2.5 ${
          small ? 'py-1.5' : 'py-2'
        }`}
      >
        <span
          className={`flex-1 break-all ${
            mono ? 'font-folio' : ''
          } ${small ? 'text-[11px]' : 'text-[12px]'} text-ink`}
        >
          {value}
        </span>
        {copyable ? (
          <Button
            variant="ghost"
            className="h-6 px-2 text-[10px] font-folio uppercase tracking-wider text-ink-faint hover:text-ink shrink-0"
            onClick={handleCopy}
          >
            {copied ? 'OK' : '复制'}
          </Button>
        ) : null}
      </div>
      {hint ? (
        <span className="font-sans text-[10px] text-ink-faint">{hint}</span>
      ) : null}
    </div>
  )
}

function BrandRow({ brand, steps, code }: { brand: string; steps: string[]; code?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-folio text-[10px] uppercase tracking-wider text-ink">{brand}</span>
      {steps.map((s, i) => (
        <span
          key={i}
          className={`text-[11px] ${code ? 'font-folio break-all bg-paper border border-line-soft px-2 py-0.5' : 'pl-3'}`}
        >
          {code ? s : `· ${s}`}
        </span>
      ))}
    </div>
  )
}

/** 把完整 rtmp://host:port/app/stream URL 拆成 server (rtmp://host:port/app) + key (stream) */
function splitRtmpUrl(
  fullUrl?: string | null,
  app?: string | null,
  stream?: string | null,
): { server: string; key: string } | null {
  if (!fullUrl) return null
  // 先按拼接规则拆 (后端逻辑: rtmp-base + '/' + app + '/' + stream)
  // 但容错: 用户也可能手填非标准格式
  try {
    const u = new URL(fullUrl.replace(/^rtmp:/, 'http:').replace(/^rtmps:/, 'https:'))
    const path = u.pathname.replace(/^\/+/, '').split('/')
    if (path.length >= 2) {
      const tail = path[path.length - 1]
      const pre = path.slice(0, -1).join('/')
      const proto = fullUrl.startsWith('rtmps:') ? 'rtmps' : 'rtmp'
      const server = `${proto}://${u.host}/${pre}`
      const key = tail
      // 若用户传了 streamName 但 URL 拆出来不一致 (硬件师改过), 也以 URL 为准
      return { server, key: key || stream || '' }
    }
  } catch {
    // URL parse 失败的兜底: 用 app + stream 拼回去看一眼
  }
  if (app && stream) {
    // 从全 URL 倒数三段, 假定 [proto://host:port]/app/stream
    const idx = fullUrl.lastIndexOf(`/${stream}`)
    if (idx > 0) {
      return { server: fullUrl.slice(0, idx), key: stream }
    }
  }
  return null
}
