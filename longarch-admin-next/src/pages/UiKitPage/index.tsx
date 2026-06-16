import { useState } from 'react'
import PageShell from '@/components/shell/PageShell'
import {
  Button,
  Input,
  Label,
  Badge,
  Card,
  CardHeader,
  CardSeal,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogSeal,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Pagination,
} from '@/components/ui'
import { toast } from '@/lib/toast'

/**
 * UiKitPage · §UI Kit
 * ============================================================
 *  所有基础组件的视觉验证 · 数据是 mock 的不需要后端
 * ============================================================ */
export default function UiKitPage() {
  const [text, setText] = useState('温度 23.4℃')
  const [pageNo, setPageNo] = useState(1)
  const [selected, setSelected] = useState('admin')

  return (
    <PageShell
      seal="§UI · Kit"
      title="UI Kit"
      titleCn="构 件 簿"
      lede="Ten foundations, hand-set in paper and hairlines."
      right={
        <>
          <span>COMPONENTS</span>
          <span>·</span>
          <span>SHADCN × MORANDI</span>
        </>
      }
    >
      {/* ==== §1 Buttons ==== */}
      <section className="folio-page__section" data-testid="kit-buttons">
        <h4 className="folio-page__section-title">
          §1 <em>Buttons · 5 variants × 3 sizes</em>
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
          <Button variant="link">Link</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="primary" size="sm">
            Small
          </Button>
          <Button variant="primary" size="md">
            Medium
          </Button>
          <Button variant="primary" size="lg">
            Large
          </Button>
        </div>
      </section>

      {/* ==== §2 Input + Label ==== */}
      <section className="folio-page__section" data-testid="kit-input">
        <h4 className="folio-page__section-title">
          §2 <em>Input · Label</em>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl">
          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-input-sample">SENSOR READING</Label>
            <Input
              id="kit-input-sample"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="placeholder..."
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kit-input-disabled">DISABLED</Label>
            <Input id="kit-input-disabled" disabled placeholder="disabled" />
          </div>
        </div>
      </section>

      {/* ==== §3 Badges ==== */}
      <section className="folio-page__section" data-testid="kit-badges">
        <h4 className="folio-page__section-title">
          §3 <em>Badges · 7 tones</em>
        </h4>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>neutral</Badge>
          <Badge tone="sage">sage · ok</Badge>
          <Badge tone="fog">fog · info</Badge>
          <Badge tone="sand">sand · pending</Badge>
          <Badge tone="clay">clay · error</Badge>
          <Badge tone="moss">moss · live</Badge>
          <Badge tone="plum">plum · admin</Badge>
        </div>
      </section>

      {/* ==== §4 Card ==== */}
      <section className="folio-page__section" data-testid="kit-card">
        <h4 className="folio-page__section-title">
          §4 <em>Card · hairline container</em>
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
          <Card>
            <CardHeader>
              <CardSeal>§ A · Specimen</CardSeal>
              <CardTitle>大棚一号 · Greenhouse 01</CardTitle>
              <CardDescription>
                Environmental sensor · last sample 14 s ago.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[13px]">
                <dt className="text-ink-faint">temp</dt>
                <dd className="font-folio text-ink">23.4℃</dd>
                <dt className="text-ink-faint">humidity</dt>
                <dd className="font-folio text-ink">61.2%</dd>
                <dt className="text-ink-faint">co2</dt>
                <dd className="font-folio text-ink">421 ppm</dd>
              </dl>
            </CardContent>
            <CardFooter>
              <Button variant="ghost" size="sm">
                history
              </Button>
              <Button variant="primary" size="sm">
                refresh
              </Button>
            </CardFooter>
          </Card>

          <Card>
            <CardHeader>
              <CardSeal>§ B · Status</CardSeal>
              <CardTitle>设备 Actuator-12</CardTitle>
              <CardDescription>
                Shade curtain · idle, last raised 2 d ago.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge tone="sage">online</Badge>
                <Badge tone="sand">idle</Badge>
              </div>
              <p className="font-serif italic text-[13px] text-ink-soft">
                Nothing in the queue. The device is sleeping on the truss.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ==== §5 Dialog ==== */}
      <section className="folio-page__section" data-testid="kit-dialog">
        <h4 className="folio-page__section-title">
          §5 <em>Dialog · Radix portal</em>
        </h4>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="primary" data-testid="kit-dialog-trigger">
              Open dialog
            </Button>
          </DialogTrigger>
          <DialogContent data-testid="kit-dialog-content">
            <DialogHeader>
              <DialogSeal>§ FORM · confirm</DialogSeal>
              <DialogTitle>Archive this record?</DialogTitle>
              <DialogDescription>
                This will move the folio entry into the locked archive.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-2 max-w-sm">
                <Label htmlFor="kit-dialog-reason">REASON</Label>
                <Input id="kit-dialog-reason" placeholder="a short note..." />
              </div>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button variant="primary">Archive</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </section>

      {/* ==== §6 Select ==== */}
      <section className="folio-page__section" data-testid="kit-select">
        <h4 className="folio-page__section-title">
          §6 <em>Select · role filter</em>
        </h4>
        <div className="max-w-xs flex flex-col gap-2">
          <Label htmlFor="kit-select">ROLE</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger id="kit-select" data-testid="kit-select-trigger">
              <SelectValue placeholder="select a role" />
            </SelectTrigger>
            <SelectContent data-testid="kit-select-content">
              <SelectItem value="admin">平台管理员 · Director</SelectItem>
              <SelectItem value="operator">运营人员 · Operator</SelectItem>
              <SelectItem value="agronomist">农技人员 · Agronomist</SelectItem>
              <SelectItem value="adopter">认养用户 · Adopter</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-[11px] font-folio text-ink-faint tracking-widest uppercase">
            CURRENT: {selected}
          </div>
        </div>
      </section>

      {/* ==== §7 Table + Pagination ==== */}
      <section className="folio-page__section" data-testid="kit-table">
        <h4 className="folio-page__section-title">
          §7 <em>Table · Pagination</em>
        </h4>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>No.</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-folio">01</TableCell>
                <TableCell>张管理</TableCell>
                <TableCell>
                  <Badge tone="plum">admin</Badge>
                </TableCell>
                <TableCell>
                  <Badge tone="sage">active</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-folio">02</TableCell>
                <TableCell>李运营</TableCell>
                <TableCell>
                  <Badge tone="fog">operator</Badge>
                </TableCell>
                <TableCell>
                  <Badge tone="sage">active</Badge>
                </TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-folio">03</TableCell>
                <TableCell>王认养</TableCell>
                <TableCell>
                  <Badge tone="sand">adopter</Badge>
                </TableCell>
                <TableCell>
                  <Badge tone="clay">suspended</Badge>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
          <div className="px-4">
            <Pagination
              pageNo={pageNo}
              pageSize={10}
              total={42}
              onPageChange={setPageNo}
            />
          </div>
        </Card>
      </section>

      {/* ==== §8 Toast ==== */}
      <section className="folio-page__section" data-testid="kit-toast">
        <h4 className="folio-page__section-title">
          §8 <em>Toast · sonner</em>
        </h4>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="primary"
            data-testid="kit-toast-success"
            onClick={() => toast.success('已登录 · signed in')}
          >
            success
          </Button>
          <Button
            variant="secondary"
            data-testid="kit-toast-info"
            onClick={() => toast.info('刷新中 · refreshing')}
          >
            info
          </Button>
          <Button
            variant="secondary"
            data-testid="kit-toast-warning"
            onClick={() => toast.warning('数据稍慢 · slow sample')}
          >
            warning
          </Button>
          <Button
            variant="danger"
            data-testid="kit-toast-error"
            onClick={() => toast.error('连接失败 · connection lost')}
          >
            error
          </Button>
        </div>
      </section>
    </PageShell>
  )
}
