import { STATUS_LABEL, hm, minuteOfDay } from '../format';
import type { DailyLog, DutyStatus } from '../types';

const W = 1000;
const H = 900;
const PRINT = '#141414';
const PEN = 'var(--color-ink-pen)';
const GRID_X = 176;
const GRID_W = 720;
const TOTAL_X = GRID_X + GRID_W;
const BAND_Y = 262;
const BAND_H = 26;
const ROW_H = 36;
const GRID_Y = BAND_Y + BAND_H;
const GRID_BOTTOM = GRID_Y + ROW_H * 4;
const ROWS: DutyStatus[] = ['off_duty', 'sleeper_berth', 'driving', 'on_duty'];
const ROW_TITLES = ['1. Off Duty', '2. Sleeper', '3. Driving', '4. On Duty'];
const ROW_SUBTITLES = ['', 'Berth', '', '(not driving)'];
const HOUR_LABELS = ['Mid-\nnight', ...Array.from({ length: 11 }, (_, i) => String(i + 1)), 'Noon', ...Array.from({ length: 11 }, (_, i) => String(i + 1)), 'Mid-\nnight'];

const x = (minute: number) => GRID_X + (minute / 1440) * GRID_W;
const rowCenter = (status: DutyStatus) => GRID_Y + ROWS.indexOf(status) * ROW_H + ROW_H / 2;

function dutyPath(log: DailyLog): string {
  const [first, ...rest] = log.segments;
  const moves = rest.map((seg) => `V ${rowCenter(seg.status)} H ${x(seg.end_minute)}`);
  return [`M ${x(first.start_minute)} ${rowCenter(first.status)} H ${x(first.end_minute)}`, ...moves].join(' ');
}

const SHORT_NOTES: Record<string, string> = {
  'Pretrip inspection': 'Pre-trip',
  'Pretrip inspection before departure': 'Pre-trip',
  'Pickup, loading': 'Loading',
  '1 hr on duty for loading at the shipper': 'Loading',
  'Dropoff, unloading': 'Unload',
  '1 hr on duty for unloading at the receiver': 'Unload',
  'Fuel': 'Fuel',
  'Fuel stop before 1,000 mi since the last fill': 'Fuel',
  '30 min break': '30m Break',
  '30 min break required after 8 hrs cumulative driving': '30m Break',
  '10 hr sleeper berth': '10h Rest',
  '10 hr reset: 11 hr driving limit reached': '10h Rest',
  '10 hr reset: 14 hr window reached': '10h Rest',
  '34 hr restart': '34h Restart',
  '34 hr restart: 70 hr / 8 day cycle reached': '34h Restart',
  'Driving': 'Driving',
  'Off duty': 'Off Duty',
};

interface DisplayRemark {
  minute: number;
  location: string;
  note: string;
  rx: number;
  ry: number;
}

function computeDisplayRemarks(log: DailyLog): DisplayRemark[] {
  const filtered = log.remarks.filter((r, i, arr) => {
    if (r.note === 'Driving' && i > 0) {
      const prev = arr[i - 1];
      if (prev.location === r.location && r.minute - prev.minute <= 120) {
        return false;
      }
    }
    return true;
  });

  if (filtered.length === 0) return [];

  const clusters: typeof filtered[] = [];
  let curCluster: typeof filtered = [filtered[0]];
  let lastX = x(filtered[0].minute);

  for (let i = 1; i < filtered.length; i++) {
    const rx = x(filtered[i].minute);
    if (rx - lastX < 85) {
      curCluster.push(filtered[i]);
    } else {
      clusters.push(curCluster);
      curCluster = [filtered[i]];
    }
    lastX = rx;
  }
  clusters.push(curCluster);

  const TIERS = [445, 515, 585];
  const result: DisplayRemark[] = [];

  for (const cluster of clusters) {
    const k = cluster.length;
    if (k === 1) {
      result.push({
        ...cluster[0],
        rx: x(cluster[0].minute),
        ry: TIERS[0],
      });
    } else if (k === 2) {
      result.push({
        ...cluster[0],
        rx: x(cluster[0].minute),
        ry: TIERS[1],
      });
      result.push({
        ...cluster[1],
        rx: x(cluster[1].minute),
        ry: TIERS[0],
      });
    } else {
      for (let i = 0; i < k; i++) {
        const tIdx = Math.min(TIERS.length - 1, (k - 1) - i);
        result.push({
          ...cluster[i],
          rx: x(cluster[i].minute),
          ry: TIERS[tIdx],
        });
      }
    }
  }

  return result;
}

function Field({ x1, x2, y, label, value, hand = true }: { x1: number; x2: number; y: number; label: string; value?: string; hand?: boolean }) {
  return (
    <g>
      <line x1={x1} x2={x2} y1={y} y2={y} stroke={PRINT} strokeWidth="1" />
      <text x={(x1 + x2) / 2} y={y + 13} fontSize="10.5" textAnchor="middle" fill={PRINT}>
        {label}
      </text>
      {value && (
        <text x={(x1 + x2) / 2} y={y - 5} fontSize={hand ? 21 : 13} textAnchor="middle" fill={PEN} fontFamily={hand ? 'var(--font-hand)' : undefined}>
          {value}
        </text>
      )}
    </g>
  );
}

interface Props {
  log: DailyLog;
  animate?: boolean;
}

export function LogSheet({ log, animate = false }: Props) {
  const [year, month, day] = log.date.split('-');
  const displayRemarks = computeDisplayRemarks(log);
  const onDutyBlocks = log.segments.filter((seg) => seg.status === 'on_duty');

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full bg-white" role="img" aria-label={`Driver daily log for ${log.date}`} fontFamily="var(--font-sans)">
      <text x="40" y="52" fontSize="27" fontWeight="700" fill={PRINT}>Drivers Daily Log</text>
      <text x="78" y="70" fontSize="11" fill={PRINT}>(24 hours)</text>

      <Field x1={318} x2={388} y={52} label="(month)" value={month} />
      <text x="398" y="50" fontSize="18" fill={PRINT}>/</text>
      <Field x1={410} x2={480} y={52} label="(day)" value={day} />
      <text x="490" y="50" fontSize="18" fill={PRINT}>/</text>
      <Field x1={502} x2={590} y={52} label="(year)" value={year} />

      <text x="640" y="40" fontSize="11" fill={PRINT}>Original: File at home terminal.</text>
      <text x="640" y="56" fontSize="11" fill={PRINT}>Duplicate: Driver retains in his/her possession for 8 days.</text>

      <text x="60" y="104" fontSize="14" fontWeight="600" fill={PRINT}>From:</text>
      <line x1="104" x2="470" y1="106" y2="106" stroke={PRINT} />
      <text x="112" y="101" fontSize="22" fill={PEN} fontFamily="var(--font-hand)">{log.from}</text>
      <text x="520" y="104" fontSize="14" fontWeight="600" fill={PRINT}>To:</text>
      <line x1="548" x2="940" y1="106" y2="106" stroke={PRINT} />
      <text x="556" y="101" fontSize="22" fill={PEN} fontFamily="var(--font-hand)">{log.to}</text>

      <rect x="60" y="130" width="170" height="44" fill="none" stroke={PRINT} strokeWidth="1.4" />
      <rect x="246" y="130" width="170" height="44" fill="none" stroke={PRINT} strokeWidth="1.4" />
      <text x="145" y="162" fontSize="26" textAnchor="middle" fill={PEN} fontFamily="var(--font-hand)">{Math.round(log.miles_driving)}</text>
      <text x="331" y="162" fontSize="26" textAnchor="middle" fill={PEN} fontFamily="var(--font-hand)">{Math.round(log.miles_driving)}</text>
      <text x="145" y="189" fontSize="10.5" textAnchor="middle" fill={PRINT}>Total Miles Driving Today</text>
      <text x="331" y="189" fontSize="10.5" textAnchor="middle" fill={PRINT}>Total Mileage Today</text>
      <Field x1={60} x2={416} y={224} label="Truck/Tractor and Trailer Numbers or License Plate(s)/State (show each unit)" value="TRK-408 / TLR-5321 (IL)" />

      <Field x1={470} x2={940} y={148} label="Name of Carrier or Carriers" value="Spotter Freight Lines, Inc." />
      <Field x1={470} x2={940} y={188} label="Main Office Address" value="100 Logistics Blvd, Chicago, IL 60601" />
      <Field x1={470} x2={940} y={228} label="Home Terminal Address" value={`${log.from} Terminal`} />

      <rect x={GRID_X - 136} y={BAND_Y} width={TOTAL_X + 64 - (GRID_X - 136)} height={BAND_H} fill={PRINT} />
      {HOUR_LABELS.map((label, hour) =>
        label.split('\n').map((line, i, lines) => (
          <text key={`${hour}-${i}`} x={x(hour * 60)} y={BAND_Y + (lines.length > 1 ? 11 + i * 10 : 17)} fontSize={lines.length > 1 ? 8.5 : 10.5} fontWeight="600" textAnchor="middle" fill="#fff">
            {line}
          </text>
        )),
      )}
      <text x={TOTAL_X + 32} y={BAND_Y + 11} fontSize="8.5" fontWeight="600" textAnchor="middle" fill="#fff">Total</text>
      <text x={TOTAL_X + 32} y={BAND_Y + 21} fontSize="8.5" fontWeight="600" textAnchor="middle" fill="#fff">Hours</text>

      {ROWS.map((status, row) => {
        const top = GRID_Y + row * ROW_H;
        return (
          <g key={status}>
            <text x={GRID_X - 132} y={top + (ROW_SUBTITLES[row] ? 15 : 22)} fontSize="11.5" fontWeight="600" fill={PRINT}>{ROW_TITLES[row]}</text>
            {ROW_SUBTITLES[row] && <text x={GRID_X - 118} y={top + 29} fontSize="10.5" fill={PRINT}>{ROW_SUBTITLES[row]}</text>}
            <rect x={GRID_X} y={top} width={GRID_W} height={ROW_H} fill="none" stroke={PRINT} strokeWidth="1.2" />
            {Array.from({ length: 96 }, (_, q) => {
              const qx = GRID_X + (q * GRID_W) / 96;
              const tick = q % 4 === 0 ? ROW_H : q % 2 === 0 ? ROW_H * 0.45 : ROW_H * 0.28;
              return q % 4 === 0 ? (
                <line key={q} x1={qx} x2={qx} y1={top} y2={top + ROW_H} stroke={PRINT} strokeWidth="0.9" />
              ) : (
                <g key={q}>
                  <line x1={qx} x2={qx} y1={top} y2={top + tick} stroke={PRINT} strokeWidth="0.7" />
                  <line x1={qx} x2={qx} y1={top + ROW_H} y2={top + ROW_H - tick} stroke={PRINT} strokeWidth="0.7" />
                </g>
              );
            })}
            <line x1={TOTAL_X + 8} x2={TOTAL_X + 58} y1={top + ROW_H - 6} y2={top + ROW_H - 6} stroke={PRINT} />
            <text x={TOTAL_X + 33} y={top + ROW_H - 10} fontSize="20" textAnchor="middle" fill={PEN} fontFamily="var(--font-hand)">{hm(log.totals[status])}</text>
          </g>
        );
      })}
      <line x1={TOTAL_X + 8} x2={TOTAL_X + 58} y1={GRID_BOTTOM + 22} y2={GRID_BOTTOM + 22} stroke={PRINT} />
      <text x={TOTAL_X + 33} y={GRID_BOTTOM + 18} fontSize="20" textAnchor="middle" fill={PEN} fontFamily="var(--font-hand)">= 24</text>

      <path
        d={dutyPath(log)}
        fill="none"
        stroke={PEN}
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        className={animate ? 'pen-draw' : undefined}
      />
      {log.segments.map((seg) => (
        <rect key={seg.start_minute} x={x(seg.start_minute)} y={rowCenter(seg.status) - ROW_H / 2} width={x(seg.end_minute) - x(seg.start_minute)} height={ROW_H} fill="transparent" className="hover:fill-[rgb(31_58_140/0.08)]">
          <title>{`${STATUS_LABEL[seg.status]} · ${minuteOfDay(seg.start_minute)} to ${minuteOfDay(seg.end_minute)} · ${hm((seg.end_minute - seg.start_minute) / 60)}`}</title>
        </rect>
      ))}

      <text x="40" y={GRID_BOTTOM + 34} fontSize="15" fontWeight="700" fill={PRINT}>Remarks</text>
      <path d={`M 44 ${GRID_BOTTOM + 44} V 776 H 224`} fill="none" stroke={PRINT} strokeWidth="2.4" />
      <path d="M 636 776 H 956 V 464" fill="none" stroke={PRINT} strokeWidth="2.4" />
      {onDutyBlocks.map((seg) => (
        <path key={seg.start_minute} d={`M ${x(seg.start_minute)} ${GRID_BOTTOM + 4} v 10 H ${x(seg.end_minute)} v -10`} fill="none" stroke={PEN} strokeWidth="1.6" />
      ))}
      {displayRemarks.map((remark, i) => {
        const shortNote = SHORT_NOTES[remark.note] || remark.note;
        return (
          <g key={`${remark.minute}-${i}`}>
            <line x1={remark.rx} x2={remark.rx} y1={GRID_BOTTOM} y2={remark.ry} stroke={PEN} strokeWidth="1" strokeDasharray="3 2" />
            <text x={remark.rx + 2} y={remark.ry + 2} transform={`rotate(48 ${remark.rx} ${remark.ry})`} fontSize="11" fill={PEN} fontFamily="var(--font-hand)">
              <tspan fontWeight="700">{remark.location}</tspan>
              <tspan> ({shortNote})</tspan>
            </text>
          </g>
        );
      })}

      <text x="60" y="668" fontSize="11" fontWeight="700" fill={PRINT}>Shipping</text>
      <text x="60" y="680" fontSize="11" fontWeight="700" fill={PRINT}>Documents:</text>
      <line x1="60" x2="220" y1="708" y2="708" stroke={PRINT} />
      <text x="64" y="703" fontSize="14" fill={PEN} fontFamily="var(--font-hand)">{log.shipping_doc_number || 'MNF-89241-US'}</text>
      <text x="60" y="722" fontSize="9.5" fill={PRINT}>DVL or Manifest No. or</text>
      <line x1="60" x2="220" y1="752" y2="752" stroke={PRINT} />
      <text x="64" y="747" fontSize="13" fill={PEN} fontFamily="var(--font-hand)">General Freight / Dry Van</text>
      <text x="60" y="766" fontSize="9.5" fill={PRINT}>Shipper &amp; Commodity</text>

      <g fontSize="9.5" textAnchor="middle" fill={PRINT}>
        <text x="430" y="728">Enter name of place you reported and where released from work,</text>
        <text x="430" y="742">and when and where each change of duty occurred.</text>
        <text x="430" y="758">Use time standard of home terminal.</text>
      </g>

      <g transform="translate(650, 700)">
        <text x="120" y="10" fontSize="9.5" fontStyle="italic" textAnchor="middle" fill={PRINT}>
          I certify that these entries are true and correct:
        </text>
        <line x1="0" x2="240" y1="46" y2="46" stroke={PRINT} strokeWidth="1" />
        <text x="24" y="41" fontSize="22" fill={PEN} fontFamily="var(--font-hand)">
          J. R. Walker
        </text>
        <text x="120" y="60" fontSize="10" textAnchor="middle" fill={PRINT}>
          Driver's Signature in Full
        </text>
      </g>

      <line x1="40" x2={W - 40} y1="788" y2="788" stroke={PRINT} strokeWidth="2.4" />
      <text x="40" y="806" fontSize="11" fontWeight="600" fill={PRINT}>Recap:</text>
      <text x="40" y="820" fontSize="10" fill={PRINT}>Complete at end of day</text>
      <text x="170" y="806" fontSize="10" fill={PRINT}>On duty hours today,</text>
      <text x="170" y="820" fontSize="10" fill={PRINT}>Total lines 3 &amp; 4</text>
      <text x="200" y="852" fontSize="24" fill={PEN} fontFamily="var(--font-hand)">{hm(log.recap.on_duty_today)}</text>

      <text x="300" y="806" fontSize="11" fontWeight="600" fill={PRINT}>70 Hour / 8 Day Drivers</text>
      {[
        { col: 300, head: 'A. Total hours on duty', sub: 'last 7 days incl. today', value: hm(log.recap.total_last_7_days ?? log.recap.total_last_8_days) },
        { col: 430, head: 'B. Total hours available', sub: 'tomorrow, 70 hr minus A*', value: hm(log.recap.available_tomorrow) },
        { col: 560, head: 'C. Total hours on duty', sub: 'last 8 days incl. today', value: hm(log.recap.total_last_8_days) },
      ].map((cell) => (
        <g key={cell.col}>
          <text x={cell.col} y="822" fontSize="9.5" fill={PRINT}>{cell.head}</text>
          <text x={cell.col} y="834" fontSize="9.5" fill={PRINT}>{cell.sub}</text>
          {cell.value && <text x={cell.col + 14} y="866" fontSize="24" fill={PEN} fontFamily="var(--font-hand)">{cell.value}</text>}
        </g>
      ))}
      <text x="700" y="806" fontSize="11" fontWeight="600" fill={PRINT}>60 Hour / 7 Day Drivers</text>
      <text x="700" y="822" fontSize="9.5" fill={PRINT}>Not applicable on the 70 hour schedule.</text>
      <text x="700" y="852" fontSize="9.5" fill={PRINT}>*If you took 34 consecutive hours off duty</text>
      <text x="700" y="864" fontSize="9.5" fill={PRINT}>you have 60/70 hours available.</text>
    </svg>
  );
}
